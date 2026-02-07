import { createServer } from "http";
import { readFile } from "fs/promises";
import { resolve4, resolveCname } from "dns/promises";
import { dirname, extname, join, normalize } from "path";
import { fileURLToPath } from "url";

const PORT = process.env.PORT || 3000;

const EXPECTED_A_RECORD = "76.76.21.21";
const EXPECTED_CNAME_SUFFIX = ".vercel-dns.com";
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const landingPages = [
  {
    id: "lp-1",
    domain: "example.com",
    client: "Acme Co",
    project: "Spring Campaign",
    environment: "production"
  },
  {
    id: "lp-2",
    domain: "offer.com",
    client: "Bright Labs",
    project: "Lead Gen",
    environment: "campaign"
  }
];

const state = new Map();
const history = new Map();

const emptyStatus = () => ({
  status: "UNKNOWN",
  reason: "Pending first check",
  lastChecked: null,
  risk: "Unknown"
});

const getRisk = (status) => (status === "LIVE" ? "Safe" : status === "DOWN" ? "High" : "Unknown");

const normalizeError = (error) => (error instanceof Error ? error.message : String(error));

const checkDns = async (domain) => {
  const result = {
    ok: false,
    type: "NONE",
    details: "No DNS records found"
  };

  try {
    const cnames = await resolveCname(domain);
    if (cnames.length) {
      const matches = cnames.some((record) => record.endsWith(EXPECTED_CNAME_SUFFIX));
      return {
        ok: matches,
        type: "CNAME",
        details: matches
          ? `CNAME points to ${EXPECTED_CNAME_SUFFIX}`
          : `CNAME does not point to ${EXPECTED_CNAME_SUFFIX}`
      };
    }
  } catch (error) {
    result.details = normalizeError(error);
  }

  try {
    const addresses = await resolve4(domain);
    if (addresses.length) {
      const matches = addresses.includes(EXPECTED_A_RECORD);
      return {
        ok: matches,
        type: "A",
        details: matches
          ? `A record matches ${EXPECTED_A_RECORD}`
          : `A record does not include ${EXPECTED_A_RECORD}`
      };
    }
  } catch (error) {
    result.details = normalizeError(error);
  }

  return result;
};

const checkHttp = async (domain) => {
  const url = `https://${domain}`;
  try {
    const response = await fetch(url, { redirect: "manual" });
    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      return { ok: false, reason: `Unexpected redirect (${response.status})` };
    }
    if (response.status !== 200) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }
    return { ok: true, reason: "HTTP 200" };
  } catch (error) {
    return { ok: false, reason: `SSL/HTTPS error: ${normalizeError(error)}` };
  }
};

const evaluateStatus = ({ dns, http }) => {
  if (!dns.ok) {
    return {
      status: "DOWN",
      reason: dns.details
    };
  }
  if (!http.ok) {
    return {
      status: "DOWN",
      reason: http.reason
    };
  }
  return {
    status: "LIVE",
    reason: "All checks passed"
  };
};

const recordHistory = (pageId, entry) => {
  const entries = history.get(pageId) ?? [];
  entries.unshift(entry);
  history.set(pageId, entries.slice(0, 100));
};

const performCheck = async (page) => {
  const [dns, http] = await Promise.all([checkDns(page.domain), checkHttp(page.domain)]);
  const evaluation = evaluateStatus({ dns, http });
  const lastChecked = new Date().toISOString();
  const record = {
    ...evaluation,
    lastChecked,
    dns,
    http
  };

  state.set(page.id, {
    status: evaluation.status,
    reason: evaluation.reason,
    lastChecked,
    risk: getRisk(evaluation.status)
  });

  recordHistory(page.id, record);
};

const runChecks = async () => {
  await Promise.all(landingPages.map((page) => performCheck(page)));
};

landingPages.forEach((page) => {
  state.set(page.id, emptyStatus());
  history.set(page.id, []);
});

setInterval(runChecks, CHECK_INTERVAL_MS);
runChecks();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, "public");

const contentTypes = new Map([
  [".html", "text/html"],
  [".css", "text/css"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".ico", "image/x-icon"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"]
]);

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const serveStatic = async (res, urlPath) => {
  const normalizedPath = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, normalizedPath === "/" ? "index.html" : normalizedPath);
  const fileExtension = extname(filePath);
  const contentType = contentTypes.get(fileExtension) ?? "application/octet-stream";

  try {
    const fileContents = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(fileContents);
  } catch (error) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
};

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === "/api/pages") {
    const results = landingPages.map((page) => ({
      ...page,
      ...state.get(page.id)
    }));
    return sendJson(res, 200, { results });
  }

  if (requestUrl.pathname.startsWith("/api/history/")) {
    const pageId = requestUrl.pathname.replace("/api/history/", "");
    const entries = history.get(pageId) ?? [];
    return sendJson(res, 200, { results: entries });
  }

  if (requestUrl.pathname === "/api/filters") {
    return sendJson(res, 200, {
      clients: [...new Set(landingPages.map((page) => page.client))],
      projects: [...new Set(landingPages.map((page) => page.project))],
      environments: [...new Set(landingPages.map((page) => page.environment))]
    });
  }

  return serveStatic(res, requestUrl.pathname);
});

server.listen(PORT, () => {
  console.log(`Monitoring dashboard running on port ${PORT}`);
});

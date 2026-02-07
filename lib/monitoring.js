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
  const { resolve4, resolveCname } = await import("dns/promises");
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

const initializeMonitoring = () => {
  if (globalThis.__monitoringInitialized) return;
  globalThis.__monitoringInitialized = true;

  landingPages.forEach((page) => {
    state.set(page.id, emptyStatus());
    history.set(page.id, []);
  });

  runChecks();
  globalThis.__monitoringInterval = setInterval(runChecks, CHECK_INTERVAL_MS);
};

export const getLandingPages = () => landingPages;
export const getState = () => state;
export const getHistory = () => history;
export const ensureMonitoring = () => {
  initializeMonitoring();
};

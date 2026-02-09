const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const landingPages = [
  {
    id: "lp-1",
    domain: "cubiclecraft.contentifymarketing.com",
    client: "Cubicle Craft",
    project: "General",
    environment: "production",
  },
  {
    id: "lp-2",
    domain: "online.urbangreyfurniture.com",
    client: "Urban Grey",
    project: "Main Furniture",
    environment: "production",
  },
  {
    id: "lp-3",
    domain: "queries.aluempire.com",
    client: "Alu Empire",
    project: "Inquiry Portal",
    environment: "production",
  },
  {
    id: "lp-4",
    domain: "teaklab-sofa.vercel.app",
    client: "Teaklab",
    project: "Sofa Collection",
    environment: "production",
  },
  {
    id: "lp-5",
    domain: "queries.dreamkitchens.in",
    client: "Dream Kitchens",
    project: "Inquiry Portal",
    environment: "production",
  },
  {
    id: "lp-6",
    domain: "dealers.paradisefurniture.in",
    client: "Paradise Furniture",
    project: "Dealer Portal",
    environment: "production",
  },
  {
    id: "lp-7",
    domain: "online.urbangreyfurniture.com/office-workstation-delhi",
    client: "Urban Grey",
    project: "Office Workstations",
    environment: "production",
  },
  {
    id: "lp-8",
    domain: "queries.aluempire.com/uPVC-doors-and-windows",
    client: "Alu Empire",
    project: "uPVC Solutions",
    environment: "production",
  },
  {
    id: "lp-9",
    domain: "teaklab.contentifymarketing.com",
    client: "Teaklab",
    project: "Marketing Content",
    environment: "production",
  },
  {
    id: "lp-10",
    domain: "queries.paradisefurniture.in",
    client: "Paradise Furniture",
    project: "Inquiry Portal",
    environment: "production",
  },
  {
    id: "lp-11",
    domain: "online.urbangreyfurniture.com/office-chairs-delhi",
    client: "Urban Grey",
    project: "Office Chairs",
    environment: "production",
  },
  {
    id: "lp-12",
    domain: "queries.aluempire.com/aluminium-door-matting-system",
    client: "Alu Empire",
    project: "Matting Systems",
    environment: "production",
  },
  {
    id: "lp-13",
    domain: "online.urbangreyfurniture.com/conference-chair-delhi",
    client: "Urban Grey",
    project: "Conference Chairs",
    environment: "production",
  },
  {
    id: "lp-14",
    domain: "online.urbangreyfurniture.com/restaurant-furniture",
    client: "Urban Grey",
    project: "Restaurant Furniture",
    environment: "production",
  },
  {
    id: "lp-15",
    domain: "online.urbangreyfurniture.com/cafe-and-cafeteria-furniture",
    client: "Urban Grey",
    project: "Cafe Furniture",
    environment: "production",
  },
  {
    id: "lp-16",
    domain: "queries.diograciaa.com/home-interiors-and-modular-kitchen",
    client: "Dio Gracia",
    project: "Inquiry Portal",
    environment: "production",
  },
  {
    id: "lp-17",
    domain: "admission.dpsbharuch.com",
    client: "DPS Bharuch",
    project: "Admission Portal",
    environment: "production",
  },
  {
    id: "lp-18",
    domain: "admissions.dpsanand.com",
    client: "DPS Anand",
    project: "Admission Portal",
    environment: "production",
  },
  {
    id: "lp-19",
    domain: "bridge-program.dps.edu.sg",
    client: "DPS Singapore",
    project: "Bridge Program",
    environment: "production",
  },
  {
    id: "lp-20",
    domain: "dealers.paradisefurniture.in",
    client: "Paradise Dealer",
    project: "Authorized Dealers",
    environment: "production",
  },
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

const extractHostname = (domain) => {
  // Extract just the hostname from domain (remove path if present)
  // e.g., "example.com/path" -> "example.com"
  if (!domain) return domain;
  
  // If domain already has protocol, use it; otherwise add https://
  const url = domain.startsWith("http://") || domain.startsWith("https://")
    ? domain
    : `https://${domain}`;
  
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // Fallback: split by '/' and take first part (before first slash)
    const parts = domain.split("/");
    return parts[0];
  }
};

const checkDns = async (domain) => {
  const { resolve4, resolveCname } = await import("dns/promises");
  const hostname = extractHostname(domain);
  
  // Validate hostname
  if (!hostname || hostname.trim() === "") {
    return {
      ok: false,
      type: "NONE",
      details: "Invalid hostname"
    };
  }
  
  const result = {
    ok: false,
    type: "NONE",
    details: "No DNS records found"
  };

  // Check CNAME records
  try {
    const cnames = await resolveCname(hostname);
    if (cnames.length) {
      return {
        ok: true,
        type: "CNAME",
        details: `CNAME resolved to ${cnames[0]}`
      };
    }
  } catch (error) {
    // CNAME lookup failed, try A record
  }

  // Check A records
  try {
    const addresses = await resolve4(hostname);
    if (addresses.length) {
      return {
        ok: true,
        type: "A",
        details: `A record resolved to ${addresses[0]}`
      };
    }
  } catch (error) {
    result.details = normalizeError(error);
  }

  return result;
};

const checkHttp = async (domain) => {
  // Construct URL - if domain already has protocol, use it; otherwise try https first
  // If domain has a path, preserve it
  let url;
  if (domain.startsWith("http://") || domain.startsWith("https://")) {
    url = domain;
  } else {
    url = `https://${domain}`;
  }
  
  // Create timeout controller
  const createTimeout = (ms) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    return { controller, timeout };
  };
  
  try {
    // Try HTTPS first with redirect following (many sites redirect HTTP to HTTPS)
    const { controller, timeout } = createTimeout(10000); // 10 second timeout
    const response = await fetch(url, { 
      redirect: "follow",
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LandingPageMonitor/1.0)"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    // Any 2xx status code means the site is live
    if (response.status >= 200 && response.status < 300) {
      return { ok: true, reason: `HTTP ${response.status} - Site is live` };
    }
    
    // 3xx redirects are followed automatically, but if we get here it's an issue
    if (response.status >= 300 && response.status < 400) {
      return { ok: true, reason: `HTTP ${response.status} - Redirect (site accessible)` };
    }
    
    // 4xx and 5xx mean the site is not working properly
    return { ok: false, reason: `HTTP ${response.status} - ${response.statusText || "Error"}` };
  } catch (error) {
    // If HTTPS fails, try HTTP as fallback
    if (url.startsWith("https://") && error.name !== "AbortError") {
      try {
        const httpUrl = url.replace("https://", "http://");
        const { controller, timeout } = createTimeout(10000);
        const response = await fetch(httpUrl, {
          redirect: "follow",
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LandingPageMonitor/1.0)"
          },
          signal: controller.signal
        });
        clearTimeout(timeout);
        
        if (response.status >= 200 && response.status < 300) {
          return { ok: true, reason: `HTTP ${response.status} - Site is live (HTTP only)` };
        }
        
        return { ok: false, reason: `HTTP ${response.status} - ${response.statusText || "Error"}` };
      } catch (httpError) {
        return { ok: false, reason: `Connection failed: ${normalizeError(error)}` };
      }
    }
    
    if (error.name === "AbortError") {
      return { ok: false, reason: "Connection timeout (10s)" };
    }
    
    return { ok: false, reason: `Connection failed: ${normalizeError(error)}` };
  }
};

const evaluateStatus = ({ dns, http }) => {
  // HTTP check is the primary indicator - if HTTP works, site is LIVE
  if (http.ok) {
    return {
      status: "LIVE",
      reason: "Site is live and accessible"
    };
  }
  
  // If HTTP fails, check DNS to provide better error message
  if (!dns.ok) {
    return {
      status: "DOWN",
      reason: `DNS error: ${dns.details}`
    };
  }
  
  // DNS resolves but HTTP fails
  return {
    status: "DOWN",
    reason: http.reason
  };
};

const recordHistory = (pageId, entry) => {
  const entries = history.get(pageId) ?? [];
  entries.unshift(entry);
  history.set(pageId, entries.slice(0, 100));
};

const performCheck = async (page) => {
  try {
    console.log(`Checking ${page.domain} (${page.id})...`);
    const checkStart = Date.now();
    
    const [dns, http] = await Promise.all([checkDns(page.domain), checkHttp(page.domain)]);
    
    console.log(`  DNS: ${dns.ok ? 'OK' : 'FAIL'} (${dns.type}) - ${dns.details}`);
    console.log(`  HTTP: ${http.ok ? 'OK' : 'FAIL'} - ${http.reason}`);
    
    const evaluation = evaluateStatus({ dns, http });
    const lastChecked = new Date().toISOString();
    const record = {
      ...evaluation,
      lastChecked,
      dns,
      http
    };

    const stateUpdate = {
      status: evaluation.status,
      reason: evaluation.reason,
      lastChecked,
      risk: getRisk(evaluation.status)
    };
    
    state.set(page.id, stateUpdate);
    recordHistory(page.id, record);
    
    const duration = Date.now() - checkStart;
    console.log(`✓ ${page.domain}: ${evaluation.status} - ${evaluation.reason} (${duration}ms)`);
    
    return stateUpdate;
  } catch (error) {
    // Handle any unexpected errors during checks
    const errorMessage = normalizeError(error);
    const lastChecked = new Date().toISOString();
    const stateUpdate = {
      status: "DOWN",
      reason: `Check failed: ${errorMessage}`,
      lastChecked,
      risk: "High"
    };
    
    state.set(page.id, stateUpdate);
    console.error(`✗ Error checking ${page.domain} (${page.id}):`, error);
    throw error; // Re-throw so Promise.allSettled can catch it
  }
};

const runChecks = async () => {
  // Use Promise.allSettled to ensure all checks run even if some fail
  console.log(`Starting checks for ${landingPages.length} landing pages...`);
  const startTime = Date.now();
  
  const results = await Promise.allSettled(landingPages.map((page) => performCheck(page)));
  
  const duration = Date.now() - startTime;
  
  // Log results
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  console.log(`Checks completed in ${duration}ms: ${successful} successful, ${failed} failed`);
  
  // Log any rejections
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Check failed for ${landingPages[index].domain}:`, result.reason);
    }
  });
  
  // Log current state summary
  const stateSummary = {
    LIVE: 0,
    DOWN: 0,
    UNKNOWN: 0
  };
  landingPages.forEach((page) => {
    const pageState = state.get(page.id);
    const status = pageState?.status || 'UNKNOWN';
    stateSummary[status] = (stateSummary[status] || 0) + 1;
  });
  console.log(`State summary:`, stateSummary);
};

const initializeMonitoring = () => {
  if (globalThis.__monitoringInitialized) {
    // If already initialized, just trigger a new check
    runChecks().catch((error) => {
      console.error("Error in monitoring checks:", error);
    });
    return;
  }
  
  globalThis.__monitoringInitialized = true;
  console.log(`Initializing monitoring for ${landingPages.length} landing pages...`);

  landingPages.forEach((page) => {
    state.set(page.id, emptyStatus());
    history.set(page.id, []);
  });

  // Start checks immediately and wait for them to complete
  runChecks()
    .then(() => {
      console.log("Initial monitoring checks completed");
    })
    .catch((error) => {
      console.error("Error in initial monitoring checks:", error);
    });
  
  // Set up interval for periodic checks
  globalThis.__monitoringInterval = setInterval(() => {
    runChecks().catch((error) => {
      console.error("Error in periodic monitoring checks:", error);
    });
  }, CHECK_INTERVAL_MS);
};

export const getLandingPages = () => landingPages;
export const getState = () => state;
export const getHistory = () => history;
export const ensureMonitoring = () => {
  initializeMonitoring();
};

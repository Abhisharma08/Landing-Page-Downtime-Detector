"use client";

import { useEffect, useMemo, useState } from "react";

const emptyFilters = {
  status: "all",
  client: "all",
  project: "all",
  environment: "all"
};

const formatTime = (isoString) => {
  if (!isoString) return "–";
  const deltaMinutes = Math.round((Date.now() - Date.parse(isoString)) / 60000);
  if (Number.isNaN(deltaMinutes)) return "–";
  return deltaMinutes === 0 ? "Just now" : `${deltaMinutes} min${deltaMinutes === 1 ? "" : "s"} ago`;
};

const createBadge = (status) => {
  if (status === "LIVE") return <span className="badge live">Live</span>;
  if (status === "DOWN") return <span className="badge down">Down</span>;
  return <span className="badge unknown">Unknown</span>;
};

export default function Home() {
  const [filters, setFilters] = useState(emptyFilters);
  const [pages, setPages] = useState([]);
  const [history, setHistory] = useState(new Map());
  const [filterOptions, setFilterOptions] = useState({
    clients: [],
    projects: [],
    environments: []
  });
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toast, setToast] = useState(null);

  const filteredPages = useMemo(() => {
    return pages.filter((page) => {
      if (filters.status === "down" && page.status !== "DOWN") return false;
      if (filters.status === "dns" && (!page.reason || !page.reason.toLowerCase().includes("dns"))) return false;
      if (filters.client !== "all" && page.client !== filters.client) return false;
      if (filters.project !== "all" && page.project !== filters.project) return false;
      if (filters.environment !== "all" && page.environment !== filters.environment) return false;
      return true;
    });
  }, [filters, pages]);

  const selectedPage = useMemo(
    () => (selectedId ? pages.find((page) => page.id === selectedId) : null),
    [pages, selectedId]
  );

  const selectedHistory = selectedId ? history.get(selectedId) ?? [] : [];
  const latestRecord = selectedHistory[0];

  const loadPages = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      setError(null);
      const response = await fetch("/api/pages", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setPages(data.results || []);
      setLastUpdate(new Date());
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error("Error loading pages:", error);
      setError(error.message);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let intervalId = null;

    const loadFilters = async () => {
      try {
        const response = await fetch("/api/filters", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (isMounted) {
          setFilterOptions(data);
        }
      } catch (error) {
        console.error("Error loading filters:", error);
        if (isMounted) {
          setFilterOptions({ clients: [], projects: [], environments: [] });
        }
      }
    };

    // Initial load
    const initialize = async () => {
      setLoading(true);
      await Promise.all([loadFilters(), loadPages()]);
      
      // Set up polling every 30 seconds
      intervalId = setInterval(() => {
        loadPages(false);
      }, 30000);
    };

    initialize();

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const loadHistory = async () => {
      try {
        setLoadingHistory(true);
        const response = await fetch(`/api/history/${selectedId}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setHistory((prev) => {
          const next = new Map(prev);
          next.set(selectedId, data.results || []);
          return next;
        });
      } catch (error) {
        console.error("Error loading history:", error);
        setHistory((prev) => {
          const next = new Map(prev);
          next.set(selectedId, []);
          return next;
        });
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [selectedId]);

  return (
    <main className="container">
      <header>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1>Landing Page Downtime Detector</h1>
            <p>Real-time monitoring for landing pages.</p>
            {lastUpdate && (
              <p className="last-update">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={() => loadPages(true)}
            disabled={refreshing}
            className="btn-primary"
          >
            <svg className={refreshing ? "icon-spin" : ""} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.67-1.35"/></svg>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-alert">
          <strong>Error:</strong> {error}. Please refresh the page.
        </div>
      )}

      <section className="filters-panel">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="all">All</option>
              <option value="down">Down only</option>
              <option value="dns">DNS issues</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Client</label>
            <select
              value={filters.client}
              onChange={(event) => setFilters((prev) => ({ ...prev, client: event.target.value }))}
            >
              <option value="all">All clients</option>
              {filterOptions.clients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Project</label>
            <select
              value={filters.project}
              onChange={(event) => setFilters((prev) => ({ ...prev, project: event.target.value }))}
            >
              <option value="all">All projects</option>
              {filterOptions.projects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Environment</label>
            <select
              value={filters.environment}
              onChange={(event) => setFilters((prev) => ({ ...prev, environment: event.target.value }))}
            >
              <option value="all">All environments</option>
              {filterOptions.environments.map((environment) => (
                <option key={environment} value={environment}>
                  {environment}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="glass-table-wrapper">
        {loading ? (
          <div className="state-message">
            <p>Loading landing pages...</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Environment</th>
                <th>Status</th>
                <th>Uptime</th>
                <th>Failure Reason</th>
                <th>Last Checked</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="state-message">
                    {pages.length === 0 ? "No landing pages configured." : "No matching landing pages."}
                  </td>
                </tr>
              ) : (
                filteredPages.map((page) => (
                <tr key={page.id} onClick={() => setSelectedId(page.id)}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div className="domain-name">{page.domain}</div>
                      <button
                        className="copy-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(page.domain);
                          setToast("Link copied to clipboard");
                          setTimeout(() => setToast(null), 3000);
                        }}
                        title="Copy to clipboard"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      </button>
                    </div>
                    <div className="muted">
                      {page.client} • {page.project}
                    </div>
                  </td>
                  <td>{page.environment}</td>
                  <td>{createBadge(page.status)}</td>
                  <td>{page.uptime !== null ? `${page.uptime}%` : "–"}</td>
                  <td>{page.reason}</td>
                  <td>{formatTime(page.lastChecked)}</td>
                  <td>
                    <span className={`risk ${page.risk ? page.risk.toLowerCase() : 'unknown'}`}>{page.risk || 'Unknown'}</span>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className="glass-panel" id="detailsPanel">
        <h2>Latest Check Details</h2>
        {loadingHistory ? (
          <div className="state-message">Loading history...</div>
        ) : !selectedPage ? (
          <div className="state-message">Select a landing page to inspect the most recent check.</div>
        ) : !latestRecord ? (
          <div className="state-message">No checks have completed yet.</div>
        ) : (
          <div className="detail-grid">
            <div className="detail-card">
              <h3>{selectedPage.domain}</h3>
              <p>
                <strong>Environment:</strong> {selectedPage.environment}
              </p>
              <p>
                <strong>Status:</strong> {selectedPage.status}
              </p>
              <p>
                <strong>Reason:</strong> {selectedPage.reason}
              </p>
              <p>
                <strong>Last Checked:</strong> {selectedPage.lastChecked ? new Date(selectedPage.lastChecked).toLocaleString() : "Never"}
              </p>
            </div>
            <div className="detail-card">
              <h4>DNS Check</h4>
              <p>
                <strong>Type:</strong> {latestRecord.dns?.type || "N/A"}
              </p>
              <p>
                <strong>Result:</strong> {latestRecord.dns?.details || "N/A"}
              </p>
              <h4>HTTP Check</h4>
              <p>
                <strong>Result:</strong> {latestRecord.http?.reason || "N/A"}
              </p>
            </div>
          </div>
        )}
      </section>

      {toast && (
        <div className="toast-notification">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          {toast}
        </div>
      )}
    </main>
  );
}

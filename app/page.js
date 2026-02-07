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
  if (status === "LIVE") return <span className="badge live">🟢 Live</span>;
  if (status === "DOWN") return <span className="badge down">🔴 Down</span>;
  return <span className="badge unknown">🟡 Unknown</span>;
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
              <p className="last-update" style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.5rem" }}>
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={() => loadPages(true)}
            disabled={refreshing}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: refreshing ? "not-allowed" : "pointer",
              opacity: refreshing ? 0.6 : 1
            }}
          >
            {refreshing ? "Refreshing..." : "🔄 Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div style={{ 
          padding: "1rem", 
          margin: "1rem 0", 
          backgroundColor: "#fee", 
          border: "1px solid #fcc", 
          borderRadius: "4px",
          color: "#c33"
        }}>
          <strong>Error:</strong> {error}. Please refresh the page.
        </div>
      )}

      <section className="filters">
        <label>
          Status
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="all">All</option>
            <option value="down">Down only</option>
            <option value="dns">DNS issues</option>
          </select>
        </label>
        <label>
          Client
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
        </label>
        <label>
          Project
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
        </label>
        <label>
          Environment
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
        </label>
      </section>

      <section className="table-wrapper">
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center" }}>
            <p>Loading landing pages...</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Environment</th>
                <th>Status</th>
                <th>Failure Reason</th>
                <th>Last Checked</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    {pages.length === 0 ? "No landing pages configured." : "No matching landing pages."}
                  </td>
                </tr>
              ) : (
                filteredPages.map((page) => (
                <tr key={page.id} onClick={() => setSelectedId(page.id)}>
                  <td>
                    <strong>{page.domain}</strong>
                    <div className="muted">
                      {page.client} • {page.project}
                    </div>
                  </td>
                  <td>{page.environment}</td>
                  <td>{createBadge(page.status)}</td>
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

      <section className="panel" id="detailsPanel">
        <h2>Latest Check Details</h2>
        {loadingHistory ? (
          <div>Loading history...</div>
        ) : !selectedPage ? (
          <div>Select a landing page to inspect the most recent check.</div>
        ) : !latestRecord ? (
          <div>No checks have completed yet.</div>
        ) : (
          <div className="detail-grid">
            <div>
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
            <div>
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
    </main>
  );
}

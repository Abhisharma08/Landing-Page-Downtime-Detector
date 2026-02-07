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

  const filteredPages = useMemo(() => {
    return pages.filter((page) => {
      if (filters.status === "down" && page.status !== "DOWN") return false;
      if (filters.status === "dns" && !page.reason.toLowerCase().includes("dns")) return false;
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

  useEffect(() => {
    const loadFilters = async () => {
      const response = await fetch("/api/filters");
      const data = await response.json();
      setFilterOptions(data);
    };

    const loadPages = async () => {
      const response = await fetch("/api/pages");
      const data = await response.json();
      setPages(data.results);
    };

    loadFilters();
    loadPages();
    const interval = setInterval(loadPages, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const loadHistory = async () => {
      const response = await fetch(`/api/history/${selectedId}`);
      const data = await response.json();
      setHistory((prev) => {
        const next = new Map(prev);
        next.set(selectedId, data.results);
        return next;
      });
    };
    loadHistory();
  }, [selectedId]);

  return (
    <main className="container">
      <header>
        <h1>Landing Page Downtime Detector</h1>
        <p>Real-time monitoring for Vercel-hosted landing pages.</p>
      </header>

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
                  No matching landing pages.
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
                    <span className={`risk ${page.risk.toLowerCase()}`}>{page.risk}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="panel" id="detailsPanel">
        <h2>Latest Check Details</h2>
        {!selectedPage ? (
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
                <strong>Last Checked:</strong> {new Date(selectedPage.lastChecked).toLocaleString()}
              </p>
            </div>
            <div>
              <h4>DNS Check</h4>
              <p>
                <strong>Type:</strong> {latestRecord.dns.type}
              </p>
              <p>
                <strong>Result:</strong> {latestRecord.dns.details}
              </p>
              <h4>HTTP Check</h4>
              <p>
                <strong>Result:</strong> {latestRecord.http.reason}
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

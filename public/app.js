const statusTable = document.getElementById("statusTable");
const detailContent = document.getElementById("detailContent");
const statusFilter = document.getElementById("statusFilter");
const clientFilter = document.getElementById("clientFilter");
const projectFilter = document.getElementById("projectFilter");
const environmentFilter = document.getElementById("environmentFilter");

const state = {
  pages: [],
  history: new Map()
};

const formatTime = (isoString) => {
  if (!isoString) return "–";
  const deltaMinutes = Math.round((Date.now() - Date.parse(isoString)) / 60000);
  if (Number.isNaN(deltaMinutes)) return "–";
  return deltaMinutes === 0 ? "Just now" : `${deltaMinutes} min${deltaMinutes === 1 ? "" : "s"} ago`;
};

const createBadge = (status) => {
  if (status === "LIVE") return `<span class="badge live">🟢 Live</span>`;
  if (status === "DOWN") return `<span class="badge down">🔴 Down</span>`;
  return `<span class="badge unknown">🟡 Unknown</span>`;
};

const renderTable = () => {
  const statusValue = statusFilter.value;
  const clientValue = clientFilter.value;
  const projectValue = projectFilter.value;
  const environmentValue = environmentFilter.value;

  const rows = state.pages
    .filter((page) => {
      if (statusValue === "down" && page.status !== "DOWN") return false;
      if (statusValue === "dns" && !page.reason.toLowerCase().includes("dns")) return false;
      if (clientValue !== "all" && page.client !== clientValue) return false;
      if (projectValue !== "all" && page.project !== projectValue) return false;
      if (environmentValue !== "all" && page.environment !== environmentValue) return false;
      return true;
    })
    .map((page) => {
      const lastChecked = formatTime(page.lastChecked);
      return `
        <tr data-id="${page.id}">
          <td>
            <strong>${page.domain}</strong>
            <div class="muted">${page.client} • ${page.project}</div>
          </td>
          <td>${page.environment}</td>
          <td>${createBadge(page.status)}</td>
          <td>${page.reason}</td>
          <td>${lastChecked}</td>
          <td><span class="risk ${page.risk.toLowerCase()}">${page.risk}</span></td>
        </tr>
      `;
    })
    .join("");

  statusTable.innerHTML = rows || `<tr><td colspan="6" class="empty">No matching landing pages.</td></tr>`;
};

const renderDetails = (pageId) => {
  const page = state.pages.find((item) => item.id === pageId);
  if (!page) return;

  const records = state.history.get(pageId) ?? [];
  const latest = records[0];

  if (!latest) {
    detailContent.innerHTML = "No checks have completed yet.";
    return;
  }

  detailContent.innerHTML = `
    <div class="detail-grid">
      <div>
        <h3>${page.domain}</h3>
        <p><strong>Environment:</strong> ${page.environment}</p>
        <p><strong>Status:</strong> ${page.status}</p>
        <p><strong>Reason:</strong> ${page.reason}</p>
        <p><strong>Last Checked:</strong> ${new Date(page.lastChecked).toLocaleString()}</p>
      </div>
      <div>
        <h4>DNS Check</h4>
        <p><strong>Type:</strong> ${latest.dns.type}</p>
        <p><strong>Result:</strong> ${latest.dns.details}</p>
        <h4>HTTP Check</h4>
        <p><strong>Result:</strong> ${latest.http.reason}</p>
      </div>
    </div>
  `;
};

const loadFilters = async () => {
  const response = await fetch("/api/filters");
  const data = await response.json();
  data.clients.forEach((client) => {
    const option = document.createElement("option");
    option.value = client;
    option.textContent = client;
    clientFilter.appendChild(option);
  });
  data.projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project;
    option.textContent = project;
    projectFilter.appendChild(option);
  });
  data.environments.forEach((environment) => {
    const option = document.createElement("option");
    option.value = environment;
    option.textContent = environment;
    environmentFilter.appendChild(option);
  });
};

const loadPages = async () => {
  const response = await fetch("/api/pages");
  const data = await response.json();
  state.pages = data.results;
  renderTable();
};

const loadHistory = async (pageId) => {
  const response = await fetch(`/api/history/${pageId}`);
  const data = await response.json();
  state.history.set(pageId, data.results);
  renderDetails(pageId);
};

statusTable.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  loadHistory(row.dataset.id);
});

[statusFilter, clientFilter, projectFilter, environmentFilter].forEach((select) => {
  select.addEventListener("change", renderTable);
});

loadFilters();
loadPages();
setInterval(loadPages, 30000);

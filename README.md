# Landing Page Downtime Detector

A lightweight monitoring dashboard for Vercel-hosted landing pages with client-managed DNS.

## Features

- Landing page registry with client and environment metadata.
- DNS validation for Vercel targets (`*.vercel-dns.com` or `76.76.21.21`).
- HTTPS checks for reachability, HTTP status, and SSL failures.
- Live dashboard with filters for status, DNS issues, client, project, and environment.
- History view for the most recent check per landing page.

## Getting Started

```bash
npm install
npm start
```

Open `http://localhost:3000` to view the dashboard.

## Configuration

Update the `landingPages` array in `server.js` with your production domains, client names, projects, and environments.

## Notes

- Health checks run every 5 minutes by default.
- The server stores history in memory (restart clears data). Add a database for long-term retention.
- Alerting channels can be added by hooking into the `performCheck` workflow in `server.js`.

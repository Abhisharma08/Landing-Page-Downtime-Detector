import { ensureMonitoring, getLandingPages } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export async function GET() {
  ensureMonitoring();
  const pages = getLandingPages();
  return Response.json({
    clients: [...new Set(pages.map((page) => page.client))],
    projects: [...new Set(pages.map((page) => page.project))],
    environments: [...new Set(pages.map((page) => page.environment))]
  });
}

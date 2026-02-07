import { ensureMonitoring, getLandingPages } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    ensureMonitoring();
    const pages = getLandingPages();
    return Response.json({
      clients: [...new Set(pages.map((page) => page.client).filter(Boolean))],
      projects: [...new Set(pages.map((page) => page.project).filter(Boolean))],
      environments: [...new Set(pages.map((page) => page.environment).filter(Boolean))]
    });
  } catch (error) {
    console.error("Error in /api/filters:", error);
    return Response.json({ clients: [], projects: [], environments: [], error: error.message }, { status: 500 });
  }
}

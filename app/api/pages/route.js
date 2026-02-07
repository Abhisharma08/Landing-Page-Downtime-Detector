import { ensureMonitoring, getLandingPages, getState } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export async function GET() {
  ensureMonitoring();
  const results = getLandingPages().map((page) => ({
    ...page,
    ...getState().get(page.id)
  }));

  return Response.json({ results });
}

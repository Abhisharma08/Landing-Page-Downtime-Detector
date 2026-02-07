import { ensureMonitoring, getHistory } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  ensureMonitoring();
  const entries = getHistory().get(params.id) ?? [];
  return Response.json({ results: entries });
}

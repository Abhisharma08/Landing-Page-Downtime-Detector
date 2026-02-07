import { ensureMonitoring, getHistory } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    ensureMonitoring();
    const entries = getHistory().get(params.id) ?? [];
    return Response.json({ results: entries });
  } catch (error) {
    console.error(`Error in /api/history/${params.id}:`, error);
    return Response.json({ results: [], error: error.message }, { status: 500 });
  }
}

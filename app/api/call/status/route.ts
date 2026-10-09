import { jsonOk } from "@/lib/apiHelpers";
import { lookupRoom } from "@/lib/roomLookup";

export const dynamic = "force-dynamic";

/**
 * GET /api/call/status: a safe health check for the video call setup.
 * Reports only yes/no style results (never keys or room data), so it can be
 * opened in a browser to see what's wrong on a deployment.
 */
export async function GET() {
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7);
  const key = process.env.DAILY_API_KEY;

  let daily: "ok" | "missing" | "rejected" | "unreachable" = "missing";
  if (key) {
    try {
      const res = await fetch(`${process.env.DAILY_API_URL || "https://api.daily.co/v1"}/rooms?limit=1`, {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      daily = res.ok ? "ok" : res.status === 401 || res.status === 403 ? "rejected" : "unreachable";
    } catch {
      daily = "unreachable";
    }
  }

  let supabase: "ok" | "error" = "ok";
  try {
    await lookupRoom("status-check-0000");
  } catch {
    supabase = "error";
  }

  return jsonOk({ commit, dailyApiKey: daily, roomLookup: supabase, ready: daily === "ok" && supabase === "ok" });
}

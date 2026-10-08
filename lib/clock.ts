import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Estimates (serverClock − localClock) in ms, NTP-style.
 *
 * India and Italy laptops/phones never agree exactly on the time. Every playback
 * event is stamped in *server* time, so each browser needs to know how far its
 * own clock is from the server's. We take a few samples and keep the one with
 * the smallest round-trip, which is the most accurate.
 */
export async function measureClockOffset(supabase: SupabaseClient, samples = 5): Promise<number> {
  let best: { rtt: number; offset: number } | null = null;

  for (let i = 0; i < samples; i++) {
    const t0 = Date.now();
    const { data, error } = await supabase.rpc("server_now");
    const t1 = Date.now();
    if (error || typeof data !== "number") continue;

    const rtt = t1 - t0;
    const offset = data - (t0 + t1) / 2;
    if (!best || rtt < best.rtt) best = { rtt, offset };
  }

  if (!best) throw new Error("Could not reach the server clock");
  return best.offset;
}

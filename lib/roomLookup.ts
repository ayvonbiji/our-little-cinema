import { createClient } from "@supabase/supabase-js";
import type { RoomRow } from "./types";

/**
 * Server-side room lookup that needs only the public (publishable) key: it calls
 * the same `get_room(code)` function the browser uses, which only answers for an
 * exact room code. No secret key is involved, so the call feature doesn't depend
 * on SUPABASE_SECRET_KEY being configured.
 */
export async function lookupRoom(code: string): Promise<RoomRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL / publishable key are not configured on the server.");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("get_room", { p_code: code });
  if (error) throw new Error(`Room lookup failed: ${error.message}`);
  return ((data as RoomRow[] | null) ?? [])[0] ?? null;
}

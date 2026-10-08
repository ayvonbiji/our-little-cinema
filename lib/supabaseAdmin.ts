import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RoomRow } from "./types";

/**
 * SERVER-ONLY Supabase client. It uses the secret key, which must never reach
 * the browser: it is read from SUPABASE_SECRET_KEY (no NEXT_PUBLIC_ prefix),
 * so Next.js never bundles it into client code.
 */
let admin: SupabaseClient | null = null;

export function getAdmin(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("supabaseAdmin is server-only");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Server is missing SUPABASE_SECRET_KEY. Add it in Vercel → Settings → Environment Variables.");
  }
  if (!admin) {
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

export async function getRoomRow(code: string): Promise<RoomRow | null> {
  const { data, error } = await getAdmin().rpc("get_room", { p_code: code });
  if (error) throw error;
  return ((data as RoomRow[] | null) ?? [])[0] ?? null;
}

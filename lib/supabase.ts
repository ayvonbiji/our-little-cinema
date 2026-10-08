import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes("YOUR-PROJECT"));

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Copy .env.example to .env.local and fill it in.");
  }
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: false },
      // Faster heartbeat = we notice a dropped connection sooner.
      realtime: { params: { eventsPerSecond: 20 }, heartbeatIntervalMs: 15000 },
    });
  }
  return client;
}

import { createHmac } from "crypto";

/**
 * SERVER-ONLY helpers for Daily (https://docs.daily.co/reference/rest-api).
 * The API key comes from DAILY_API_KEY (no NEXT_PUBLIC_ prefix), so it never
 * reaches the browser bundle.
 */

const API = process.env.DAILY_API_URL || "https://api.daily.co/v1";

/** How long a freshly issued meeting token can be used to *join* (not how long the call may last). */
export const CALL_TOKEN_SECONDS = 10 * 60;

export class DailyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function apiKey(): string {
  if (typeof window !== "undefined") throw new Error("lib/daily is server-only");
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new DailyError("Video calls aren't set up yet (DAILY_API_KEY is missing).", 503);
  return key;
}

export function isDailyConfigured(): boolean {
  return Boolean(process.env.DAILY_API_KEY);
}

/**
 * One Daily room per cinema room. The name is derived from the cinema code with
 * a keyed hash, so it is stable but can't be guessed from (or linked back to)
 * the cinema link.
 */
export function dailyRoomName(cinemaCode: string): string {
  const digest = createHmac("sha256", apiKey()).update(`olc-call:${cinemaCode}`).digest("hex");
  return `olc-${digest.slice(0, 28)}`;
}

async function daily<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", ...(init.headers || {}) },
    });
    const body = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, body };
  } catch (e) {
    if (e instanceof DailyError) throw e;
    throw new DailyError("The video call service can't be reached right now.", 502);
  } finally {
    clearTimeout(timer);
  }
}

interface DailyRoom {
  name: string;
  url: string;
  privacy: string;
  config?: { max_participants?: number; enable_knocking?: boolean };
}

/** Settings every cinema call room must have. */
export const ROOM_PROPERTIES = {
  max_participants: 2, // just the two of you
  enable_knocking: false, // no "ask to join" for people without a token
  enable_prejoin_ui: true, // camera/mic are requested on the pre-join screen, after you click
};

/** Create the private room if needed, and repair its settings if they ever drift. */
export async function ensurePrivateRoom(cinemaCode: string): Promise<DailyRoom> {
  const name = dailyRoomName(cinemaCode);
  const existing = await daily<DailyRoom & { error?: string }>(`/rooms/${name}`);

  if (existing.status === 200 && existing.body.url) {
    const c = existing.body.config ?? {};
    if (existing.body.privacy !== "private" || c.max_participants !== 2 || c.enable_knocking === true) {
      const fixed = await daily<DailyRoom>(`/rooms/${name}`, {
        method: "POST",
        body: JSON.stringify({ privacy: "private", properties: ROOM_PROPERTIES }),
      });
      if (fixed.status !== 200) throw new DailyError("Couldn't secure the call room.", 502);
      return fixed.body;
    }
    return existing.body;
  }
  if (existing.status === 401 || existing.status === 403) {
    throw new DailyError("The Daily API key was rejected. Check DAILY_API_KEY in Vercel.", 503);
  }

  const created = await daily<DailyRoom & { info?: string }>(`/rooms`, {
    method: "POST",
    body: JSON.stringify({ name, privacy: "private", properties: ROOM_PROPERTIES }),
  });
  if (created.status === 200 && created.body.url) return created.body;

  // Two people pressing "Start" at the same moment: the other request created it.
  const again = await daily<DailyRoom>(`/rooms/${name}`);
  if (again.status === 200 && again.body.url && again.body.privacy === "private") return again.body;
  throw new DailyError("Couldn't create the call room.", 502);
}

/** A meeting token for one named person, valid only for this room and only for a few minutes. */
export async function createMeetingToken(roomName: string, userName: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + CALL_TOKEN_SECONDS;
  const res = await daily<{ token?: string }>(`/meeting-tokens`, {
    method: "POST",
    body: JSON.stringify({
      properties: { room_name: roomName, user_name: userName, exp, is_owner: false },
    }),
  });
  if (res.status !== 200 || !res.body.token) throw new DailyError("Couldn't create a call pass.", 502);
  return res.body.token;
}

/**
 * Self-test against the real Daily API: create a throwaway private room with the
 * exact settings real calls use, issue a token for it, then delete it.
 * Proves the key, the room settings and token creation all work, without a call.
 */
export async function selfTest(): Promise<{ createRoom: string; createToken: string; deleteRoom: string; roomDomain?: string }> {
  const name = `olc-selftest-${Math.random().toString(36).slice(2, 10)}`;
  const out: { createRoom: string; createToken: string; deleteRoom: string; roomDomain?: string } = {
    createRoom: "not run",
    createToken: "not run",
    deleteRoom: "not run",
  };
  const created = await daily<DailyRoom & { info?: string; error?: string }>(`/rooms`, {
    method: "POST",
    body: JSON.stringify({ name, privacy: "private", properties: { ...ROOM_PROPERTIES, exp: Math.floor(Date.now() / 1000) + 300 } }),
  });
  if (created.status !== 200 || !created.body.url) {
    out.createRoom = `failed (${created.status}${created.body.info ? `: ${created.body.info}` : created.body.error ? `: ${created.body.error}` : ""})`;
    return out;
  }
  out.createRoom = `ok (privacy=${created.body.privacy}, max_participants=${created.body.config?.max_participants})`;
  out.roomDomain = new URL(created.body.url).host;
  try {
    await createMeetingToken(name, "SelfTest");
    out.createToken = "ok";
  } catch (e) {
    out.createToken = `failed (${e instanceof Error ? e.message : "error"})`;
  }
  const del = await daily<unknown>(`/rooms/${name}`, { method: "DELETE" });
  out.deleteRoom = del.status === 200 ? "ok" : `failed (${del.status})`;
  return out;
}

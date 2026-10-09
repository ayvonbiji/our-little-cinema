import { jsonOk } from "@/lib/apiHelpers";
import { lookupRoom } from "@/lib/roomLookup";
import { createMeetingToken, ensurePrivateRoom, selfTest } from "@/lib/daily";
import { ROOM_CODE_RE } from "@/lib/storageConfig";

export const dynamic = "force-dynamic";

/**
 * GET /api/call/status: a safe health check for the video call setup.
 * Reports only yes/no style results (never keys or room data), so it can be
 * opened in a browser to see what's wrong on a deployment.
 */
export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get("deep") === "1";
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

  // ?deep=1 → also create + delete a throwaway private room and issue a token.
  let selftest: Awaited<ReturnType<typeof selfTest>> | undefined;
  if (deep && daily === "ok") {
    try {
      selftest = await selfTest();
    } catch (e) {
      selftest = { createRoom: `error (${e instanceof Error ? e.message : "unknown"})`, createToken: "not run", deleteRoom: "not run" };
    }
  }
  // ?room=<code> → run the exact server path "Start Our Video Call" uses for that room
  // (room lookup → private Daily room → meeting token). Reports only ok / failed; the
  // token itself is discarded, never returned.
  const roomParam = (new URL(req.url).searchParams.get("room") || "").toLowerCase();
  let roomPath: Record<string, string> | undefined;
  if (roomParam && ROOM_CODE_RE.test(roomParam) && daily === "ok") {
    roomPath = { roomLookup: "not run", dailyRoom: "not run", meetingToken: "not run" };
    try {
      const room = await lookupRoom(roomParam);
      roomPath.roomLookup = room ? `ok (names: ${[room.names?.one, room.names?.two].filter(Boolean).length})` : "room not found";
      if (room) {
        const dr = await ensurePrivateRoom(roomParam);
        roomPath.dailyRoom = `ok (${dr.privacy}, max ${dr.config?.max_participants ?? "?"}, host ${new URL(dr.url).host})`;
        await createMeetingToken(dr.name, room.names?.one || "Ayvon");
        roomPath.meetingToken = "ok";
      }
    } catch (e) {
      const step = roomPath.roomLookup === "not run" ? "roomLookup" : roomPath.dailyRoom === "not run" ? "dailyRoom" : "meetingToken";
      roomPath[step] = `failed (${e instanceof Error ? e.message : "error"})`;
    }
  }

  const deepOk = !selftest || (selftest.createRoom.startsWith("ok") && selftest.createToken === "ok");
  return jsonOk({ commit, dailyApiKey: daily, roomLookup: supabase, selftest, roomPath, ready: daily === "ok" && supabase === "ok" && deepOk });
}

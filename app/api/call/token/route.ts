import { getRoomRow } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk } from "@/lib/apiHelpers";
import { ROOM_CODE_RE } from "@/lib/storageConfig";
import { DailyError, createMeetingToken, ensurePrivateRoom } from "@/lib/daily";

export const dynamic = "force-dynamic";

/**
 * POST { code, name } → { url, token }
 *
 * Issues a short-lived Daily meeting token for the cinema room's private call.
 * Access rules (the same "secret room link" model the rest of the app uses):
 *   • the cinema room must exist in Supabase,
 *   • the name must be one of that room's two names,
 *   • the Daily room is private (no token = no entry) and holds at most 2 people,
 *   • the token works only for that room and only for a few minutes.
 * The Daily API key never leaves the server.
 */
export async function POST(req: Request) {
  let body: { code?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request");
  }
  const code = typeof body.code === "string" ? body.code.toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!ROOM_CODE_RE.test(code)) return jsonError("Invalid room");
  if (!name || name.length > 40) return jsonError("Invalid name");

  try {
    const room = await getRoomRow(code);
    if (!room) return jsonError("Room not found", 404);
    const allowed = [room.names?.one, room.names?.two].filter(Boolean);
    if (!allowed.includes(name)) return jsonError("Only the two people of this room can join its call.", 403);

    const dailyRoom = await ensurePrivateRoom(code);
    const token = await createMeetingToken(dailyRoom.name, name);
    return jsonOk({ url: dailyRoom.url, token });
  } catch (e) {
    if (e instanceof DailyError) return jsonError(e.message, e.status);
    return jsonError("Couldn't start the call. Please try again.", 500);
  }
}

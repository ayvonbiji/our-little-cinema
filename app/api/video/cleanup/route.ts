import { getAdmin, getRoomRow } from "@/lib/supabaseAdmin";
import { errorMessage, jsonError, jsonOk } from "@/lib/apiHelpers";
import { ROOM_CODE_RE, VIDEO_BUCKET } from "@/lib/storageConfig";

export const dynamic = "force-dynamic";

/**
 * Deletes every file in the room's folder except the video the room is
 * currently showing (according to the database, not the browser). Called after
 * a video is replaced or removed, so old films don't fill up storage.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { code?: string };
    const code = String(body.code ?? "").toLowerCase();
    if (!ROOM_CODE_RE.test(code)) return jsonError("Invalid room code");

    const room = await getRoomRow(code);
    if (!room) return jsonError("Room not found", 404);

    const bucket = getAdmin().storage.from(VIDEO_BUCKET);
    const { data: files, error } = await bucket.list(code, { limit: 100 });
    if (error) return jsonError(errorMessage(error), 500);

    const keep = room.storage_path;
    const stale = (files ?? [])
      .filter((f) => f.name && f.id !== null)
      .map((f) => `${code}/${f.name}`)
      .filter((p) => p !== keep);

    if (stale.length) {
      const { error: delErr } = await bucket.remove(stale);
      if (delErr) return jsonError(errorMessage(delErr), 500);
    }
    return jsonOk({ removed: stale.length });
  } catch (e) {
    return jsonError(errorMessage(e), 500);
  }
}

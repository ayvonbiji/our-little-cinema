import { getAdmin, getRoomRow } from "@/lib/supabaseAdmin";
import { errorMessage, jsonError, jsonOk } from "@/lib/apiHelpers";
import { PLAYBACK_URL_SECONDS, VIDEO_BUCKET, isRoomPath } from "@/lib/storageConfig";

export const dynamic = "force-dynamic";

/**
 * Returns a signed, time-limited playback URL for a room's uploaded video.
 * Only works for a real room code and a file inside that room's folder,
 * so the room's secret link stays the only key to its video.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = (searchParams.get("code") ?? "").toLowerCase();
    const path = searchParams.get("path") ?? "";

    if (!isRoomPath(code, path)) return jsonError("Invalid video");
    const room = await getRoomRow(code);
    if (!room) return jsonError("Room not found", 404);

    const { data, error } = await getAdmin().storage.from(VIDEO_BUCKET).createSignedUrl(path, PLAYBACK_URL_SECONDS);
    if (error || !data) return jsonError(errorMessage(error) || "Video not found", 404);

    return jsonOk({ url: data.signedUrl, expiresAt: Date.now() + PLAYBACK_URL_SECONDS * 1000 });
  } catch (e) {
    return jsonError(errorMessage(e), 500);
  }
}

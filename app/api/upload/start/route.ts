import { getAdmin, getRoomRow } from "@/lib/supabaseAdmin";
import { errorMessage, jsonError, jsonOk } from "@/lib/apiHelpers";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, ROOM_CODE_RE, VIDEO_BUCKET, contentTypeFor, extensionOf } from "@/lib/storageConfig";

export const dynamic = "force-dynamic";

/**
 * Step 1 of an upload. The browser says "I want to upload this file to room X".
 * We check the room exists, pick a path inside the room's folder and return a
 * one-time signed upload token. The browser then sends the file straight to
 * Supabase Storage (in resumable 6 MB chunks); the video never passes through
 * this server.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
      fileName?: string;
      fileSize?: number;
      contentType?: string;
    };
    const code = String(body.code ?? "").toLowerCase();
    const fileName = String(body.fileName ?? "video.mp4").slice(0, 200);
    const fileSize = Number(body.fileSize ?? 0);

    if (!ROOM_CODE_RE.test(code)) return jsonError("Invalid room code");
    if (!fileSize || fileSize <= 0) return jsonError("Empty file");
    if (fileSize > MAX_UPLOAD_BYTES) return jsonError(`This video is larger than ${MAX_UPLOAD_MB} MB.`, 413);

    const room = await getRoomRow(code);
    if (!room) return jsonError("Room not found", 404);

    const rand = Math.random().toString(36).slice(2, 10);
    const path = `${code}/${Date.now()}-${rand}.${extensionOf(fileName)}`;

    const { data, error } = await getAdmin().storage.from(VIDEO_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return jsonError(errorMessage(error) || "Could not prepare upload", 500);

    return jsonOk({
      path,
      token: data.token,
      bucket: VIDEO_BUCKET,
      contentType: contentTypeFor(fileName, body.contentType),
    });
  } catch (e) {
    return jsonError(errorMessage(e), 500);
  }
}

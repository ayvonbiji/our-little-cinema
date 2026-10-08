/** Shared (browser + server) settings for uploaded room videos. */

export const VIDEO_BUCKET = "room-videos";

/**
 * Largest upload the app will accept, in MB.
 * Supabase Free projects are capped at 50 MB per file; on Pro you can raise
 * the project's global limit (Storage → Settings) and then this value.
 */
export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 50;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** How long a playback link stays valid. Long enough for any film. */
export const PLAYBACK_URL_SECONDS = 12 * 60 * 60;

export const ROOM_CODE_RE = /^[a-z0-9-]{6,64}$/;

/** A storage path belongs to a room only if it lives in that room's folder. */
export function isRoomPath(code: string, path: string): boolean {
  return (
    ROOM_CODE_RE.test(code) &&
    path.startsWith(`${code}/`) &&
    !path.includes("..") &&
    /^[a-z0-9-]+\/[A-Za-z0-9._-]+$/.test(path)
  );
}

const EXT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
};

export function extensionOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  return m ? m[1] : "mp4";
}

export function contentTypeFor(name: string, given?: string | null): string {
  if (given && given.startsWith("video/")) return given;
  return EXT_TYPES[extensionOf(name)] ?? "video/mp4";
}

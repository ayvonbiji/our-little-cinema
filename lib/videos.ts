import type { SourceType } from "./types";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, extensionOf } from "./storageConfig";

const BLOCKED_HOSTS = [
  "netflix.com",
  "primevideo.com",
  "amazon.",
  "disneyplus.com",
  "hotstar.com",
  "hulu.com",
  "max.com",
  "hbomax.com",
  "apple.com",
  "sonyliv.com",
  "zee5.com",
  "jiocinema.com",
];

export type UrlCheck =
  | { ok: true; sourceType: SourceType; url: string }
  | { ok: false; reason: string };

export function checkVideoUrl(raw: string): UrlCheck {
  const value = raw.trim();
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return { ok: false, reason: "That doesn't look like a link. It should start with https://" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { ok: false, reason: "Only http(s) links are supported." };
  }
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTS.some((h) => host.includes(h))) {
    return {
      ok: false,
      reason:
        "Streaming services like this one protect their videos with DRM, so no other website can play or sync them. Pick a direct video file instead.",
    };
  }
  if (host.includes("youtube.com") || host === "youtu.be") {
    return {
      ok: false,
      reason: "YouTube pages aren't direct video files. That's on the roadmap; for now use an .mp4, .webm or .m3u8 link.",
    };
  }
  const path = u.pathname.toLowerCase();
  if (path.endsWith(".m3u8")) return { ok: true, sourceType: "hls", url: value };
  return { ok: true, sourceType: "url", url: value };
}

export function isHls(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url, "http://x").pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return false;
  }
}

export function titleFromUrl(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop() || "Video";
    return decodeURIComponent(last).replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
  } catch {
    return "Video";
  }
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? h + ":" : ""}${mm}:${String(s).padStart(2, "0")}`;
}

// ── Uploads ──────────────────────────────────────────────────────────────

export type FileCheck =
  | { ok: true; warning: string | null }
  | { ok: false; reason: string };

const LIKELY_UNSUPPORTED = ["mkv", "avi", "wmv", "flv", "3gp", "ts", "mpg", "mpeg"];

/** Size limit + a gentle warning for formats browsers often can't play. */
export function checkVideoFile(file: File): FileCheck {
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: `This video is ${formatBytes(file.size)}. Uploads can be up to ${MAX_UPLOAD_MB} MB right now (see README to raise the limit).`,
    };
  }
  const ext = extensionOf(file.name);
  let playable = "";
  try {
    playable = file.type ? document.createElement("video").canPlayType(file.type) : "";
  } catch {
    playable = "";
  }
  const knownGood = ["mp4", "m4v", "webm", "mov"].includes(ext);
  if (LIKELY_UNSUPPORTED.includes(ext) || (!knownGood && !playable)) {
    return { ok: true, warning: "This video format may not be supported by your browser. MP4 is recommended." };
  }
  return { ok: true, warning: null };
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${Math.round(n / 1024 / 1024)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

// ── Our Call ─────────────────────────────────────────────────────────────

export type MeetingCheck = { ok: true; url: string; service: string } | { ok: false; reason: string };

const MEETING_HOSTS: { re: RegExp; service: string }[] = [
  { re: /(^|\.)meet\.google\.com$/, service: "Google Meet" },
  { re: /(^|\.)teams\.microsoft\.com$/, service: "Microsoft Teams" },
  { re: /(^|\.)teams\.live\.com$/, service: "Microsoft Teams" },
  { re: /(^|\.)zoom\.us$/, service: "Zoom" },
  { re: /(^|\.)zoom\.com$/, service: "Zoom" },
];

export function checkMeetingUrl(raw: string): MeetingCheck {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "Paste the full link, starting with https://" };
  }
  const hit = MEETING_HOSTS.find((h) => h.re.test(u.hostname.toLowerCase()));
  if (u.protocol !== "https:" || !hit) {
    return { ok: false, reason: "Paste a Google Meet, Microsoft Teams or Zoom link." };
  }
  return { ok: true, url: u.toString(), service: hit.service };
}

export function meetingService(url: string | null): string {
  if (!url) return "";
  const c = checkMeetingUrl(url);
  return c.ok ? c.service : "call";
}

/**
 * For classic Teams links, the same meeting can be opened straight in the Teams
 * desktop app with the msteams: scheme (handy when the browser can't show it).
 */
export function teamsAppLink(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase() === "teams.microsoft.com" && u.pathname.startsWith("/l/")) {
      return `msteams:${u.pathname}${u.search}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

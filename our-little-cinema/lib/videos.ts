import type { SourceType } from "./types";

export interface LibraryVideo {
  id: string;
  title: string;
  year: string;
  duration: string;
  description: string;
  url: string;
  poster: string;
  license: string;
}

/**
 * Free, legally shareable short films from the Blender Foundation
 * (Creative Commons Attribution). Hosted on Google's public sample bucket.
 * Swap these for your own legally owned videos any time.
 */
export const LIBRARY: LibraryVideo[] = [
  {
    id: "sintel",
    title: "Sintel",
    year: "2010",
    duration: "15 min",
    description: "A lonely girl searches the world for the baby dragon she once raised.",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    poster: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg",
    license: "© Blender Foundation · CC BY 3.0",
  },
  {
    id: "tears-of-steel",
    title: "Tears of Steel",
    year: "2012",
    duration: "12 min",
    description: "A sci-fi love story in Amsterdam: a broken-up couple and a robot future.",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    poster: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg",
    license: "© Blender Foundation · CC BY 3.0",
  },
  {
    id: "big-buck-bunny",
    title: "Big Buck Bunny",
    year: "2008",
    duration: "10 min",
    description: "A gentle giant rabbit gets his sweet revenge on three bullies.",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    poster: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
    license: "© Blender Foundation · CC BY 3.0",
  },
  {
    id: "elephants-dream",
    title: "Elephants Dream",
    year: "2006",
    duration: "11 min",
    description: "Two strange men explore an endless, surreal machine.",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    poster: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg",
    license: "© Blender Foundation · CC BY 2.5",
  },
];

/** Plays from your own deployment if you drop a file in /public/videos (see README). */
export const LOCAL_SAMPLE_URL = "/videos/sample.mp4";

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

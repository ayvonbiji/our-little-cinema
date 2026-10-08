"use client";

import { Upload } from "tus-js-client";
import { contentTypeFor } from "./storageConfig";

export interface UploadHandle {
  promise: Promise<{ path: string }>;
  cancel: () => void;
}

/**
 * Supabase recommends the direct storage hostname for large uploads:
 * https://<ref>.supabase.co → https://<ref>.storage.supabase.co
 */
function storageBase(projectUrl: string): string {
  const m = projectUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return m ? `https://${m[1]}.storage.supabase.co` : projectUrl.replace(/\/$/, "");
}

/**
 * Uploads a video straight from the browser to the room's private storage folder.
 *  1. Our server checks the room and hands out a one-time signed upload token.
 *  2. The file goes to Supabase Storage with the TUS resumable protocol, in 6 MB
 *     chunks read from disk one at a time, so even large films never sit in memory,
 *     and a dropped connection resumes instead of starting over.
 */
export function uploadVideo(code: string, file: File, onProgress: (pct: number) => void): UploadHandle {
  let tus: Upload | null = null;
  let cancelled = false;
  let resumes = 0;
  let rejectUpload: ((e: Error) => void) | null = null;

  const promise = (async () => {
    const res = await fetch("/api/upload/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, fileName: file.name, fileSize: file.size, contentType: file.type }),
    });
    const start = (await res.json().catch(() => ({}))) as {
      path?: string;
      token?: string;
      bucket?: string;
      contentType?: string;
      error?: string;
    };
    if (!res.ok || !start.path || !start.token) throw new Error(start.error || "Could not start the upload");
    if (cancelled) throw new Error("cancelled");

    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    await new Promise<void>((resolve, reject) => {
      rejectUpload = reject;
      tus = new Upload(file, {
        endpoint: `${storageBase(projectUrl)}/storage/v1/upload/resumable/sign`,
        retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
        headers: { apikey, "x-signature": start.token!, "x-upsert": "false" },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024, // Supabase requires exactly 6 MB chunks
        metadata: {
          bucketName: start.bucket!,
          objectName: start.path!,
          contentType: start.contentType || contentTypeFor(file.name, file.type),
          cacheControl: "3600",
        },
        onProgress: (sent, total) => onProgress(total ? Math.min(99.5, (sent / total) * 100) : 0),
        // Retry network/server errors even if the browser briefly reports "offline"
        // (tus gives up immediately while offline by default).
        onShouldRetry: (err) => {
          const status = err.originalResponse ? err.originalResponse.getStatus() : 0;
          return status === 0 || status >= 500 || status === 409 || status === 423;
        },
        onSuccess: () => resolve(),
        onError: (err) => {
          const status = (err as { originalResponse?: { getStatus(): number } | null }).originalResponse?.getStatus() ?? 0;
          const transient = status === 0 || status >= 500;
          if (cancelled || !transient || resumes >= 30) return reject(err);
          // Connection dropped for longer than the retry schedule: wait until
          // we're back online, then continue from the last finished chunk.
          resumes++;
          const resume = () => {
            window.removeEventListener("online", resume);
            if (!cancelled) setTimeout(() => tus?.start(), 1000);
          };
          if (navigator.onLine) setTimeout(resume, 3000);
          else window.addEventListener("online", resume);
        },
      });
      tus.start();
    });

    onProgress(100);
    return { path: start.path };
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      tus?.abort(true).catch(() => {});
      rejectUpload?.(new Error("cancelled"));
    },
  };
}

/** Friendly text for an upload error. */
export function uploadErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/413|too large|exceeded the maximum|Payload too large/i.test(msg)) {
    return "This video is bigger than your storage plan allows per file.";
  }
  if (/mime|not supported/i.test(msg)) return "This file type isn't allowed. Please choose a video file.";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "The connection dropped. Check your internet and try again.";
  return msg.length > 160 ? "The upload failed. Please try again." : msg;
}

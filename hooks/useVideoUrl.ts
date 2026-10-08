"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Turns the room's uploaded-video path into a playable, signed URL from our server.
 * The URL lasts 12 hours. If it ever stops working (expired, network hiccup),
 * `refresh()` gets a new one and the player re-syncs to the shared position.
 */
export function useVideoUrl(code: string, storagePath: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    if (!storagePath) {
      setUrl(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(`/api/video/url?code=${encodeURIComponent(code)}&path=${encodeURIComponent(storagePath)}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (id !== reqId.current) return;
        if (res.ok && data.url) {
          setUrl(data.url);
          setLoading(false);
          return;
        }
        if (res.status === 400) {
          setError(data.error || "This video can't be opened.");
          break;
        }
      } catch {
        /* network blip: retry */
      }
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      if (id !== reqId.current) return;
    }
    if (id === reqId.current) {
      setLoading(false);
      setError((e) => e ?? "Couldn't reach the video. Check the connection and try again.");
    }
  }, [code, storagePath]);

  useEffect(() => {
    setUrl(null);
    load();
  }, [load]);

  return { url, error, loading, refresh: load };
}

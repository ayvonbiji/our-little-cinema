"use client";

import { useState } from "react";
import { LIBRARY, LOCAL_SAMPLE_URL, checkVideoUrl, titleFromUrl } from "@/lib/videos";
import type { SourceType } from "@/lib/types";
import { CloseIcon } from "./Icons";

export interface MovieChoice {
  videoUrl: string | null;
  videoTitle: string;
  sourceType: SourceType;
  localFile?: File;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onChoose: (choice: MovieChoice) => void;
}

type Tab = "library" | "link" | "file";

export default function MoviePicker({ open, onClose, onChoose }: Props) {
  const [tab, setTab] = useState<Tab>("library");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submitLink = (e: React.FormEvent) => {
    e.preventDefault();
    const check = checkVideoUrl(url);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    onChoose({ videoUrl: check.url, sourceType: check.sourceType, videoTitle: title.trim() || titleFromUrl(check.url) });
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "library", label: "Free films" },
    { id: "link", label: "Video link" },
    { id: "file", label: "Our own file" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm animate-fadeIn sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="panel scroll-soft max-h-[92svh] w-full max-w-3xl overflow-y-auto rounded-b-none bg-ink-900/95 p-5 sm:rounded-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Tonight&apos;s feature</p>
            <h2 className="mt-1 font-display text-3xl text-cream">Choose a movie</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-cream/60 hover:bg-white/10 hover:text-cream" aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="mt-5 flex gap-1 rounded-full bg-white/[0.04] p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setError(null);
              }}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                tab === t.id ? "bg-wine-500 text-white" : "text-cream/60 hover:text-cream"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "library" && (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {LIBRARY.map((v) => (
              <button
                key={v.id}
                onClick={() => onChoose({ videoUrl: v.url, videoTitle: v.title, sourceType: "library" })}
                className="group overflow-hidden rounded-xl border border-white/[0.06] bg-ink-850 text-left transition hover:border-wine-400/50"
              >
                <div className="relative aspect-video overflow-hidden bg-ink-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.poster} alt="" loading="lazy" className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <p className="absolute bottom-2 left-3 font-display text-xl text-cream">{v.title}</p>
                </div>
                <div className="p-3">
                  <p className="text-[13px] leading-snug text-cream/70">{v.description}</p>
                  <p className="mt-1.5 text-[11px] text-cream/40">
                    {v.year} · {v.duration} · {v.license}
                  </p>
                </div>
              </button>
            ))}
            <button
              onClick={() => onChoose({ videoUrl: LOCAL_SAMPLE_URL, videoTitle: "Our sample video", sourceType: "url" })}
              className="rounded-xl border border-dashed border-white/10 p-4 text-left text-sm text-cream/60 transition hover:border-wine-400/50 hover:text-cream sm:col-span-2"
            >
              <span className="font-medium text-cream/85">Sample video on this site</span>: plays{" "}
              <code className="text-wine-300">/videos/sample.mp4</code> if you&apos;ve added one (see README).
            </button>
          </div>
        )}

        {tab === "link" && (
          <form onSubmit={submitLink} className="mt-5 space-y-3">
            <input className="field" placeholder="https://…/movie.mp4  or  …/stream.m3u8" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
            <input className="field" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
            {error && <p className="text-sm text-wine-300">{error}</p>}
            <button type="submit" className="btn-primary w-full sm:w-auto">
              Play this for both of us
            </button>
            <p className="text-[13px] leading-relaxed text-cream/45">
              Works with direct <b>.mp4 / .webm</b> files and <b>.m3u8</b> streams you have the right to watch: your own cloud storage,
              public-domain archives, Creative Commons films, a video you host yourself.
            </p>
          </form>
        )}

        {tab === "file" && (
          <div className="mt-5 space-y-4 text-sm leading-relaxed text-cream/70">
            <p>
              Both of you have the same video file (a movie you bought as a download, home videos, a film you made)? Each of you opens{" "}
              <b>your own copy</b>. Nothing is uploaded. Only play, pause and the time are shared, so it stays perfectly in sync.
            </p>
            <label className="btn-primary cursor-pointer">
              Choose my copy
              <input
                type="file"
                accept="video/*,.mkv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onChoose({ videoUrl: null, videoTitle: f.name.replace(/\.[a-z0-9]+$/i, ""), sourceType: "local", localFile: f });
                }}
              />
            </label>
            <p className="text-[13px] text-cream/45">Your partner will be asked to pick their copy of the same file.</p>
          </div>
        )}

        <div className="mt-7 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-[12.5px] leading-relaxed text-cream/50">
          <b className="text-cream/70">Why not Netflix, Prime Video or Disney+?</b> Their films are protected with DRM and can only play inside
          their own apps, so no other website can legally load or sync them. For those, use their built-in group watch where one
          exists, or press play together on a call. This cinema is for videos you&apos;re free to play directly.
        </div>
      </div>
    </div>
  );
}

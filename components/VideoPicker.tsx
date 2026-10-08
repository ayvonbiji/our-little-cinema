"use client";

import { useEffect, useRef, useState } from "react";
import { checkVideoFile, checkVideoUrl, formatBytes, titleFromUrl } from "@/lib/videos";
import { MAX_UPLOAD_MB } from "@/lib/storageConfig";
import type { SourceType } from "@/lib/types";
import { CloseIcon, PlayIcon } from "./Icons";

export interface LinkChoice {
  videoUrl: string;
  videoTitle: string;
  sourceType: SourceType;
}

interface Props {
  open: boolean;
  onClose: () => void;
  currentTitle: string | null;
  isPlaying: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
  onChooseLink: (choice: LinkChoice) => void;
  onPlay: () => void;
  onRemove: () => void;
}

const UploadIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
);

const LinkIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </svg>
);

export default function VideoPicker({ open, onClose, currentTitle, isPlaying, uploading, onUpload, onChooseLink, onPlay, onRemove }: Props) {
  const [mode, setMode] = useState<"choose" | "link">("choose");
  const [showOptions, setShowOptions] = useState(!currentTitle);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: File; warning: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMode("choose");
      setShowOptions(!currentTitle);
      setError(null);
      setPending(null);
    }
  }, [open, currentTitle]);

  if (!open) return null;

  const pickFile = (file: File) => {
    setError(null);
    const check = checkVideoFile(file);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    if (check.warning) {
      setPending({ file, warning: check.warning });
      return;
    }
    onUpload(file);
  };

  const submitLink = (e: React.FormEvent) => {
    e.preventDefault();
    const check = checkVideoUrl(url);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    onChooseLink({ videoUrl: check.url, sourceType: check.sourceType, videoTitle: title.trim() || titleFromUrl(check.url) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fadeIn sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="panel scroll-soft max-h-[92svh] w-full max-w-xl overflow-y-auto rounded-b-none bg-ink-900/95 p-5 sm:rounded-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Tonight</p>
            <h2 className="mt-1 font-display text-3xl text-cream">What are we watching?</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-cream/60 hover:bg-white/10 hover:text-cream" aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {/* Currently watching */}
        {currentTitle && (
          <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            <p className="eyebrow">Currently watching</p>
            <p className="mt-1 truncate font-display text-xl text-cream">{currentTitle}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!isPlaying && (
                <button className="btn-chip border-wine-500/50 bg-wine-500/15" onClick={onPlay}>
                  <PlayIcon className="h-4 w-4" /> Play
                </button>
              )}
              <button className="btn-chip" onClick={() => setShowOptions(true)} disabled={uploading}>
                Change Video
              </button>
              <button className="btn-chip hover:border-white/30 hover:bg-white/10" onClick={onRemove} disabled={uploading}>
                Remove Video
              </button>
            </div>
          </div>
        )}

        {showOptions && mode === "choose" && !pending && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="group flex flex-col items-start gap-3 rounded-xl border border-wine-500/40 bg-wine-500/[0.08] p-5 text-left transition hover:border-wine-400 hover:bg-wine-500/15 disabled:opacity-50"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-wine-500 text-white shadow-[0_8px_30px_-8px_rgba(197,58,79,0.8)]">
                <UploadIcon />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-cream">Upload a Video</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-cream/60">Upload a video for both of us to watch.</span>
              </span>
              <span className="text-[11px] text-cream/35">MP4 recommended · up to {MAX_UPLOAD_MB} MB</span>
            </button>
            <button
              onClick={() => {
                setMode("link");
                setError(null);
              }}
              className="flex flex-col items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 text-left transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.08] text-cream">
                <LinkIcon />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-cream">Video Link</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-cream/60">Paste a direct video URL.</span>
              </span>
              <span className="text-[11px] text-cream/35">.mp4 · .webm · .m3u8</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="video/*,.mp4,.m4v,.mov,.webm"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) pickFile(f);
              }}
            />
          </div>
        )}

        {/* Format warning */}
        {pending && (
          <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-sm text-cream/80">
            <p>{pending.warning}</p>
            <p className="mt-1 text-[12px] text-cream/45">
              {pending.file.name} · {formatBytes(pending.file.size)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn-chip border-wine-500/50 bg-wine-500/15"
                onClick={() => {
                  const f = pending.file;
                  setPending(null);
                  onUpload(f);
                }}
              >
                Upload anyway
              </button>
              <button
                className="btn-chip"
                onClick={() => {
                  setPending(null);
                  fileRef.current?.click();
                }}
              >
                Choose another
              </button>
            </div>
          </div>
        )}

        {showOptions && mode === "link" && (
          <form onSubmit={submitLink} className="mt-5 space-y-3">
            <input className="field" placeholder="https://…/video.mp4" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
            <input className="field" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary">
                Watch this together
              </button>
              <button type="button" className="btn-ghost" onClick={() => setMode("choose")}>
                Back
              </button>
            </div>
            <p className="text-[12.5px] leading-relaxed text-cream/45">
              Direct <b>.mp4 / .webm</b> files or <b>.m3u8</b> streams you have the right to watch. Netflix, Prime Video and Disney+ links
              can&apos;t be played on other websites because of DRM.
            </p>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-wine-300">{error}</p>}
      </div>
    </div>
  );
}

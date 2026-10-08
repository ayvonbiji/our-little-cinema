"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type Hls from "hls.js";
import type { FloatingReaction, RoomState } from "@/lib/types";
import { formatTime, isHls } from "@/lib/videos";
import { getSavedVolume, saveVolume } from "@/lib/identity";
import {
  BackIcon,
  FilmIcon,
  ForwardIcon,
  FullscreenIcon,
  PauseIcon,
  PlayIcon,
  VolumeIcon,
} from "./Icons";
import FloatingReactions from "./FloatingReactions";

/** Small differences are corrected by gently speeding up / slowing down; big ones by jumping. */
const HARD_SEEK_THRESHOLD = 1.2; // seconds
const SOFT_DRIFT_THRESHOLD = 0.15; // seconds
const APPLY_SEEK_THRESHOLD = 0.4; // seconds, when a new event arrives

interface Props {
  room: RoomState;
  serverNow: () => number;
  /** Playable URL (a signed cloud URL for uploads, or the pasted link). */
  src: string | null;
  /** Still fetching the playable URL. */
  srcPending?: boolean;
  /** Shown over the video instead of the empty state (e.g. upload progress). */
  overlay?: ReactNode;
  /** Small note in the top bar, e.g. "Ayvon is uploading… 45%". */
  notice?: string | null;
  /** Called when the video fails to load. Return true if a retry was started. */
  onSourceError?: () => boolean;
  reactions: FloatingReaction[];
  partnerBuffering: string | null;
  onPlay: (position: number) => void;
  onPause: (position: number) => void;
  onSeek: (position: number) => void;
  onBuffering: (buffering: boolean) => void;
  onDrift: (drift: number | null) => void;
  onOpenPicker: () => void;
}

type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };
type FsDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
type IOSVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export default function VideoPlayer({
  room,
  serverNow,
  src,
  srcPending = false,
  overlay,
  notice,
  onSourceError,
  reactions,
  partnerBuffering,
  onPlay,
  onPause,
  onSeek,
  onBuffering,
  onDrift,
  onOpenPicker,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;

  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<number | undefined>(undefined);


  /** Where the shared clock says the video should be right now. */
  const expectedPosition = useCallback(() => {
    const s = roomRef.current;
    if (!s.isPlaying) return s.position;
    return s.position + (Math.max(0, serverNow() - s.updatedAt) / 1000) * s.rate;
  }, [serverNow]);

  // ── Load the source ──────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    setReady(false);
    setLoadError(null);
    setCurrent(0);
    setDuration(0);
    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (!src) {
      v.removeAttribute("src");
      v.load();
      return;
    }

    if (isHls(src) && !v.canPlayType("application/vnd.apple.mpegurl")) {
      import("hls.js").then(({ default: HlsLib }) => {
        if (cancelled) return;
        if (!HlsLib.isSupported()) {
          setLoadError("This browser can't play HLS (.m3u8) streams.");
          return;
        }
        const hls = new HlsLib({ enableWorker: true });
        hlsRef.current = hls;
        hls.on(HlsLib.Events.ERROR, (_e, data) => {
          if (data.fatal) setLoadError("The stream could not be loaded.");
        });
        hls.loadSource(src);
        hls.attachMedia(v);
      });
    } else {
      v.src = src;
    }

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const vol = getSavedVolume();
    v.volume = vol;
    setVolume(vol);
  }, []);

  // ── Bring the local <video> in line with the shared state ───────────
  const applySync = useCallback(() => {
    const v = videoRef.current;
    const s = roomRef.current;
    if (!v || v.readyState < 1) return;

    let target = expectedPosition();
    const dur = v.duration;
    if (Number.isFinite(dur) && dur > 0) target = Math.min(target, Math.max(0, dur - 0.05));

    if (Math.abs(v.currentTime - target) > APPLY_SEEK_THRESHOLD) v.currentTime = target;
    v.playbackRate = s.rate;

    if (s.isPlaying) {
      const atEnd = Number.isFinite(dur) && dur > 0 && target >= dur - 0.1;
      if (v.paused && !atEnd) {
        v.play()
          .then(() => setNeedsGesture(false))
          .catch((err: DOMException) => {
            if (err?.name === "NotAllowedError") setNeedsGesture(true);
          });
      }
    } else if (!v.paused) {
      v.pause();
    }
  }, [expectedPosition]);

  // Every new event (play / pause / seek / join).
  useEffect(() => {
    applySync();
  }, [room.updatedAt, room.isPlaying, room.position, room.rate, applySync]);

  // Gentle drift correction once a second. No network involved.
  useEffect(() => {
    const id = window.setInterval(() => {
      const v = videoRef.current;
      const s = roomRef.current;
      if (!v || !src || v.readyState < 3 || v.seeking) {
        onDrift(null);
        return;
      }
      if (!s.isPlaying) {
        if (!v.paused) v.pause();
        // While paused there's no hurry, so line up precisely.
        const d = Math.abs(v.currentTime - s.position);
        if (d > 0.1) v.currentTime = s.position;
        v.playbackRate = s.rate;
        onDrift(0);
        return;
      }
      if (v.paused) {
        if (!v.ended) applySync();
        onDrift(v.ended ? 0 : null);
        return;
      }
      const drift = v.currentTime - expectedPosition();
      const abs = Math.abs(drift);
      if (abs > HARD_SEEK_THRESHOLD) {
        v.currentTime = expectedPosition();
        v.playbackRate = s.rate;
      } else if (abs > SOFT_DRIFT_THRESHOLD) {
        v.playbackRate = s.rate * (drift > 0 ? 0.94 : 1.06);
      } else {
        v.playbackRate = s.rate;
      }
      onDrift(abs);
    }, 1000);
    return () => window.clearInterval(id);
  }, [src, applySync, expectedPosition, onDrift]);

  // ── Controls ─────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    if (roomRef.current.isPlaying) {
      v.pause();
      onPause(v.currentTime);
    } else {
      // Call play() inside the click so mobile browsers allow sound.
      v.play().catch(() => {});
      setNeedsGesture(false);
      onPlay(v.currentTime);
    }
  }, [src, onPlay, onPause]);

  const seekTo = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v || !src) return;
      const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
      const pos = Math.max(0, Math.min(t, dur - 0.05));
      v.currentTime = pos;
      setCurrent(pos);
      onSeek(pos);
    },
    [src, onSeek],
  );

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
    saveVolume(val);
  };

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const doc = document as FsDocument;
    const el = containerRef.current as FsElement | null;
    const v = videoRef.current as IOSVideo | null;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc))?.();
      return;
    }
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else v?.webkitEnterFullscreen?.(); // iPhone
  }, []);

  useEffect(() => {
    const onFs = () => {
      const doc = document as FsDocument;
      setIsFs(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  // Keyboard: space/k play, ←/→ 10s, f fullscreen, m mute
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const v = videoRef.current;
      if (!v) return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        seekTo(v.currentTime + 10);
      } else if (e.key === "ArrowLeft") {
        seekTo(v.currentTime - 10);
      } else if (e.key === "f") {
        toggleFullscreen();
      } else if (e.key === "m") {
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekTo, toggleFullscreen, toggleMute]);

  // Auto-hide the controls while the film is playing.
  const poke = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (roomRef.current.isPlaying) setControlsVisible(false);
    }, 2800);
  }, []);
  useEffect(() => {
    poke();
    return () => window.clearTimeout(hideTimer.current);
  }, [room.isPlaying, poke]);

  // ── Render ───────────────────────────────────────────────────────────
  const shown = scrub ?? current;
  const fillPct = duration > 0 ? (shown / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const showSpinner = (Boolean(src) || srcPending) && !loadError && (!ready || waiting);
  const hasNothing = !room.videoUrl && !room.storagePath;

  return (
    <div
      ref={containerRef}
      onMouseMove={poke}
      onTouchStart={poke}
      className={`group relative w-full overflow-hidden bg-black ${isFs ? "h-full" : "aspect-video rounded-2xl shadow-[0_40px_120px_-30px_rgba(122,26,44,0.55)] ring-1 ring-white/[0.06]"} ${
        !controlsVisible && room.isPlaying ? "cursor-none" : ""
      }`}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black object-contain"
        playsInline
        preload="auto"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onLoadedMetadata={(e) => {
          setReady(true);
          setDuration(e.currentTarget.duration || 0);
          applySync();
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          if (b.length) setBuffered(b.end(b.length - 1));
        }}
        onWaiting={() => {
          setWaiting(true);
          onBuffering(true);
        }}
        onPlaying={() => {
          setWaiting(false);
          onBuffering(false);
        }}
        onCanPlay={() => {
          setWaiting(false);
          onBuffering(false);
        }}
        onEnded={(e) => {
          if (roomRef.current.isPlaying) onPause(e.currentTarget.duration || 0);
        }}
        onError={() => {
          if (!src) return;
          if (onSourceError?.()) return; // fetching a fresh link; we'll re-sync when it loads
          setLoadError(
            room.sourceType === "upload"
              ? "This video couldn't be played. If it isn't an MP4, try converting it to MP4 and uploading again."
              : "This video can't be played here. The link may have expired, or the site doesn't allow other websites to play its videos.",
          );
        }}
      />

      {/* Cinematic vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]" />

      <FloatingReactions reactions={reactions} />

      {/* Top bar: title + partner state */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity duration-500 sm:p-5 ${
          controlsVisible || !room.isPlaying ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="truncate font-display text-lg italic text-cream/90 sm:text-2xl">{room.videoTitle ?? ""}</p>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {notice && (
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-cream/85 backdrop-blur">{notice}</span>
          )}
          {partnerBuffering && (
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-cream/80 backdrop-blur">
              {partnerBuffering} is loading…
            </span>
          )}
        </div>
      </div>

      {/* Empty state, or whatever the room wants to show over the video (upload progress) */}
      {overlay ? (
        <div className="absolute inset-0 z-10">{overlay}</div>
      ) : (
        hasNothing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-ink-950/80 px-6 text-center">
            <FilmIcon className="h-10 w-10 text-wine-400" />
            <p className="font-display text-2xl italic text-cream/90 sm:text-3xl">What are we watching?</p>
            <button className="btn-primary" onClick={onOpenPicker}>
              Upload a video
            </button>
          </div>
        )
      )}

      {showSpinner && !overlay && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/15 border-t-wine-400" />
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink-950/90 px-6 text-center">
          <p className="max-w-md text-sm leading-relaxed text-cream/80">{loadError}</p>
          <button className="btn-ghost" onClick={onOpenPicker}>
            Choose another video
          </button>
        </div>
      )}

      {needsGesture && !loadError && (
        <button
          onClick={() => {
            setNeedsGesture(false);
            applySync();
          }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 text-cream backdrop-blur-[2px]"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-wine-500 shadow-[0_0_60px_rgba(197,58,79,0.6)]">
            <PlayIcon className="ml-1 h-9 w-9" />
          </span>
          <span className="font-display text-xl italic">Tap to join the movie</span>
        </button>
      )}

      {/* Bottom controls */}
      {src && !loadError && (
        <div
          // The fade-out gradient itself ignores taps, so tapping the picture on a phone
          // still plays/pauses; only the actual controls catch touches.
          className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-3 pt-14 transition-opacity duration-500 sm:px-5 sm:pb-4 ${
            controlsVisible || !room.isPlaying ? "opacity-100 [&>*]:pointer-events-auto" : "opacity-0"
          }`}
        >
          <input
            aria-label="Seek"
            type="range"
            className="slider w-full"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(shown, duration || 0)}
            style={{ ["--fill" as string]: `${fillPct}%`, ["--buffered" as string]: `${bufPct}%` }}
            onChange={(e) => setScrub(Number(e.target.value))}
            onPointerUp={() => {
              if (scrub !== null) seekTo(scrub);
              setScrub(null);
            }}
            onKeyUp={() => {
              if (scrub !== null) seekTo(scrub);
              setScrub(null);
            }}
          />
          <div className="mt-1 flex items-center gap-1 sm:gap-2">
            <button onClick={togglePlay} className="rounded-full p-2 text-cream transition hover:bg-white/10" aria-label={room.isPlaying ? "Pause" : "Play"}>
              {room.isPlaying ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
            </button>
            <button onClick={() => seekTo((videoRef.current?.currentTime ?? 0) - 10)} className="rounded-full p-2 text-cream/85 transition hover:bg-white/10" aria-label="Back 10 seconds">
              <BackIcon />
            </button>
            <button onClick={() => seekTo((videoRef.current?.currentTime ?? 0) + 10)} className="rounded-full p-2 text-cream/85 transition hover:bg-white/10" aria-label="Forward 10 seconds">
              <ForwardIcon />
            </button>

            <div className="group/vol flex items-center">
              <button onClick={toggleMute} className="rounded-full p-2 text-cream/85 transition hover:bg-white/10" aria-label="Mute">
                <VolumeIcon level={muted ? 0 : volume} />
              </button>
              <input
                aria-label="Volume"
                type="range"
                className="slider hidden w-0 opacity-0 transition-all duration-300 group-hover/vol:w-20 group-hover/vol:opacity-100 sm:block"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : volume}
                style={{ ["--fill" as string]: `${(muted ? 0 : volume) * 100}%` }}
                onChange={(e) => changeVolume(Number(e.target.value))}
              />
            </div>

            <span className="ml-1 font-mono text-[12px] tabular-nums text-cream/75 sm:text-[13px]">
              {formatTime(shown)} <span className="text-cream/35">/ {formatTime(duration)}</span>
            </span>

            <div className="flex-1" />

            <button onClick={toggleFullscreen} className="rounded-full p-2 text-cream/85 transition hover:bg-white/10" aria-label="Fullscreen">
              <FullscreenIcon active={isFs} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

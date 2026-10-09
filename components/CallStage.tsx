"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyCall, DailyEventObjectCameraError, DailyEventObjectFatalError, DailyEventObjectNetworkConnectionEvent } from "@daily-co/daily-js";
import ExternalMeeting from "./ExternalMeeting";
import { meetingService } from "@/lib/videos";

interface Props {
  code: string;
  myName: string;
  partnerName: string;
  partnerOnline: boolean;
  meetingUrl: string | null;
  onSaveMeeting: (url: string | null) => Promise<void>;
  /** Tells the room whether a call is live, so it can float it while you watch. */
  onInCallChange: (inCall: boolean) => void;
  /** Smaller layout while floating over the movie. */
  compact?: boolean;
  /** Changes every time someone clicks "Our Call": always brings back the Daily call screen. */
  openNonce?: number;
}

type CallState =
  | { kind: "idle" }
  | { kind: "connecting" } // getting a call pass
  | { kind: "prejoin" } // Daily's pre-join screen: camera/mic check, then "Join"
  | { kind: "in-call" }
  | { kind: "error"; message: string; canRetry: boolean };

const CallIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <rect x="2.5" y="6" width="13.5" height="12" rx="3" />
    <path d="m16 10.5 5.5-3.2v9.4L16 13.5" />
  </svg>
);

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);
}

/** Cinema colours for Daily Prebuilt. */
const THEME = {
  colors: {
    accent: "#c53a4f",
    accentText: "#ffffff",
    background: "#0d0b10",
    backgroundAccent: "#1a161d",
    baseText: "#f4ece4",
    border: "#3a3340",
    mainAreaBg: "#07060a",
    mainAreaBgAccent: "#252028",
    mainAreaText: "#f4ece4",
    supportiveText: "#b4a9b0",
  },
};

function fatalMessage(e: DailyEventObjectFatalError): { message: string; canRetry: boolean } {
  switch (e.error?.type) {
    case "meeting-full":
      return { message: "Our call already has two people in it. If one of you is on another device, leave there first.", canRetry: true };
    case "exp-token":
    case "nbf-token":
      return { message: "Your call pass expired before joining. Tap Start again to get a fresh one.", canRetry: true };
    case "ejected":
      return { message: "You were removed from the call.", canRetry: true };
    case "not-allowed":
    case "no-room":
    case "exp-room":
      return { message: "This call isn't available. Tap Start to try again.", canRetry: true };
    case "connection-error":
      return { message: "Couldn't connect to the call. Check your internet connection and try again.", canRetry: true };
    default:
      return { message: e.errorMsg || "The call ended unexpectedly.", canRetry: true };
  }
}

/**
 * 💻 Our Call: a private, two-person Daily video call embedded right here.
 * Camera and microphone are only requested after "Start Our Video Call ❤️"
 * (on Daily's pre-join screen). A saved Teams / Meet / Zoom link stays
 * available as an optional fallback.
 */
export default function CallStage({ code, myName, partnerName, partnerOnline, meetingUrl, onSaveMeeting, onInCallChange, compact = false, openNonce = 0 }: Props) {
  const [state, setState] = useState<CallState>({ kind: "idle" });
  const [view, setView] = useState<"call" | "link">("call");
  const [notice, setNotice] = useState<string | null>(null);
  const frameHost = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);

  const live = state.kind === "connecting" || state.kind === "prejoin" || state.kind === "in-call";

  // Daily is the default: clicking "Our Call" always returns here, even if an
  // external meeting link (Teams / Meet / Zoom) was opened earlier.
  useEffect(() => {
    if (!openNonce) return;
    setView("call");
    setState((s) => (s.kind === "error" ? { kind: "idle" } : s));
  }, [openNonce]);
  const frameVisible = state.kind === "prejoin" || state.kind === "in-call";
  useEffect(() => onInCallChange(state.kind === "in-call"), [state.kind, onInCallChange]);

  /** Destroy the Daily frame. Never hangs: if Daily can't answer (e.g. its bundle failed to load), we remove the frame ourselves. */
  const teardown = useCallback(async () => {
    const call = callRef.current;
    callRef.current = null;
    if (call && !call.isDestroyed()) {
      try {
        await withTimeout(call.destroy(), 3000);
      } catch {
        /* already gone */
      }
    }
    if (frameHost.current) frameHost.current.replaceChildren();
  }, []);

  // Leaving the room (logout, closing the tab, navigating away) ends the call.
  useEffect(() => () => void teardown(), [teardown]);

  const start = async () => {
    setNotice(null);
    setState({ kind: "connecting" });
    try {
      const res = await fetch("/api/call/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: myName }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; token?: string; error?: string };
      if (!res.ok || !data.url || !data.token) {
        setState({ kind: "error", message: data.error || "Couldn't start the call. Please try again.", canRetry: res.status !== 403 });
        return;
      }

      const Daily = (await import("@daily-co/daily-js")).default;
      await teardown();
      const stale = Daily.getCallInstance();
      if (stale && !stale.isDestroyed()) await withTimeout(stale.destroy(), 3000).catch(() => {});
      if (!frameHost.current) return;
      const call = Daily.createFrame(frameHost.current, {
        // Only one call ever lives on this page; this just stops a half-closed
        // previous attempt from blocking a fresh one.
        allowMultipleCallInstances: true,
        showLeaveButton: true,
        showFullscreenButton: true,
        iframeStyle: { width: "100%", height: "100%", border: "0", display: "block", background: "#07060a" },
        theme: THEME,
      });
      callRef.current = call;
      setState({ kind: "prejoin" });

      call
        .on("joined-meeting", () => setState({ kind: "in-call" }))
        .on("left-meeting", () => {
          void teardown();
          setNotice(null);
          setState((s) => (s.kind === "error" ? s : { kind: "idle" }));
        })
        .on("error", (e) => {
          const { message, canRetry } = fatalMessage(e as DailyEventObjectFatalError);
          void teardown();
          setState({ kind: "error", message, canRetry });
        })
        .on("camera-error", (e) => {
          const ce = e as DailyEventObjectCameraError;
          if (ce.error?.type === "permissions") {
            setNotice("Camera or microphone is blocked. Allow them in your browser's site settings, then rejoin.");
          } else if (ce.error?.type === "cam-in-use" || ce.error?.type === "mic-in-use" || ce.error?.type === "cam-mic-in-use") {
            setNotice("Your camera or microphone is being used by another app. Close it and try again.");
          } else if (ce.error?.type === "not-found" || ce.error?.type === "undefined-mediadevices") {
            setNotice("No camera or microphone was found on this device.");
          } else {
            setNotice("There's a problem with your camera or microphone.");
          }
        })
        .on("network-connection", (e) => {
          const ne = e as DailyEventObjectNetworkConnectionEvent;
          if (ne.event === "interrupted") setNotice("Connection lost, reconnecting…");
          else if (ne.event === "connected") setNotice(null);
        });

      await call.join({ url: data.url, token: data.token });
    } catch {
      await teardown();
      setState({ kind: "error", message: "The video call service can't be reached right now. Check your connection and try again.", canRetry: true });
    }
  };

  const leave = async () => {
    setNotice(null);
    setState({ kind: "idle" });
    const call = callRef.current;
    if (call && !call.isDestroyed()) {
      try {
        await withTimeout(call.leave(), 3000);
      } catch {
        /* ignore */
      }
    }
    await teardown();
  };

  // ── Optional external link (Teams / Meet / Zoom) ────────────────────────
  if (view === "link" && !live) {
    return <ExternalMeeting meetingUrl={meetingUrl} partnerName={partnerName} onSave={onSaveMeeting} onBack={() => setView("call")} />;
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-ink-950">
      {frameVisible && !compact && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-ink-900/90 px-3 py-2">
          <p className="flex min-w-0 items-center gap-2 truncate text-[13px] text-cream/80">
            <span className={`h-2 w-2 rounded-full ${state.kind === "in-call" ? "animate-pulseDot bg-emerald-400" : "bg-amber-400"}`} />
            {state.kind === "in-call" ? `Our Call · with ${partnerName}` : "Check your camera & mic, then join"}
          </p>
          <button onClick={leave} className="btn-chip px-3 py-1.5 text-[12px] hover:bg-wine-600">
            {state.kind === "in-call" ? "Leave call" : "Cancel"}
          </button>
        </div>
      )}

      {/* Daily mounts its iframe here; this element stays put while the call is live. */}
      <div className="relative min-h-0 flex-1">
        <div ref={frameHost} className={`absolute inset-0 ${frameVisible ? "" : "pointer-events-none opacity-0"}`} data-testid="daily-host" />
      </div>

      {notice && (
        <div className="absolute inset-x-3 top-3 z-10 mx-auto max-w-md rounded-full bg-amber-500/90 px-4 py-1.5 text-center text-[12.5px] font-medium text-black shadow-lg sm:inset-x-auto sm:left-3">
          {notice}
        </div>
      )}

      {state.kind === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
          <div className="h-11 w-11 animate-spin rounded-full border-2 border-white/10 border-t-wine-400" />
          <p className="font-display text-xl italic text-cream/70">Opening our call…</p>
          <p className="max-w-xs text-[12.5px] text-cream/40">Your browser will ask to use your camera and microphone.</p>
        </div>
      )}

      {state.kind === "idle" && (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgba(122,26,44,0.38),transparent_65%)] px-5 py-8">
          <div className="text-center animate-fadeIn">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-wine-500/15 text-wine-300 ring-1 ring-wine-400/30">
              <CallIcon className="h-7 w-7" />
            </span>
            <h2 className="mt-4 font-display text-5xl text-cream sm:text-6xl" style={{ textShadow: "0 0 50px rgba(197,58,79,0.35)" }}>
              Our Call ❤️
            </h2>
            <p className="mt-3 text-[13.5px] italic text-cream/55">
              {partnerOnline ? `${partnerName} is here. Start the call and see each other.` : `A private video call, just for you and ${partnerName}.`}
            </p>
            <button className="btn-primary mt-8 px-9 py-4 text-base" onClick={start}>
              Start Our Video Call ❤️
            </button>
            <p className="mt-3 text-[12px] text-cream/35">Camera and microphone are only asked for after you press start.</p>
            <button
              onClick={() => setView("link")}
              className="mt-6 text-[12.5px] text-cream/40 underline-offset-4 hover:text-cream/80 hover:underline"
            >
              {meetingUrl ? `Or use our ${meetingService(meetingUrl)} link` : "Prefer Teams, Google Meet or Zoom? Use a meeting link"}
            </button>
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto px-5 py-8">
          <div className="max-w-md text-center animate-fadeIn">
            <p className="font-display text-2xl text-cream">The call couldn&apos;t start</p>
            <p className="mt-3 text-[13.5px] leading-relaxed text-cream/60">{state.message}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {state.canRetry && (
                <button className="btn-primary" onClick={start}>
                  Try again
                </button>
              )}
              <button className="btn-ghost" onClick={() => setState({ kind: "idle" })}>
                Back
              </button>
            </div>
            <button onClick={() => setView("link")} className="mt-5 text-[12.5px] text-cream/40 underline-offset-4 hover:text-cream/80 hover:underline">
              Use a Teams / Meet / Zoom link instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

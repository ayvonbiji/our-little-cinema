"use client";

import { useEffect, useState } from "react";
import { checkMeetingUrl, meetingService, teamsAppLink } from "@/lib/videos";
import { PencilIcon } from "./Icons";

interface Props {
  meetingUrl: string | null;
  partnerName: string;
  onSave: (url: string | null) => Promise<void>;
}

/** Services whose ordinary join links must never be put in an iframe. */
const NEVER_EMBED = ["Google Meet", "Zoom"];

type Embed = { state: "idle" } | { state: "checking" } | { state: "embedded"; verified: boolean } | { state: "blocked" };

const CallIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <rect x="2.5" y="6" width="13.5" height="12" rx="3" />
    <path d="m16 10.5 5.5-3.2v9.4L16 13.5" />
  </svg>
);

const ExternalIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
  </svg>
);

/**
 * "Our Call": the meeting lives in the main stage of the cinema.
 *  1. Paste & save a Teams (or Meet / Zoom) link. It's stored on the room, so both see it.
 *  2. "Enter Our Call ❤️" tries to show the meeting inside this page.
 *  3. If the service forbids being shown inside other websites (Teams normally does),
 *     we say so honestly and offer "Open Teams" in a new tab, and this page,
 *     the chat and the room all stay right here.
 */
export default function CallStage({ meetingUrl, partnerName, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [embed, setEmbed] = useState<Embed>({ state: "idle" });

  // A different link (or removal) resets the in-page view.
  useEffect(() => {
    setEmbed({ state: "idle" });
  }, [meetingUrl]);

  const service = meetingService(meetingUrl) || "Microsoft Teams";
  const appLink = teamsAppLink(meetingUrl);

  const save = async (url: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await onSave(url);
      setEditing(false);
      setValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the meeting.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = checkMeetingUrl(value);
    if (!c.ok) {
      setError(c.reason.replace("Paste a Google Meet, Microsoft Teams or Zoom link.", "Paste a Microsoft Teams link (Google Meet and Zoom work too)."));
      return;
    }
    save(c.url);
  };

  const enter = async () => {
    if (!meetingUrl) return;
    // A normal Google Meet or Zoom join link is never loaded into an iframe:
    // both services refuse to be shown inside other websites, and neither
    // offers a public SDK that embeds an existing meeting link in a web page.
    if (NEVER_EMBED.includes(service)) {
      setEmbed({ state: "blocked" });
      return;
    }
    setEmbed({ state: "checking" });
    try {
      const res = await fetch(`/api/meeting/check?url=${encodeURIComponent(meetingUrl)}`, { cache: "no-store" });
      const data = (await res.json()) as { embeddable?: boolean | null };
      if (data.embeddable === false) setEmbed({ state: "blocked" });
      else setEmbed({ state: "embedded", verified: data.embeddable === true });
    } catch {
      setEmbed({ state: "embedded", verified: false });
    }
  };

  const OpenButtons = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex items-center justify-center gap-2 ${compact ? "flex-nowrap" : "mt-1 flex-wrap"}`}>
      <a
        href={meetingUrl ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className={compact ? "btn-chip" : "btn-primary"}
      >
        <ExternalIcon /> Open {service === "Microsoft Teams" ? "Teams" : service}
      </a>
      {appLink && (
        <a href={appLink} className={compact ? "btn-chip hidden sm:inline-flex" : "btn-ghost"}>
          Open in the Teams app
        </a>
      )}
    </div>
  );

  // ── 1. No meeting yet, or editing ─────────────────────────────────────
  if (!meetingUrl || editing) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(122,26,44,0.35),transparent_60%)] px-5 py-8">
        <form onSubmit={submit} className="w-full max-w-lg text-center animate-fadeIn">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-wine-500/15 text-wine-300 ring-1 ring-wine-400/30">
            <CallIcon className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-4xl text-cream">Our Call ❤️</h2>
          <p className="mt-1 text-[13px] font-semibold uppercase tracking-[0.22em] text-cream/45">Microsoft Teams Meeting</p>
          <input
            className="field mt-6 text-center"
            placeholder="Paste your Microsoft Teams meeting link"
            value={value}
            autoFocus={editing}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
          <p className="mt-2 text-[12px] text-cream/35">Example: https://teams.microsoft.com/… · Google Meet and Zoom links work too</p>
          {error && <p className="mt-3 text-sm text-wine-300">{error}</p>}
          <div className="mt-5 flex justify-center gap-2">
            <button type="submit" className="btn-primary" disabled={busy || !value.trim()}>
              {busy ? "Saving…" : "Save Meeting"}
            </button>
            {editing && (
              <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
          <p className="mt-5 text-[12.5px] italic text-cream/40">Saved to this room, so {partnerName} gets it automatically.</p>
        </form>
      </div>
    );
  }

  // ── 3a. In-page meeting ───────────────────────────────────────────────
  if (embed.state === "embedded") {
    return (
      <div className="flex h-full w-full flex-col bg-black">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] bg-ink-900/90 px-3 py-2">
          <p className="flex min-w-0 items-center gap-2 truncate text-[13px] text-cream/80">
            <span className="h-2 w-2 animate-pulseDot rounded-full bg-emerald-400" /> Our Call · {service}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="hidden text-[11.5px] text-cream/40 sm:inline">Not loading?</span>
            <OpenButtons compact />
            <button className="btn-chip" onClick={() => setEmbed({ state: "idle" })}>
              Leave
            </button>
          </div>
        </div>
        <iframe
          title="Our Call"
          src={meetingUrl}
          className="min-h-0 w-full flex-1 bg-black"
          allow="camera; microphone; display-capture; autoplay; fullscreen; clipboard-write"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // ── 3b. The service refuses to be shown inside other sites ───────────
  if (embed.state === "blocked") {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(122,26,44,0.3),transparent_60%)] px-5 py-8">
        <div className="max-w-lg text-center animate-fadeIn">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-cream/70 ring-1 ring-white/10">
            <CallIcon className="h-7 w-7" />
          </span>
          <p className="mt-5 font-display text-2xl leading-snug text-cream sm:text-3xl">
            {service} doesn&apos;t allow this meeting to be embedded here.
          </p>
          <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-relaxed text-cream/55">
            Open it beside this page. Our cinema, the chat and {partnerName} stay right here, so you can switch back any time.
          </p>
          <div className="mt-6">
            <OpenButtons />
          </div>
          <button className="mt-5 text-[12.5px] text-cream/40 underline-offset-4 hover:text-cream/75 hover:underline" onClick={() => setEmbed({ state: "idle" })}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── 2. Saved meeting, ready to enter ──────────────────────────────────
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgba(122,26,44,0.38),transparent_65%)] px-5 py-8">
      <div className="text-center animate-fadeIn">
        <p className="eyebrow">{service}</p>
        <h2 className="mt-3 font-display text-5xl text-cream sm:text-6xl" style={{ textShadow: "0 0 50px rgba(197,58,79,0.35)" }}>
          Our Call ❤️
        </h2>
        <p className="mt-3 text-[13.5px] italic text-cream/50">Your meeting is saved to this room for both of you.</p>
        <button className="btn-primary mt-8 px-9 py-4 text-base" onClick={enter} disabled={embed.state === "checking"}>
          {embed.state === "checking" ? "Opening our call…" : "Enter Our Call ❤️"}
        </button>
        <div className="mt-6 flex items-center justify-center gap-3 text-[12.5px] text-cream/40">
          <button className="inline-flex items-center gap-1 hover:text-cream/80" onClick={() => {
            setValue(meetingUrl);
            setEditing(true);
          }}>
            <PencilIcon className="h-3.5 w-3.5" /> Change link
          </button>
          <span>·</span>
          <button className="hover:text-cream/80" onClick={() => save(null)} disabled={busy}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

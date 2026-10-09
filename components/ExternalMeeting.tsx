"use client";

import { useState } from "react";
import { checkMeetingUrl, meetingService, teamsAppLink } from "@/lib/videos";
import { PencilIcon } from "./Icons";

interface Props {
  meetingUrl: string | null;
  partnerName: string;
  onSave: (url: string | null) => Promise<void>;
  /** Back to the built-in video call. */
  onBack: () => void;
}

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
 * Optional alternative to the built-in Daily call: a Teams / Meet / Zoom link saved on
 * the room. Ordinary meeting links are never put in an iframe (those services refuse
 * to be shown inside other websites); they always open in a new tab, so the cinema,
 * the chat and the room stay right here.
 */
export default function ExternalMeeting({ meetingUrl, partnerName, onSave, onBack }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const BackLink = () => (
    <button onClick={onBack} className="absolute left-4 top-3 z-10 text-[12.5px] text-cream/45 hover:text-cream/85">
      ← Back to our video call
    </button>
  );

  // ── 1. No meeting yet, or editing ─────────────────────────────────────
  if (!meetingUrl || editing) {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(122,26,44,0.35),transparent_60%)] px-5 py-10">
        <BackLink />
        <form onSubmit={submit} className="w-full max-w-lg text-center animate-fadeIn">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-wine-500/15 text-wine-300 ring-1 ring-wine-400/30">
            <CallIcon className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-3xl text-cream">Use a meeting link</h2>
          <p className="mt-1 text-[13px] font-semibold uppercase tracking-[0.22em] text-cream/45">Microsoft Teams · Google Meet · Zoom</p>
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

  // ── 2. Saved meeting, ready to enter ──────────────────────────────────
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgba(122,26,44,0.38),transparent_65%)] px-5 py-10">
      <BackLink />
      <div className="text-center animate-fadeIn">
        <p className="eyebrow">{service}</p>
        <h2 className="mt-3 font-display text-4xl text-cream sm:text-5xl">Our meeting link</h2>
        <p className="mt-3 text-[13.5px] italic text-cream/50">Saved to this room for both of you.</p>
        <div className="mt-8">
          <OpenButtons />
        </div>
        <p className="mt-3 text-[12px] text-cream/35">Opens in a new tab; this cinema and the chat stay here.</p>
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

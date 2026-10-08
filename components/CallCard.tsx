"use client";

import { useState } from "react";
import { checkMeetingUrl, meetingService } from "@/lib/videos";
import { PencilIcon } from "./Icons";

interface Props {
  meetingUrl: string | null;
  onSave: (url: string | null) => Promise<void>;
}

const PhoneIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <rect x="3" y="6" width="13" height="12" rx="2.5" />
    <path d="m16 10.5 5-3v9l-5-3" />
  </svg>
);

/**
 * "Our Call": save a Google Meet / Teams / Zoom link once, then one tap opens it
 * in a new tab (those apps don't allow being embedded inside other websites),
 * so the cinema stays open right here.
 */
export default function CallCard({ meetingUrl, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (url: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await onSave(url);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the link.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = checkMeetingUrl(value);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    save(check.url);
  };

  if (editing || (!meetingUrl && value)) {
    return (
      <form onSubmit={submit} className="panel flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center gap-2 text-cream/80">
          <PhoneIcon />
          <span className="eyebrow">Our Call</span>
        </div>
        <input
          autoFocus
          className="field py-2.5 text-[14px]"
          placeholder="https://meet.google.com/…  ·  teams  ·  zoom"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        <div className="flex shrink-0 gap-2">
          <button type="submit" className="btn-chip border-wine-500/50 bg-wine-500/15" disabled={busy}>
            Save
          </button>
          <button
            type="button"
            className="btn-chip"
            onClick={() => {
              setEditing(false);
              setValue("");
              setError(null);
            }}
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-[12.5px] text-wine-300 sm:basis-full">{error}</p>}
      </form>
    );
  }

  if (!meetingUrl) {
    return (
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <PhoneIcon className="h-5 w-5 text-wine-400" />
          <div>
            <p className="text-[14px] font-semibold text-cream">Our Call</p>
            <p className="text-[12.5px] text-cream/50">Add your Google Meet, Teams or Zoom link to talk while you watch.</p>
          </div>
        </div>
        <button
          className="btn-chip"
          onClick={() => {
            setValue("");
            setEditing(true);
          }}
        >
          Add call link
        </button>
      </div>
    );
  }

  return (
    <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <PhoneIcon className="h-5 w-5 shrink-0 text-wine-400" />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-cream">Our Call · {meetingService(meetingUrl)}</p>
          <p className="truncate text-[12px] text-cream/40">{meetingUrl}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="btn-primary px-5 py-2.5 text-[14px]">
          Join Our Call ❤️
        </a>
        <button
          className="rounded-full p-2 text-cream/50 hover:bg-white/10 hover:text-cream"
          aria-label="Edit call link"
          onClick={() => {
            setValue(meetingUrl);
            setEditing(true);
          }}
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        <button className="text-[12.5px] text-cream/40 underline-offset-2 hover:text-cream/80 hover:underline" onClick={() => save(null)} disabled={busy}>
          Remove
        </button>
      </div>
      {error && <p className="basis-full text-[12.5px] text-wine-300">{error}</p>}
    </div>
  );
}

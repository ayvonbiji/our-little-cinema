"use client";

import { useState } from "react";
import type { CoupleNames, PresenceUser, Toast } from "@/lib/types";
import type { ConnectionStatus } from "@/hooks/useRoom";
import { CloseIcon, CopyIcon } from "./Icons";

// ── Connection / sync status ─────────────────────────────────────────────
export function StatusPill({
  status,
  partnerOnline,
  partnerName,
  drift,
}: {
  status: ConnectionStatus;
  partnerOnline: boolean;
  partnerName: string;
  drift: number | null;
}) {
  let dot = "bg-cream/40";
  let text = "Connecting…";
  if (status === "reconnecting" || status === "error") {
    dot = "bg-amber-400";
    text = "Reconnecting…";
  } else if (status === "connected") {
    if (!partnerOnline) {
      dot = "bg-cream/40";
      text = `Waiting for ${partnerName}…`;
    } else if (drift !== null && drift > 0.6) {
      dot = "bg-emerald-400";
      text = "Together · Syncing…";
    } else {
      dot = "bg-emerald-400";
      text = "Together · Synced";
    }
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/30 px-3 py-1.5 text-[12px] font-medium text-cream/85 backdrop-blur">
      <span className={`h-2 w-2 rounded-full ${dot} ${status !== "connected" || !partnerOnline ? "animate-pulseDot" : ""}`} />
      {text}
    </span>
  );
}

// ── Me / My Love chips ───────────────────────────────────────────────────
function Avatar({ name, online, label, buffering }: { name: string; online: boolean; label: string; buffering?: boolean }) {
  return (
    <div className="flex items-center gap-2" title={`${name}${online ? " is here" : " is away"}`}>
      <div className="relative">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full font-display text-lg transition ${
            online ? "bg-gradient-to-br from-wine-400 to-wine-700 text-white" : "bg-white/[0.06] text-cream/40"
          }`}
        >
          {name.slice(0, 1).toUpperCase()}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-950 ${
            online ? (buffering ? "bg-amber-400" : "bg-emerald-400") : "bg-ink-600"
          }`}
        />
      </div>
      <div className="hidden leading-tight sm:block">
        <p className="text-[13px] font-semibold text-cream/90">{name}</p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-cream/40">{label}</p>
      </div>
    </div>
  );
}

export function PresenceChips({ myName, partnerName, partner }: { myName: string; partnerName: string; partner: PresenceUser | undefined }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={myName} online label="Me" />
      <span className="text-wine-400">❤</span>
      <Avatar name={partnerName} online={Boolean(partner)} buffering={partner?.buffering} label="My Love" />
    </div>
  );
}

// ── Invite card ──────────────────────────────────────────────────────────
export function InviteCard({ link, code, partnerName, onClose }: { link: string; code: string; partnerName: string; onClose: () => void }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const copy = async (what: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(what === "link" ? link : code);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked; the text is selectable anyway */
    }
  };
  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      nav.share({ title: "Our Little Cinema", text: `Come watch with me ❤️`, url: link }).catch(() => {});
    } else copy("link");
  };

  return (
    <div className="panel relative p-5 animate-fadeIn">
      <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-cream/50 hover:bg-white/10 hover:text-cream" aria-label="Close">
        <CloseIcon className="h-4 w-4" />
      </button>
      <p className="eyebrow">Invite</p>
      <p className="mt-1 font-display text-2xl text-cream">Send this to {partnerName}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <code className="field flex-1 select-all truncate py-2.5 font-mono text-[13px] text-cream/80">{link}</code>
        <div className="flex gap-2">
          <button className="btn-chip" onClick={() => copy("link")}>
            <CopyIcon className="h-4 w-4" /> {copied === "link" ? "Copied ✓" : "Copy link"}
          </button>
          <button className="btn-chip" onClick={share}>
            Share
          </button>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] text-cream/45">
        Or tell them the code <button onClick={() => copy("code")} className="font-mono text-wine-300 underline-offset-2 hover:underline">{code}</button>
        {copied === "code" ? " (copied ✓)" : ""}. Only people with this link can enter.
      </p>
    </div>
  );
}

// ── Who's watching? ──────────────────────────────────────────────────────
export function WhoIsWatching({ names, lastName, onPick }: { names: CoupleNames; lastName: string | null; onPick: (name: string) => void }) {
  const [chooseAgain, setChooseAgain] = useState(false);
  const known = lastName && (lastName === names.one || lastName === names.two) ? lastName : null;

  // Remembered on this device (until Logout): one tap to walk back in.
  if (known && !chooseAgain) {
    return (
      <div className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
        <p className="eyebrow animate-fadeIn">Our Little Cinema</p>
        <h1 className="mt-4 font-display text-4xl text-cream animate-fadeIn [animation-delay:100ms] sm:text-5xl">Welcome back, {known}</h1>
        <button
          onClick={() => onPick(known)}
          className="group mt-12 flex flex-col items-center gap-4 animate-fadeIn [animation-delay:220ms]"
        >
          <span className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-wine-500 to-wine-800 font-display text-5xl text-white shadow-[0_20px_60px_-20px_rgba(197,58,79,0.8)] ring-2 ring-wine-300/60 transition duration-300 group-hover:-translate-y-1 group-hover:ring-cream/80 sm:h-36 sm:w-36">
            {known.slice(0, 1).toUpperCase()}
          </span>
          <span className="btn-primary">Enter the cinema</span>
        </button>
        <button onClick={() => setChooseAgain(true)} className="mt-6 text-sm text-cream/45 underline-offset-4 hover:text-cream/80 hover:underline">
          Not {known}?
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow animate-fadeIn">Our Little Cinema</p>
      <h1 className="mt-4 font-display text-4xl text-cream animate-fadeIn [animation-delay:100ms] sm:text-5xl">Who&apos;s watching?</h1>
      <div className="mt-12 flex gap-6 animate-fadeIn [animation-delay:220ms] sm:gap-10">
        {[names.one, names.two].map((n) => (
          <button key={n} onClick={() => onPick(n)} className="group flex flex-col items-center gap-4">
            <span
              className={`flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-wine-500 to-wine-800 font-display text-5xl text-white shadow-[0_20px_60px_-20px_rgba(197,58,79,0.8)] ring-2 transition duration-300 group-hover:-translate-y-1 group-hover:ring-cream/80 sm:h-36 sm:w-36 ${
                lastName === n ? "ring-wine-300/70" : "ring-transparent"
              }`}
            >
              {n.slice(0, 1).toUpperCase()}
            </span>
            <span className="text-lg font-medium text-cream/70 transition group-hover:text-cream">{n}</span>
          </button>
        ))}
      </div>
      <p className="mt-14 font-display text-lg italic text-cream/40 animate-fadeIn [animation-delay:400ms]">
        Different places. Same movie. Together.
      </p>
    </div>
  );
}

// ── Edit names ───────────────────────────────────────────────────────────
export function NamesDialog({ names, onSave, onClose }: { names: CoupleNames; onSave: (n: CoupleNames) => void; onClose: () => void }) {
  const [one, setOne] = useState(names.one);
  const [two, setTwo] = useState(names.two);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <form
        className="panel w-full max-w-sm bg-ink-900/95 p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const a = one.trim().slice(0, 24);
          const b = two.trim().slice(0, 24);
          if (a && b && a !== b) onSave({ one: a, two: b });
        }}
      >
        <p className="eyebrow">Our names</p>
        <div className="mt-4 space-y-3">
          <input className="field" value={one} onChange={(e) => setOne(e.target.value)} maxLength={24} />
          <input className="field" value={two} onChange={(e) => setTwo(e.target.value)} maxLength={24} />
        </div>
        <p className="mt-3 text-[12px] text-cream/40">Changes show up for both of you right away.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-chip" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-chip border-wine-500/60 bg-wine-500/20">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Toasts ───────────────────────────────────────────────────────────────
export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div key={t.id} className="rounded-full border border-white/[0.08] bg-ink-850/90 px-4 py-2 text-[13px] text-cream/90 shadow-xl backdrop-blur animate-fadeIn">
          {t.text}
        </div>
      ))}
    </div>
  );
}

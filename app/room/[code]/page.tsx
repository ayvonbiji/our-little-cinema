"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Ambient from "@/components/Ambient";
import SetupNotice from "@/components/SetupNotice";
import VideoPlayer from "@/components/VideoPlayer";
import ChatPanel from "@/components/ChatPanel";
import MoviePicker, { type MovieChoice } from "@/components/MoviePicker";
import { InviteCard, NamesDialog, PresenceChips, StatusPill, Toasts, WhoIsWatching } from "@/components/RoomBits";
import { FilmIcon, PencilIcon } from "@/components/Icons";
import { useRoom } from "@/hooks/useRoom";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_NAMES, getSavedName, makeIdentity, saveName } from "@/lib/identity";
import { formatTime } from "@/lib/videos";
import type { CoupleNames, Identity, RoomRow, RoomState } from "@/lib/types";

export default function RoomPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code).toLowerCase();

  if (!isSupabaseConfigured) {
    return (
      <main className="flex min-h-[100svh] items-center justify-center px-5">
        <Ambient />
        <SetupNotice />
      </main>
    );
  }
  return <RoomGate code={code} />;
}

/** Looks the room up, then asks "Who's watching?" (one tap, also unlocks sound on phones). */
function RoomGate({ code }: { code: string }) {
  const [names, setNames] = useState<CoupleNames | null>(null);
  const [missing, setMissing] = useState(false);
  const [me, setMe] = useState<Identity | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);

  useEffect(() => {
    setLastName(getSavedName());
    getSupabase()
      .rpc("get_room", { p_code: code })
      .then(({ data, error }) => {
        const row = (data as RoomRow[] | null)?.[0];
        if (error || !row) setMissing(true);
        else setNames(row.names ?? DEFAULT_NAMES);
      });
  }, [code]);

  if (missing) return <NotFound />;
  if (!names) return <Loading />;
  if (!me) {
    return (
      <main>
        <Ambient />
        <WhoIsWatching
          names={names}
          lastName={lastName}
          onPick={(n) => {
            saveName(n);
            setMe(makeIdentity(n));
          }}
        />
      </main>
    );
  }
  return <Cinema code={code} me={me} initialNames={names} onIdentityChange={setMe} />;
}

function Cinema({
  code,
  me,
  initialNames,
  onIdentityChange,
}: {
  code: string;
  me: Identity;
  initialNames: CoupleNames;
  onIdentityChange: (i: Identity) => void;
}) {
  const r = useRoom(code, me, initialNames);
  const { room, status, peers, messages, reactions, toasts, serverNow, updatePlayback, pushToast } = r;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [namesOpen, setNamesOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [drift, setDrift] = useState<number | null>(null);
  const [localFile, setLocalFile] = useState<{ title: string; url: string } | null>(null);
  const [link, setLink] = useState("");

  const names = room?.names ?? initialNames;
  const partnerName = names.one === me.name ? names.two : names.one;
  const partner = useMemo(() => peers.find((p) => p.clientId !== me.clientId), [peers, me.clientId]);
  const partnerDisplay = partner?.name ?? partnerName;

  useEffect(() => {
    setLink(`${window.location.origin}/room/${code}`);
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setInviteOpen(true);
      window.history.replaceState(null, "", `/room/${code}`);
    }
  }, [code]);

  // Once they arrive, the invite card has done its job.
  const partnerHere = Boolean(partner);
  useEffect(() => {
    if (partnerHere) setInviteOpen(false);
  }, [partnerHere]);

  // Keep my identity label in step if names are edited.
  const namesRef = useRef<CoupleNames>(initialNames);
  useEffect(() => {
    if (!room) return;
    const prev = namesRef.current;
    namesRef.current = room.names;
    const { one, two } = room.names;
    if (me.name !== one && me.name !== two) {
      const renamed = me.name === prev.two ? two : one;
      saveName(renamed);
      onIdentityChange({ ...me, name: renamed });
    }
  }, [room, me, onIdentityChange]);

  // Gentle "Aksa paused" style notes when the other person does something.
  const prevRef = useRef<RoomState | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = room;
    if (!prev || !room || room.updatedAt === prev.updatedAt) return;
    if (!room.updatedBy || room.updatedBy === me.name) return;
    const who = room.updatedBy;
    if (room.videoUrl !== prev.videoUrl || room.videoTitle !== prev.videoTitle) pushToast(`${who} chose “${room.videoTitle}” 🎬`);
    else if (room.isPlaying && !prev.isPlaying) pushToast(`${who} pressed play`);
    else if (!room.isPlaying && prev.isPlaying) pushToast(`${who} paused`);
    else pushToast(`${who} jumped to ${formatTime(room.position)}`);
  }, [room, me.name, pushToast]);

  const onDrift = useCallback((d: number | null) => {
    setDrift((old) => {
      const rounded = d === null ? null : Math.round(d * 10) / 10;
      return old === rounded ? old : rounded;
    });
  }, []);

  const setFile = useCallback((file: File, title: string) => {
    setLocalFile((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return { title, url: URL.createObjectURL(file) };
    });
  }, []);

  const choose = (c: MovieChoice) => {
    setPickerOpen(false);
    if (c.localFile) setFile(c.localFile, c.videoTitle);
    updatePlayback({ videoUrl: c.videoUrl, videoTitle: c.videoTitle, sourceType: c.sourceType, position: 0, isPlaying: false });
  };

  if (status === "not-found") return <NotFound />;
  if (!room) return <Loading />;

  const localUrl = room.sourceType === "local" && localFile?.title === room.videoTitle ? localFile.url : null;
  const partnerBuffering = partner?.buffering ? partner.name : null;

  return (
    <main className="relative min-h-[100svh] pb-10">
      <Ambient dim />
      {/* Curtain fade on entering */}
      <div className="pointer-events-none fixed inset-0 z-[70] bg-ink-950 animate-curtain" />

      <header className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-1.5">
          <Link href="/" className="group flex items-center gap-2.5">
            <FilmIcon className="h-5 w-5 text-wine-400" />
            <span className="font-display text-lg tracking-[0.14em] text-cream/90 group-hover:text-cream">
              {names.one.toUpperCase()} <span className="text-wine-400">❤️</span> {names.two.toUpperCase()}
            </span>
          </Link>
          <button
            onClick={() => setNamesOpen(true)}
            className="rounded-full p-1.5 text-cream/30 hover:bg-white/10 hover:text-cream/80"
            aria-label="Edit names"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <StatusPill status={status} partnerOnline={Boolean(partner)} partnerName={partnerName} drift={drift} />
          <PresenceChips myName={me.name} partnerName={partnerDisplay} partner={partner} />
          <button className="btn-chip" onClick={() => setInviteOpen((v) => !v)}>
            Invite
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          {(inviteOpen || (!partner && status === "connected" && !room.videoUrl && room.sourceType !== "local")) && (
            <InviteCard link={link} code={code} partnerName={partnerName} onClose={() => setInviteOpen(false)} />
          )}

          <VideoPlayer
            room={room}
            serverNow={serverNow}
            localFileUrl={localUrl}
            onPickLocalFile={(f) => setFile(f, room.videoTitle ?? f.name)}
            reactions={reactions}
            partnerBuffering={partnerBuffering}
            onPlay={(position) => updatePlayback({ isPlaying: true, position })}
            onPause={(position) => updatePlayback({ isPlaying: false, position })}
            onSeek={(position) => updatePlayback({ position })}
            onBuffering={r.setBuffering}
            onDrift={onDrift}
            onOpenPicker={() => setPickerOpen(true)}
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow">{room.videoTitle ? "Now showing" : "Private screening"}</p>
              <p className="truncate font-display text-2xl text-cream">
                {room.videoTitle ?? "Nothing chosen yet"}
              </p>
              <p className="mt-0.5 text-[13px] italic text-cream/45">
                {partner ? `${partner.name} is watching with you` : `${partnerName} hasn't arrived yet`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-chip" onClick={() => r.sendReaction("❤️", "I'm here ❤️")}>
                I&apos;m here ❤️
              </button>
              <button className="btn-chip" onClick={() => r.sendReaction("💋", "sent you a kiss 💋")}>
                Send a kiss 💋
              </button>
              <button className="btn-chip" onClick={() => setPickerOpen(true)}>
                <FilmIcon className="h-4 w-4" /> Change movie
              </button>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:h-[calc(100svh-120px)]">
          <ChatPanel
            messages={messages}
            myName={me.name}
            partnerName={partnerName}
            onSend={(t) => r.sendChat(t)}
            onReact={(e) => r.sendReaction(e)}
          />
        </div>
      </div>

      <MoviePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onChoose={choose} />
      {namesOpen && (
        <NamesDialog
          names={names}
          onClose={() => setNamesOpen(false)}
          onSave={(n) => {
            setNamesOpen(false);
            r.updateNames(n);
          }}
        />
      )}
      <Toasts toasts={toasts} />
    </main>
  );
}

function Loading() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center gap-4">
      <Ambient />
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-wine-400" />
      <p className="font-display text-lg italic text-cream/50">Dimming the lights…</p>
    </main>
  );
}

function NotFound() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center gap-5 px-6 text-center">
      <Ambient />
      <p className="font-display text-3xl text-cream">This room doesn&apos;t exist</p>
      <p className="max-w-sm text-cream/55">Check the link again, or create a new private room.</p>
      <Link href="/" className="btn-primary">
        Back to the lobby
      </Link>
    </main>
  );
}

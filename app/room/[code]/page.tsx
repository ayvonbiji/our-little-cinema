"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Ambient from "@/components/Ambient";
import SetupNotice from "@/components/SetupNotice";
import VideoPlayer from "@/components/VideoPlayer";
import ChatPanel from "@/components/ChatPanel";
import VideoPicker, { type LinkChoice } from "@/components/VideoPicker";
import CallStage from "@/components/CallStage";
import UploadProgressCard, { type LocalUpload } from "@/components/UploadProgressCard";
import { InviteCard, NamesDialog, PresenceChips, StatusPill, Toasts, WhoIsWatching } from "@/components/RoomBits";
import { CopyIcon, FilmIcon, PencilIcon } from "@/components/Icons";
import { useRoom } from "@/hooks/useRoom";
import { useVideoUrl } from "@/hooks/useVideoUrl";
import { uploadVideo, uploadErrorText, type UploadHandle } from "@/lib/upload";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_NAMES, clearIdentity, getSavedName, makeIdentity, saveName } from "@/lib/identity";
import { formatTime, meetingService } from "@/lib/videos";
import type { CoupleNames, Identity, RoomRow, RoomState, UploadStatus } from "@/lib/types";

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

type Mode = "watch" | "call";

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
  const router = useRouter();
  const r = useRoom(code, me, initialNames);
  const { room, status, peers, messages, reactions, toasts, serverNow, updatePlayback, pushToast, remoteUpload, sendUploadStatus } = r;

  const [mode, setModeState] = useState<Mode | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [namesOpen, setNamesOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [drift, setDrift] = useState<number | null>(null);
  const [link, setLink] = useState("");
  const [upload, setUpload] = useState<LocalUpload | null>(null);
  const [readyTitle, setReadyTitle] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);
  const [callNonce, setCallNonce] = useState(0);
  const uploadRef = useRef<UploadHandle | null>(null);
  const cancelledRef = useRef(false);
  const lastFileRef = useRef<File | null>(null);
  const lastSentRef = useRef(0);
  const savingMeetingRef = useRef(false);

  const names = room?.names ?? initialNames;
  const partnerName = names.one === me.name ? names.two : names.one;
  const partner = useMemo(() => peers.find((p) => p.clientId !== me.clientId), [peers, me.clientId]);
  const partnerDisplay = partner?.name ?? partnerName;

  // Uploaded videos play from a signed link to the shared cloud copy.
  const isUpload = room?.sourceType === "upload";
  const video = useVideoUrl(code, isUpload ? room?.storagePath ?? null : null);
  const retriedUrlRef = useRef<string | null>(null);
  const src = !room ? null : isUpload ? video.url : room.videoUrl;
  const hasVideo = Boolean(room?.videoUrl || room?.storagePath);

  // ── 🎬 Watch / 💻 Our Call ─────────────────────────────────────────────
  const modeKey = `olc:mode:${code}`;
  const setMode = useCallback(
    (m: Mode) => {
      setModeState(m);
      try {
        window.sessionStorage.setItem(modeKey, m);
      } catch {
        /* ignore */
      }
    },
    [modeKey],
  );
  /** "Our Call" always means our built-in Daily call screen. */
  const openCall = useCallback(() => {
    setMode("call");
    setCallNonce((n) => n + 1);
  }, [setMode]);

  // First visit: Our Call is home, unless there's only a video and no call yet.
  const roomLoaded = Boolean(room);
  useEffect(() => {
    if (!roomLoaded || mode) return;
    let saved: string | null = null;
    try {
      saved = window.sessionStorage.getItem(modeKey);
    } catch {
      /* ignore */
    }
    if (saved === "watch" || saved === "call") setModeState(saved);
    else setModeState(!room?.meetingUrl && hasVideo ? "watch" : "call");
  }, [roomLoaded, mode, modeKey, room?.meetingUrl, hasVideo]);

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
    if (!prev || !room) return;
    if (room.meetingUrl !== prev.meetingUrl && !savingMeetingRef.current) {
      pushToast(room.meetingUrl ? `Our Call is ready ❤️ (${meetingService(room.meetingUrl)})` : "The call link was removed");
    }
    if (room.updatedAt === prev.updatedAt) return;
    if (!room.updatedBy || room.updatedBy === me.name) return;
    const who = room.updatedBy;
    const videoChanged =
      room.videoUrl !== prev.videoUrl || room.storagePath !== prev.storagePath || room.videoTitle !== prev.videoTitle;
    if (videoChanged) {
      if (room.videoUrl || room.storagePath) {
        setReadyTitle(room.videoTitle ?? "");
        pushToast(`Video ready ❤️ ${who} shared “${room.videoTitle}”`);
      } else pushToast(`${who} removed the video`);
    } else if (room.isPlaying && !prev.isPlaying) pushToast(`${who} pressed play${mode === "call" ? " (🎬 Watch to join)" : ""}`);
    else if (!room.isPlaying && prev.isPlaying) pushToast(`${who} paused`);
    else pushToast(`${who} jumped to ${formatTime(room.position)}`);
  }, [room, me.name, pushToast, mode]);

  // Don't let a stray tab-close kill an upload without asking.
  const uploading = upload?.status === "uploading";
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  const onDrift = useCallback((d: number | null) => {
    setDrift((old) => {
      const rounded = d === null ? null : Math.round(d * 10) / 10;
      return old === rounded ? old : rounded;
    });
  }, []);

  const cleanupStorage = useCallback(() => {
    fetch("/api/video/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => {});
  }, [code]);

  // ── Upload: runs in the background; the call, video and chat keep working ──
  const startUpload = useCallback(
    async (file: File) => {
      setPickerOpen(false);
      setReadyTitle(null);
      lastFileRef.current = file;
      cancelledRef.current = false;
      const report = (progress: number, st: UploadStatus["status"]) =>
        sendUploadStatus({ name: me.name, fileName: file.name, progress, status: st });

      setUpload({ fileName: file.name, progress: 0, status: "uploading" });
      report(0, "uploading");

      const handle = uploadVideo(code, file, (pct) => {
        setUpload((u) => (u && u.status === "uploading" ? { ...u, progress: pct } : u));
        const now = Date.now();
        if (now - lastSentRef.current > 1500) {
          lastSentRef.current = now;
          report(pct, "uploading");
        }
      });
      uploadRef.current = handle;

      try {
        const { path } = await handle.promise;
        uploadRef.current = null;
        setUpload(null);
        report(100, "done");
        const title = file.name.replace(/\.[a-z0-9]{1,5}$/i, "");
        await updatePlayback({ sourceType: "upload", storagePath: path, videoUrl: null, videoTitle: title, position: 0, isPlaying: false });
        setReadyTitle(title);
        pushToast("Video ready ❤️");
        cleanupStorage();
      } catch (e) {
        uploadRef.current = null;
        if (cancelledRef.current) {
          setUpload(null);
          report(0, "cancelled");
          return;
        }
        setUpload({ fileName: file.name, progress: 0, status: "error", error: uploadErrorText(e) });
        report(0, "error");
      }
    },
    [code, me.name, sendUploadStatus, updatePlayback, pushToast, cleanupStorage],
  );

  const cancelUpload = () => {
    cancelledRef.current = true;
    uploadRef.current?.cancel();
  };

  const chooseLink = (c: LinkChoice) => {
    setPickerOpen(false);
    setMode("watch");
    updatePlayback({ ...c, storagePath: null, position: 0, isPlaying: false }).then(cleanupStorage);
  };

  const removeVideo = () => {
    setPickerOpen(false);
    setReadyTitle(null);
    updatePlayback({ videoUrl: null, videoTitle: null, storagePath: null, sourceType: "url", position: 0, isPlaying: false }).then(
      cleanupStorage,
    );
  };

  const saveMeeting = useCallback(
    async (url: string | null) => {
      savingMeetingRef.current = true;
      try {
        await r.updateMeeting(url);
      } finally {
        window.setTimeout(() => (savingMeetingRef.current = false), 300);
      }
    },
    [r],
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      pushToast("Room link copied ❤️");
    } catch {
      window.prompt("Copy this link and send it to your love:", link);
    }
  };

  const logout = () => {
    if (uploading && !window.confirm("An upload is still running. Log out anyway?")) return;
    uploadRef.current?.cancel();
    clearIdentity();
    router.push("/");
  };

  if (status === "not-found") return <NotFound />;
  if (!room || !mode) return <Loading />;

  const partnerBuffering = partner?.buffering ? partner.name : null;
  const partnerUploading = partner && remoteUpload?.status === "uploading" ? remoteUpload : null;

  let overlay: React.ReactNode = null;
  if (isUpload && video.error && !video.url) {
    overlay = (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ink-950/90 px-6 text-center">
        <p className="max-w-sm text-sm text-cream/75">{video.error}</p>
        <button className="btn-ghost" onClick={() => video.refresh()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <main className="relative min-h-[100svh]">
      <Ambient dim />
      {/* Curtain fade on entering */}
      <div className="pointer-events-none fixed inset-0 z-[70] bg-ink-950 animate-curtain" />

      <header className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-6">
        <div>
          <Link href="/" className="eyebrow hover:text-cream/70">
            Our Little Cinema
          </Link>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="font-display text-2xl tracking-[0.06em] text-cream">
              {names.one} <span className="text-wine-400">❤️</span> {names.two}
            </span>
            <button
              onClick={() => setNamesOpen(true)}
              className="rounded-full p-1.5 text-cream/30 hover:bg-white/10 hover:text-cream/80"
              aria-label="Edit names"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <StatusPill status={status} partnerOnline={Boolean(partner)} partnerName={partnerName} drift={mode === "watch" ? drift : null} />
          <PresenceChips myName={me.name} partnerName={partnerDisplay} partner={partner} />
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-5">
        <div className="min-w-0 space-y-3">
          {/* Mode switcher + small love buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Room mode" className="inline-flex rounded-full border border-white/[0.08] bg-black/30 p-1 backdrop-blur">
              {(
                [
                  ["watch", "🎬 Watch"],
                  ["call", "💻 Our Call"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => (m === "call" ? openCall() : setMode(m))}
                  className={`relative rounded-full px-5 py-2 text-[14px] font-semibold transition ${
                    mode === m ? "bg-wine-500 text-white shadow-[0_6px_24px_-8px_rgba(197,58,79,0.9)]" : "text-cream/60 hover:text-cream"
                  }`}
                >
                  {label}
                  {m === "watch" && mode !== "watch" && room.isPlaying && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulseDot rounded-full bg-emerald-400" title="Playing now" />
                  )}
                  {m === "call" && mode !== "call" && room.meetingUrl && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-wine-300" title="Call link saved" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-chip" onClick={() => r.sendReaction("❤️", "I'm here ❤️")}>
                I&apos;m here ❤️
              </button>
              <button className="btn-chip" onClick={() => r.sendReaction("💋", "sent you a kiss 💋")}>
                Send a kiss 💋
              </button>
            </div>
          </div>

          {(inviteOpen || (!partner && status === "connected" && !hasVideo && !room.meetingUrl && !upload)) && (
            <InviteCard link={link} code={code} partnerName={partnerName} onClose={() => setInviteOpen(false)} />
          )}

          <UploadProgressCard
            mine={upload}
            remote={!upload ? partnerUploading : null}
            ready={readyTitle}
            showWatch={mode !== "watch"}
            onCancel={cancelUpload}
            onRetry={() => lastFileRef.current && startUpload(lastFileRef.current)}
            onDismiss={() => {
              setUpload(null);
              setReadyTitle(null);
            }}
            onWatch={() => {
              setMode("watch");
              setReadyTitle(null);
            }}
          />

          {/* 💻 Our Call: kept mounted so an in-page call keeps going while you watch */}
          {/* While you watch, a live call floats in the corner (same element, only restyled, so it never reconnects). */}
          <section
            aria-label="Our Call"
            className={
              mode === "call"
                ? "relative h-[68svh] min-h-[380px] w-full overflow-hidden rounded-2xl bg-ink-900 shadow-[0_40px_120px_-30px_rgba(122,26,44,0.55)] ring-1 ring-white/[0.06] sm:h-auto sm:min-h-[460px] sm:aspect-video"
                : inCall
                  ? "fixed bottom-20 right-3 z-40 h-[180px] w-[260px] overflow-hidden rounded-xl bg-ink-900 shadow-2xl ring-1 ring-wine-400/40 sm:bottom-24 sm:right-6 sm:h-[210px] sm:w-[340px]"
                  : "hidden"
            }
          >
            <CallStage
              code={code}
              myName={me.name}
              partnerName={partnerName}
              partnerOnline={Boolean(partner)}
              meetingUrl={room.meetingUrl}
              onSaveMeeting={saveMeeting}
              onInCallChange={setInCall}
              compact={mode !== "call"}
              openNonce={callNonce}
            />
            {mode !== "call" && inCall && (
              <button
                onClick={openCall}
                className="absolute left-2 top-2 z-20 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-cream/90 backdrop-blur hover:bg-wine-600"
              >
                ⤢ Back to our call
              </button>
            )}
          </section>

          {/* 🎬 Watch */}
          {mode === "watch" && (
            <>
              <VideoPlayer
                room={room}
                serverNow={serverNow}
                src={src}
                srcPending={isUpload && video.loading}
                overlay={overlay}
                notice={null}
                onSourceError={() => {
                  if (!isUpload || !video.url || retriedUrlRef.current === video.url) return false;
                  retriedUrlRef.current = video.url;
                  video.refresh();
                  return true;
                }}
                reactions={reactions}
                partnerBuffering={partnerBuffering}
                onPlay={(position) => updatePlayback({ isPlaying: true, position })}
                onPause={(position) => updatePlayback({ isPlaying: false, position })}
                onSeek={(position) => updatePlayback({ position })}
                onBuffering={r.setBuffering}
                onDrift={onDrift}
                onOpenPicker={() => setPickerOpen(true)}
              />
              <div className="flex flex-wrap items-end justify-between gap-3 px-1">
                <div className="min-w-0">
                  <p className="eyebrow">{hasVideo ? "Now showing" : "Watch together"}</p>
                  <p className="truncate font-display text-2xl text-cream">{hasVideo ? room.videoTitle : "Nothing chosen yet"}</p>
                </div>
                <p className="text-[13px] italic text-cream/45">
                  {partner ? `${partner.name} is watching with you` : `${partnerName} hasn't arrived yet`}
                </p>
              </div>
            </>
          )}
          {mode === "call" && (
            <p className="px-1 text-[13px] italic text-cream/45">
              {partner ? `${partner.name} is here with you` : `${partnerName} hasn't arrived yet`}
            </p>
          )}
        </div>

        <div className="lg:sticky lg:top-4 lg:h-[calc(100svh-150px)]">
          <ChatPanel
            messages={messages}
            myName={me.name}
            partnerName={partnerName}
            onSend={(t) => r.sendChat(t)}
            onReact={(e) => r.sendReaction(e)}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <nav className="sticky bottom-0 z-30 mt-5 border-t border-white/[0.06] bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-1.5 px-2 py-2.5 sm:justify-start sm:gap-2 sm:px-6 sm:py-3 [&>button]:px-3 [&>button]:py-2 [&>button]:text-[12px] sm:[&>button]:px-3.5 sm:[&>button]:text-[13px]">
          <button
            className="btn-chip"
            disabled={uploading}
            onClick={() => {
              setMode("watch");
              setPickerOpen(true);
            }}
          >
            <FilmIcon className="hidden h-4 w-4 sm:block" /> {uploading ? "Uploading…" : hasVideo ? "Change Video" : "Upload Video"}
          </button>
          <button className={`btn-chip ${mode === "call" ? "border-wine-500/50 bg-wine-500/15" : ""}`} onClick={openCall}>
            Our Call
          </button>
          <button className="btn-chip" onClick={copyLink}>
            <CopyIcon className="hidden h-4 w-4 sm:block" /> <span className="sm:hidden">Copy Link</span>
            <span className="hidden sm:inline">Copy Room Link</span>
          </button>
          <button className="btn-chip sm:ml-auto" onClick={logout}>
            Logout
          </button>
        </div>
      </nav>

      <VideoPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentTitle={hasVideo ? room.videoTitle ?? "Untitled video" : null}
        isPlaying={room.isPlaying}
        uploading={uploading}
        onUpload={startUpload}
        onChooseLink={chooseLink}
        onPlay={() => {
          setPickerOpen(false);
          updatePlayback({ isPlaying: true });
        }}
        onRemove={removeVideo}
      />
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

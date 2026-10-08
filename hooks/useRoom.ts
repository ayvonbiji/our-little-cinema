"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { measureClockOffset } from "@/lib/clock";
import { randomId } from "@/lib/identity";
import type {
  ChatMessage,
  CoupleNames,
  FloatingReaction,
  Identity,
  MessageRow,
  PresenceUser,
  RoomRow,
  RoomState,
  SourceType,
  Toast,
} from "@/lib/types";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "not-found" | "error";

export interface PlaybackChange {
  isPlaying?: boolean;
  position?: number;
  rate?: number;
  videoUrl?: string | null;
  videoTitle?: string | null;
  sourceType?: SourceType;
}

function rowToState(row: RoomRow, fallbackNames: CoupleNames): RoomState {
  return {
    code: row.code,
    videoUrl: row.video_url,
    videoTitle: row.video_title,
    sourceType: row.source_type,
    isPlaying: row.is_playing,
    position: Number(row.position) || 0,
    rate: Number(row.rate) || 1,
    updatedAt: Number(row.updated_at) || 0,
    updatedBy: row.updated_by,
    names: row.names ?? fallbackNames,
  };
}

function rowToMessage(row: MessageRow): ChatMessage {
  return { id: row.id, sender: row.sender, body: row.body, kind: row.kind, createdAt: row.created_at };
}

/**
 * Everything realtime about a room lives here:
 *  • shared playback state (Postgres row + instant broadcast events)
 *  • presence (who is connected, who is buffering)
 *  • chat + floating reactions
 *  • clock offset so both countries agree on "now"
 */
export function useRoom(code: string, me: Identity | null, fallbackNames: CoupleNames) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [peers, setPeers] = useState<PresenceUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const roomRef = useRef<RoomState | null>(null);
  const offsetRef = useRef(0);
  const meRef = useRef<Identity | null>(me);
  const bufferingRef = useRef(false);
  const everConnectedRef = useRef(false);
  const joinedAtRef = useRef(Date.now());
  meRef.current = me;

  /** Current time on the shared server clock (ms). */
  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const pushToast = useCallback((text: string) => {
    const id = randomId();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const spawnReaction = useCallback((emoji: string, name: string) => {
    const id = randomId();
    const x = 12 + Math.random() * 76;
    setReactions((r) => [...r.slice(-24), { id, emoji, name, x }]);
    window.setTimeout(() => setReactions((r) => r.filter((z) => z.id !== id)), 3400);
  }, []);

  /** Accept a state only if it is newer than what we have (last write wins). */
  const applyState = useCallback((next: RoomState) => {
    const cur = roomRef.current;
    if (cur && next.updatedAt < cur.updatedAt) return;
    roomRef.current = next;
    setRoom(next);
  }, []);

  const addMessage = useCallback((m: ChatMessage) => {
    setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m].slice(-300)));
  }, []);

  const refetchRoom = useCallback(async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("get_room", { p_code: code });
    if (error) throw error;
    const row = (data as RoomRow[] | null)?.[0];
    if (!row) return false;
    applyState(rowToState(row, fallbackNames));
    return true;
  }, [code, applyState, fallbackNames]);

  // ── Connect ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    const supabase = getSupabase();

    (async () => {
      try {
        offsetRef.current = await measureClockOffset(supabase);
      } catch {
        offsetRef.current = 0;
      }
      if (cancelled) return;

      let found = false;
      try {
        found = await refetchRoom();
      } catch {
        if (!cancelled) setStatus("error");
        return;
      }
      if (cancelled) return;
      if (!found) {
        setStatus("not-found");
        return;
      }

      const { data: msgData } = await supabase.rpc("get_messages", { p_code: code, p_limit: 120 });
      if (!cancelled && Array.isArray(msgData)) {
        setMessages((msgData as MessageRow[]).map(rowToMessage).reverse());
      }

      const channel = supabase.channel(`room:${code}`, {
        config: { broadcast: { self: false, ack: false }, presence: { key: me.clientId } },
      });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "state" }, ({ payload }) => applyState(payload as RoomState))
        .on("broadcast", { event: "chat" }, ({ payload }) => addMessage(payload as ChatMessage))
        .on("broadcast", { event: "reaction" }, ({ payload }) => {
          const p = payload as { emoji: string; name: string; label?: string };
          spawnReaction(p.emoji, p.name);
          if (p.label) pushToast(`${p.name}: ${p.label}`);
        })
        .on("broadcast", { event: "names" }, ({ payload }) => {
          const cur = roomRef.current;
          if (!cur) return;
          const next = { ...cur, names: payload as CoupleNames };
          roomRef.current = next;
          setRoom(next);
        })
        .on("presence", { event: "sync" }, () => {
          const st = channel.presenceState<PresenceUser>();
          const list: PresenceUser[] = [];
          for (const key of Object.keys(st)) {
            const entry = st[key]?.[0];
            if (entry) list.push({ clientId: entry.clientId, name: entry.name, buffering: entry.buffering, joinedAt: entry.joinedAt });
          }
          list.sort((a, b) => a.joinedAt - b.joinedAt);
          setPeers(list);
        })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
          if (key === meRef.current?.clientId) return;
          const p = newPresences[0] as unknown as PresenceUser | undefined;
          if (p?.name) pushToast(`${p.name} is watching with you ❤️`);
        })
        .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
          if (key === meRef.current?.clientId) return;
          const p = leftPresences[0] as unknown as PresenceUser | undefined;
          if (!p?.name) return;
          // Only say goodbye if they aren't still here on another device.
          window.setTimeout(() => {
            const st = channel.presenceState<PresenceUser>();
            const stillHere = Object.values(st).some((arr) => arr[0]?.name === p.name);
            if (!stillHere) pushToast(`${p.name} stepped away`);
          }, 0);
        })
        .subscribe(async (s) => {
          if (cancelled) return;
          if (s === "SUBSCRIBED") {
            const wasReconnect = everConnectedRef.current;
            everConnectedRef.current = true;
            setStatus("connected");
            await channel.track({
              clientId: me.clientId,
              name: me.name,
              buffering: bufferingRef.current,
              joinedAt: joinedAtRef.current,
            });
            // After a drop we may have missed events, so ask the database for the truth.
            if (wasReconnect) refetchRoom().catch(() => {});
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
            setStatus("reconnecting");
          }
        });
    })();

    return () => {
      cancelled = true;
      const ch = channelRef.current;
      channelRef.current = null;
      if (ch) {
        ch.untrack().catch(() => {});
        supabase.removeChannel(ch);
      }
    };
  }, [code, me, refetchRoom, applyState, addMessage, spawnReaction, pushToast]);

  // Re-measure the clock now and then; laptops drift and phones sleep.
  useEffect(() => {
    if (!me) return;
    const id = window.setInterval(async () => {
      try {
        offsetRef.current = await measureClockOffset(getSupabase(), 3);
      } catch {
        /* keep the old value */
      }
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [me]);

  // Browser offline/online and tab wake-up.
  useEffect(() => {
    const goOffline = () => setStatus((s) => (s === "connected" ? "reconnecting" : s));
    const resync = () => {
      if (document.visibilityState !== "visible" || !everConnectedRef.current) return;
      // If the socket survived the blip, we're fine; otherwise the channel's own
      // rejoin will flip us back to "connected" when it succeeds.
      if (navigator.onLine && channelRef.current?.state === "joined") setStatus("connected");
      refetchRoom().catch(() => {});
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", resync);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", resync);
    };
  }, [refetchRoom]);

  // ── Actions ────────────────────────────────────────────────────────────

  /** Play / pause / seek / change video. One event, stamped in server time. */
  const updatePlayback = useCallback(
    (change: PlaybackChange) => {
      const cur = roomRef.current;
      const who = meRef.current;
      if (!cur || !who) return;
      const next: RoomState = {
        ...cur,
        ...change,
        position: Math.max(0, change.position ?? cur.position),
        updatedAt: Math.max(serverNow(), cur.updatedAt + 1),
        updatedBy: who.name,
      };
      applyState(next);
      channelRef.current?.send({ type: "broadcast", event: "state", payload: next });
      getSupabase()
        .rpc("update_room_state", {
          p_code: next.code,
          p_video_url: next.videoUrl,
          p_video_title: next.videoTitle,
          p_source_type: next.sourceType,
          p_is_playing: next.isPlaying,
          p_position: next.position,
          p_rate: next.rate,
          p_updated_at: next.updatedAt,
          p_updated_by: next.updatedBy,
        })
        .then(({ error }) => {
          if (error) console.warn("Could not save room state", error.message);
        });
    },
    [applyState, serverNow],
  );

  const sendChat = useCallback(
    (body: string, kind: "text" | "reaction" = "text") => {
      const who = meRef.current;
      const text = body.trim().slice(0, 1000);
      if (!who || !text) return;
      const msg: ChatMessage = { id: randomId(), sender: who.name, body: text, kind, createdAt: new Date().toISOString() };
      addMessage(msg);
      channelRef.current?.send({ type: "broadcast", event: "chat", payload: msg });
      getSupabase()
        .rpc("post_message", { p_id: msg.id, p_code: code, p_sender: msg.sender, p_body: msg.body, p_kind: kind })
        .then(({ error }) => {
          if (error) console.warn("Could not save message", error.message);
        });
    },
    [addMessage, code],
  );

  const sendReaction = useCallback(
    (emoji: string, label?: string) => {
      const who = meRef.current;
      if (!who) return;
      spawnReaction(emoji, who.name);
      channelRef.current?.send({ type: "broadcast", event: "reaction", payload: { emoji, name: who.name, label } });
      sendChat(label ? `${label}` : emoji, "reaction");
    },
    [spawnReaction, sendChat],
  );

  const updateNames = useCallback(
    async (names: CoupleNames) => {
      const cur = roomRef.current;
      if (!cur) return;
      const next = { ...cur, names };
      roomRef.current = next;
      setRoom(next);
      channelRef.current?.send({ type: "broadcast", event: "names", payload: names });
      await getSupabase().rpc("update_room_names", { p_code: code, p_names: names });
    },
    [code],
  );

  const setBuffering = useCallback((buffering: boolean) => {
    if (bufferingRef.current === buffering) return;
    bufferingRef.current = buffering;
    const ch = channelRef.current;
    const who = meRef.current;
    if (ch && who) {
      ch.track({ clientId: who.clientId, name: who.name, buffering, joinedAt: joinedAtRef.current }).catch(() => {});
    }
  }, []);

  return {
    room,
    status,
    peers,
    messages,
    reactions,
    toasts,
    serverNow,
    updatePlayback,
    sendChat,
    sendReaction,
    updateNames,
    setBuffering,
    pushToast,
  };
}

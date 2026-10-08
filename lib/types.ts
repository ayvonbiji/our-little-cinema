export type SourceType = "url" | "hls" | "local" | "library";

export interface CoupleNames {
  one: string;
  two: string;
}

/**
 * The single shared truth for a room.
 * "At server-clock time `updatedAt`, the video was at `position` seconds and was
 * playing/paused at `rate`." Every client derives the current position from it.
 */
export interface RoomState {
  code: string;
  videoUrl: string | null;
  videoTitle: string | null;
  sourceType: SourceType;
  isPlaying: boolean;
  position: number;
  rate: number;
  updatedAt: number;
  updatedBy: string | null;
  names: CoupleNames;
}

export interface Identity {
  clientId: string;
  name: string;
}

export interface PresenceUser {
  clientId: string;
  name: string;
  buffering: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  body: string;
  kind: "text" | "reaction";
  createdAt: string;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  name: string;
  x: number; // 0–100, horizontal position over the video
}

export interface Toast {
  id: string;
  text: string;
}

/** Row shape coming back from Postgres. */
export interface RoomRow {
  code: string;
  video_url: string | null;
  video_title: string | null;
  source_type: SourceType;
  is_playing: boolean;
  position: number;
  rate: number;
  updated_at: number;
  updated_by: string | null;
  names: CoupleNames | null;
}

export interface MessageRow {
  id: string;
  sender: string;
  body: string;
  kind: "text" | "reaction";
  created_at: string;
}

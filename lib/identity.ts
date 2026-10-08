import type { CoupleNames, Identity } from "./types";

const ID_KEY = "olc:clientId";
const NAME_KEY = "olc:name";
const VOLUME_KEY = "olc:volume";

export const DEFAULT_NAMES: CoupleNames = {
  one: process.env.NEXT_PUBLIC_PERSON_ONE || "Ayvon",
  two: process.env.NEXT_PUBLIC_PERSON_TWO || "Aksa",
};

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: fine, we just won't remember */
  }
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** One id per browser tab session, so the same person on two devices shows up correctly. */
export function getClientId(): string {
  let id: string | null = null;
  try {
    id = window.sessionStorage.getItem(ID_KEY);
  } catch {
    /* ignore */
  }
  if (!id) {
    id = randomId();
    try {
      window.sessionStorage.setItem(ID_KEY, id);
    } catch {
      /* ignore */
    }
  }
  return id;
}

export function getSavedName(): string | null {
  return safeGet(NAME_KEY);
}

export function saveName(name: string) {
  safeSet(NAME_KEY, name);
}

/** Logout: forget who this browser is, so the next visit asks "Who's watching?" again. */
export function clearIdentity() {
  try {
    window.localStorage.removeItem(NAME_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.removeItem(ID_KEY);
  } catch {
    /* ignore */
  }
}

export function makeIdentity(name: string): Identity {
  return { clientId: getClientId(), name };
}

export function getSavedVolume(): number {
  const v = Number(safeGet(VOLUME_KEY));
  return Number.isFinite(v) && safeGet(VOLUME_KEY) !== null ? Math.min(1, Math.max(0, v)) : 0.9;
}

export function saveVolume(v: number) {
  safeSet(VOLUME_KEY, String(v));
}

export { randomId };

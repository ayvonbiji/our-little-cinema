import { customAlphabet } from "nanoid";

// No look-alike characters (0/o, 1/l/i) so codes are easy to read over a call.
const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
const make = customAlphabet(alphabet, 12);

/** e.g. "k7m2-qx9p-4hdt": about 59 bits of randomness, practically unguessable. */
export function generateRoomCode(): string {
  const raw = make();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/** Accepts a bare code or a full invite link and returns the code. */
export function parseRoomInput(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const fromLink = value.match(/\/room\/([a-z0-9-]{6,64})/i);
  const code = (fromLink ? fromLink[1] : value).toLowerCase().replace(/\s+/g, "");
  return /^[a-z0-9-]{6,64}$/.test(code) ? code : null;
}

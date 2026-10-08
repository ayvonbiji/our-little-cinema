"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Ambient from "@/components/Ambient";
import SetupNotice from "@/components/SetupNotice";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { generateRoomCode, parseRoomInput } from "@/lib/roomCode";
import { DEFAULT_NAMES } from "@/lib/identity";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "join">("idle");
  const [joinValue, setJoinValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setError(null);
    setBusy(true);
    try {
      const supabase = getSupabase();
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateRoomCode();
        const { error: err } = await supabase.rpc("create_room", { p_code: code, p_names: DEFAULT_NAMES });
        if (!err) {
          router.push(`/room/${code}?new=1`);
          return;
        }
        if (!/duplicate|unique/i.test(err.message)) throw err;
      }
      throw new Error("Could not create a room, please try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  function joinRoom(e: React.FormEvent) {
    e.preventDefault();
    const code = parseRoomInput(joinValue);
    if (!code) {
      setError("Paste the link or code your love sent you.");
      return;
    }
    router.push(`/room/${code}`);
  }

  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center px-5 py-16 text-center">
      <Ambient />

      <p className="eyebrow animate-fadeIn">
        {DEFAULT_NAMES.one.toUpperCase()} <span className="text-wine-400">❤</span> {DEFAULT_NAMES.two.toUpperCase()}
      </p>

      <h1
        className="mt-6 font-display text-[clamp(2.75rem,9vw,6.5rem)] font-medium leading-[0.95] tracking-[0.04em] text-cream animate-fadeIn [animation-delay:120ms]"
        style={{ textShadow: "0 0 60px rgba(197,58,79,0.35)" }}
      >
        OUR LITTLE
        <br />
        CINEMA
      </h1>

      <p className="mt-6 font-display text-xl italic text-cream/75 sm:text-2xl animate-fadeIn [animation-delay:240ms]">
        Different places. Same movie. Together.
      </p>

      {!isSupabaseConfigured ? (
        <SetupNotice />
      ) : (
        <div className="mt-12 flex w-full max-w-md flex-col items-center gap-4 animate-fadeIn [animation-delay:360ms]">
          {mode === "idle" ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <button className="btn-primary" onClick={createRoom} disabled={busy}>
                {busy ? "Opening the doors…" : "Create Private Room"}
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  setError(null);
                  setMode("join");
                }}
              >
                Join Room
              </button>
            </div>
          ) : (
            <form onSubmit={joinRoom} className="flex w-full flex-col gap-3">
              <input
                autoFocus
                className="field text-center"
                placeholder="Paste the link or room code"
                value={joinValue}
                onChange={(e) => setJoinValue(e.target.value)}
              />
              <div className="flex justify-center gap-3">
                <button type="submit" className="btn-primary">
                  Enter the cinema
                </button>
                <button type="button" className="btn-ghost" onClick={() => setMode("idle")}>
                  Back
                </button>
              </div>
            </form>
          )}
          {error && <p className="text-sm text-wine-300">{error}</p>}
        </div>
      )}

      <p className="absolute bottom-8 left-0 right-0 px-6 font-display text-lg italic text-cream/40 animate-fadeIn [animation-delay:600ms]">
        Distance doesn&apos;t have to mean watching alone.
      </p>
    </main>
  );
}

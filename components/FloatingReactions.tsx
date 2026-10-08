import type { FloatingReaction } from "@/lib/types";

export default function FloatingReactions({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-live="polite">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-20 flex flex-col items-center animate-floatUp"
          style={{ left: `${r.x}%` }}
        >
          <span className="text-4xl drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)] sm:text-5xl">{r.emoji}</span>
          <span className="mt-1 rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-cream/90 backdrop-blur">
            {r.name}
          </span>
        </div>
      ))}
    </div>
  );
}

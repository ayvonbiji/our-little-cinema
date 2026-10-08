/** Slow, soft burgundy light behind everything, like a cinema before the film starts. */
export default function Ambient({ dim = false }: { dim?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-950">
      <div
        className={`absolute -left-[20%] -top-[30%] h-[70vh] w-[70vw] rounded-full bg-wine-700 blur-[140px] animate-glow ${dim ? "opacity-20" : ""}`}
      />
      <div
        className={`absolute -bottom-[35%] -right-[15%] h-[70vh] w-[60vw] rounded-full bg-wine-800 blur-[160px] animate-glow [animation-delay:-4s] ${dim ? "opacity-20" : ""}`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(7,6,10,0.65)_60%,#07060a_100%)]" />
    </div>
  );
}

import type { UploadStatus } from "@/lib/types";

export interface LocalUpload {
  fileName: string;
  progress: number;
  status: "uploading" | "error";
  error?: string;
}

function Bar({ pct, soft = false }: { pct: number; soft?: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${soft ? "bg-wine-500/70" : "bg-gradient-to-r from-wine-600 to-wine-400"}`}
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/**
 * A slim card above the stage: the upload runs in the background while the
 * call, the current video and the chat all keep working.
 */
export default function UploadProgressCard({
  mine,
  remote,
  ready,
  showWatch,
  onCancel,
  onRetry,
  onDismiss,
  onWatch,
}: {
  mine: LocalUpload | null;
  remote: UploadStatus | null;
  ready: string | null;
  showWatch: boolean;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
  onWatch: () => void;
}) {
  if (mine?.status === "uploading") {
    const pct = Math.floor(mine.progress);
    return (
      <div className="panel flex items-center gap-4 px-4 py-3 animate-fadeIn">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[14px] font-semibold text-cream">Uploading video…</p>
            <p className="font-mono text-[13px] tabular-nums text-wine-300">{pct}%</p>
          </div>
          <div className="mt-2">
            <Bar pct={pct} />
          </div>
          <p className="mt-1.5 truncate text-[11.5px] text-cream/40">
            {mine.fileName} · keep this tab open; it resumes if the connection drops
          </p>
        </div>
        <button className="btn-chip shrink-0" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  if (mine?.status === "error") {
    return (
      <div className="panel flex flex-wrap items-center gap-3 border-wine-500/30 px-4 py-3 animate-fadeIn">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-cream">The upload didn&apos;t finish</p>
          <p className="text-[12.5px] text-cream/55">{mine.error}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-chip border-wine-500/50 bg-wine-500/15" onClick={onRetry}>
            Try again
          </button>
          <button className="btn-chip" onClick={onDismiss}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (remote) {
    const pct = Math.floor(remote.progress);
    return (
      <div className="panel px-4 py-3 animate-fadeIn">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[14px] text-cream/85">
            <span className="font-semibold text-cream">{remote.name}</span> is uploading a video…
          </p>
          <p className="font-mono text-[13px] tabular-nums text-cream/60">{pct}%</p>
        </div>
        <div className="mt-2">
          <Bar pct={pct} soft />
        </div>
      </div>
    );
  }

  if (ready) {
    return (
      <div className="panel flex flex-wrap items-center justify-between gap-3 border-wine-500/30 px-4 py-3 animate-fadeIn">
        <p className="min-w-0 truncate text-[14px] text-cream">
          <span className="font-semibold">Video ready ❤️</span> <span className="text-cream/55">{ready}</span>
        </p>
        <div className="flex gap-2">
          {showWatch && (
            <button className="btn-chip border-wine-500/50 bg-wine-500/15" onClick={onWatch}>
              🎬 Watch now
            </button>
          )}
          <button className="btn-chip" onClick={onDismiss}>
            OK
          </button>
        </div>
      </div>
    );
  }
  return null;
}

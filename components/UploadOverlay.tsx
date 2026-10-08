export interface LocalUpload {
  fileName: string;
  progress: number;
  status: "uploading" | "error";
  error?: string;
}

/** Shown over the player while this person is uploading (or if it failed). */
export default function UploadOverlay({
  upload,
  onCancel,
  onRetry,
  onDismiss,
}: {
  upload: LocalUpload;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const pct = Math.floor(upload.progress);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ink-950/90 px-6 text-center backdrop-blur-sm">
      {upload.status === "uploading" ? (
        <>
          <p className="eyebrow">Sharing with your love</p>
          <p className="font-display text-3xl text-cream sm:text-4xl">Uploading video… {pct}%</p>
          <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-wine-500 transition-[width] duration-500" style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
          <p className="max-w-sm truncate text-[13px] text-cream/50">{upload.fileName}</p>
          <p className="max-w-xs text-[12px] text-cream/35">Keep this tab open. If the connection drops, it picks up where it left off.</p>
          <button className="btn-chip" onClick={onCancel}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <p className="font-display text-2xl italic text-cream">The upload didn&apos;t finish</p>
          <p className="max-w-sm text-sm text-cream/60">{upload.error}</p>
          <div className="flex gap-2">
            <button className="btn-primary px-6 py-3" onClick={onRetry}>
              Try again
            </button>
            <button className="btn-ghost px-6 py-3" onClick={onDismiss}>
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}

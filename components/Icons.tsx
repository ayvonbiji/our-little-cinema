type P = { className?: string };
const base = "h-5 w-5";

export const PlayIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M7 4.8v14.4a1 1 0 0 0 1.53.85l11.2-7.2a1 1 0 0 0 0-1.7L8.53 3.95A1 1 0 0 0 7 4.8Z" />
  </svg>
);

export const PauseIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <rect x="6" y="4.5" width="4" height="15" rx="1.2" />
    <rect x="14" y="4.5" width="4" height="15" rx="1.2" />
  </svg>
);

export const BackIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v4h4" />
    <text x="12" y="15.5" fontSize="7.5" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">10</text>
  </svg>
);

export const ForwardIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v4h-4" />
    <text x="12" y="15.5" fontSize="7.5" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">10</text>
  </svg>
);

export const VolumeIcon = ({ className = base, level }: P & { level: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4Z" fill="currentColor" />
    {level === 0 ? (
      <path d="m16 9.5 5 5m0-5-5 5" />
    ) : (
      <>
        <path d="M15.5 9a4 4 0 0 1 0 6" />
        {level > 0.5 && <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />}
      </>
    )}
  </svg>
);

export const FullscreenIcon = ({ className = base, active }: P & { active: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {active ? (
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    ) : (
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    )}
  </svg>
);

export const FilmIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4" />
  </svg>
);

export const CopyIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </svg>
);

export const PencilIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
  </svg>
);

export const SendIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9l-.1 6.5Z" />
  </svg>
);

export const CloseIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  /** Affirmative tone — used for start/launch. */
  accent?: boolean;
  /** Destructive tone — used for stop/kill. */
  danger?: boolean;
}

/**
 * 32x32 outlined icon button — borrows hover tone from `accent`/`danger`.
 * Used in row actions, sub-row actions, and detail page chrome.
 */
export function IconBtn({ children, title, onClick, accent, danger, disabled }: Props) {
  const tone = danger ? "is-danger" : accent ? "is-accent" : "";
  return (
    <button
      type="button"
      className={`icon-btn ${tone}`}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export const IconPlay = (
  <svg viewBox="0 0 14 14" width="11" height="11" aria-hidden>
    <polygon points="3,2 12,7 3,12" fill="currentColor" />
  </svg>
);
export const IconStop = (
  <svg viewBox="0 0 14 14" width="11" height="11" aria-hidden>
    <rect x="3" y="3" width="8" height="8" fill="currentColor" />
  </svg>
);
export const IconPlayHollow = (
  <svg viewBox="0 0 14 14" width="11" height="11" aria-hidden>
    <polygon points="3,2 12,7 3,12" fill="none" stroke="currentColor" />
  </svg>
);
export const IconCode = (
  <svg viewBox="0 0 14 14" width="11" height="11" aria-hidden>
    <path d="M2 4 L2 10 L7 13 L12 10 L12 4 L7 1 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);
export const IconFolder = (
  <svg viewBox="0 0 14 14" width="11" height="11" aria-hidden>
    <path d="M1 4 L5 4 L6 5 L13 5 L13 12 L1 12 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);
export const IconExternal = (
  <svg viewBox="0 0 14 14" width="11" height="11" aria-hidden>
    <path d="M5 3 L11 3 L11 9" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M11 3 L4 10" fill="none" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

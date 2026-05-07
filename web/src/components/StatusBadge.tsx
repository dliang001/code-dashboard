import type { RunState } from "../types";

interface StatusMeta {
  dotVar: string;
  label: string;
  pulse: boolean;
}

const META: Record<RunState | "unknown", StatusMeta> = {
  running:           { dotVar: "var(--c-ok)",   label: "RUNNING",  pulse: true  },
  "running-external":{ dotVar: "var(--c-ext)",  label: "EXTERNAL", pulse: true  },
  starting:          { dotVar: "var(--c-warn)", label: "STARTING", pulse: true  },
  stopping:          { dotVar: "var(--c-warn)", label: "STOPPING", pulse: false },
  error:             { dotVar: "var(--c-err)",  label: "ERROR",    pulse: true  },
  idle:              { dotVar: "var(--c-mute)", label: "IDLE",     pulse: false },
  unknown:           { dotVar: "var(--c-mute)", label: "UNKNOWN",  pulse: false },
};

interface DotProps {
  state: RunState | "unknown";
  size?: number;
  /** Override the auto-derived pulse setting (e.g., suppress in compact contexts). */
  pulse?: boolean;
}

export function StatusDot({ state, size = 8, pulse }: DotProps) {
  const m = META[state] ?? META.idle;
  const shouldPulse = pulse ?? m.pulse;
  return (
    <span
      className={`status-dot ${shouldPulse ? "is-pulse" : ""}`}
      style={
        {
          ["--dot-c" as string]: m.dotVar,
          width: size,
          height: size,
        } as React.CSSProperties
      }
      aria-hidden
    />
  );
}

interface BadgeProps {
  state: RunState | "unknown";
  /** Compact mode renders only the dot — used in tight metas. */
  compact?: boolean;
}

/**
 * Status indicator: pulsing dot + small-caps label.
 * Color is the only carrier of distinction between states.
 */
export function StatusBadge({ state, compact = false }: BadgeProps) {
  if (compact) return <StatusDot state={state} />;
  const m = META[state] ?? META.idle;
  return (
    <span className="status-label" style={{ color: m.dotVar }}>
      <StatusDot state={state} />
      <span className="mono">{m.label}</span>
    </span>
  );
}

/** Direct access to label/color metadata for headings, etc. */
export function statusMeta(state: RunState | "unknown") {
  return META[state] ?? META.idle;
}

import type { PortConflict } from "../types";

interface Props {
  conflicts: PortConflict[];
}

export function ConflictBanner({ conflicts }: Props) {
  if (conflicts.length === 0) return null;
  return (
    <div
      style={{
        borderBottom: "1px solid color-mix(in srgb, var(--c-warn) 35%, var(--line))",
        background: "color-mix(in srgb, var(--c-warn) 8%, transparent)",
        padding: "8px 24px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--c-warn)" }}>
        PORT CONFLICTS
      </span>
      <span className="mono" style={{ fontSize: 13, color: "var(--c-warn)" }}>
        {conflicts.length}
      </span>
      <span style={{ color: "color-mix(in srgb, var(--c-warn) 40%, var(--ink-2))" }}>·</span>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: "0 14px",
          color: "var(--c-warn)",
        }}
      >
        {conflicts.slice(0, 6).map((c) => (
          <li key={c.port} className="mono" style={{ fontSize: 12 }}>
            :{c.port} ×{c.projectIds.length}
          </li>
        ))}
        {conflicts.length > 6 && (
          <li style={{ fontSize: 12, color: "color-mix(in srgb, var(--c-warn) 60%, var(--ink-2))" }}>
            +{conflicts.length - 6} 更多
          </li>
        )}
      </ul>
    </div>
  );
}

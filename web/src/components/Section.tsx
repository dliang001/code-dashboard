interface Props {
  label: string;
  children: React.ReactNode;
  /** Tone color via CSS class — used by overview's port-conflict panel. */
  tone?: "warn";
  className?: string;
}

/**
 * Editorial panel — small-caps header strip + body.
 * Used for every section on the Detail page.
 */
export function Section({ label, children, tone, className = "" }: Props) {
  const cls = ["panel", tone ? `is-${tone}` : "", className].filter(Boolean).join(" ");
  return (
    <section className={cls}>
      <div className="panel-head mono">{label}</div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

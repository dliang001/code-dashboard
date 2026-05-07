interface Props {
  title: string;
  body?: string;
}

export function EmptyState({ title, body }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-glyph mono">∅</div>
      <div className="empty-title">{title}</div>
      {body && <div className="empty-sub">{body}</div>}
    </div>
  );
}

import { useState } from "react";

interface Props {
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (next: string) => void;
}

export function EditableText({ value, placeholder, multiline = true, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <div className="editable-row">
        <div className="editable-text">
          {value || (
            <span className="muted-italic">{placeholder ?? "—"}</span>
          )}
        </div>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          aria-label="编辑"
        >
          <span className="mono">EDIT</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {multiline ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          autoFocus
          className="editable-input"
        />
      ) : (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          className="editable-input"
        />
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          className="run-btn is-open"
          onClick={() => {
            onSave(draft);
            setEditing(false);
          }}
        >
          保存
        </button>
        <button type="button" className="run-btn is-ghost" onClick={() => setEditing(false)}>
          取消
        </button>
      </div>
    </div>
  );
}

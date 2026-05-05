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
      <div className="flex items-start gap-2">
        <div className="flex-1 text-sm leading-relaxed whitespace-pre-wrap">
          {value ? value : <span className="italic text-gray-400">{placeholder ?? "—"}</span>}
        </div>
        <button
          type="button"
          onClick={() => { setDraft(value); setEditing(true); }}
          aria-label="编辑"
          className="text-xs text-blue-600 hover:underline flex-shrink-0"
        >
          ✎ 编辑
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {multiline ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          autoFocus
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
        />
      ) : (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      )}
      <div className="flex gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => { onSave(draft); setEditing(false); }}
          className="px-2.5 py-1 bg-gray-900 text-white rounded hover:bg-gray-800"
        >
          保存
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50"
        >
          取消
        </button>
      </div>
    </div>
  );
}

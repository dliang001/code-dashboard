import { useState } from "react";

interface Props {
  tags: string[];
  onChange: (next: string[]) => void;
}

export function TagInput({ tags, onChange }: Props) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const t = draft.trim();
    if (!t || tags.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...tags, t]);
    setDraft("");
  };

  const remove = (t: string) => onChange(tags.filter((x) => x !== t));

  return (
    <div className="hero-tags">
      {tags.map((t) => (
        <span key={t} className="tag" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <span>#{t}</span>
          <button
            type="button"
            onClick={() => remove(t)}
            aria-label={`移除 ${t}`}
            style={{ color: "var(--ink-2)", lineHeight: 1 }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
          if (e.key === "Backspace" && draft === "" && tags.length > 0) {
            remove(tags[tags.length - 1]!);
          }
        }}
        onBlur={add}
        placeholder="+ 标签"
        className="tag-input"
      />
    </div>
  );
}

import { useState } from "react";

interface Props {
  tags: string[];
  onChange: (next: string[]) => void;
}

export function TagInput({ tags, onChange }: Props) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const t = draft.trim();
    if (!t || tags.includes(t)) { setDraft(""); return; }
    onChange([...tags, t]);
    setDraft("");
  };

  const remove = (t: string) => onChange(tags.filter((x) => x !== t));

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span key={t} className="text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded inline-flex items-center gap-1">
          {t}
          <button type="button" onClick={() => remove(t)} aria-label={`移除 ${t}`} className="hover:text-blue-900">×</button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add(); }
          if (e.key === "Backspace" && draft === "" && tags.length > 0) {
            remove(tags[tags.length - 1]!);
          }
        }}
        onBlur={add}
        placeholder="+ 添加标签"
        className="text-xs px-1.5 py-0.5 border border-dashed border-gray-300 rounded outline-none focus:border-gray-500 min-w-[80px]"
      />
    </div>
  );
}

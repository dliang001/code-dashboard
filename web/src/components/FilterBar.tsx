import { useFilters } from "../hooks/useFilters";

interface Props {
  languages: string[];
  counts: { all: number; archived: number; conflicts: number };
}

export function FilterBar({ languages, counts }: Props) {
  const [filters, update] = useFilters();

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 text-xs">
        <input
          type="search"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="🔍 搜索项目名/标签/描述..."
          className="px-2.5 py-1 border border-gray-300 rounded w-64 text-sm"
        />

        <span className="text-gray-500 ml-1">筛选：</span>

        <Chip
          active={filters.language === "all"}
          onClick={() => update({ language: "all" })}
        >
          全部 {counts.all}
        </Chip>

        {languages.map((lang) => (
          <Chip
            key={lang}
            active={filters.language === lang}
            onClick={() => update({ language: lang })}
          >
            {lang}
          </Chip>
        ))}

        <Chip
          active={filters.showArchived}
          onClick={() => update({ showArchived: !filters.showArchived })}
        >
          已归档 {counts.archived}
        </Chip>

        <div className="flex-1" />

        <select
          value={filters.sort}
          onChange={(e) => update({ sort: e.target.value as "name" | "lastModified" | "status" })}
          className="px-2 py-1 border border-gray-300 rounded text-xs"
        >
          <option value="lastModified">最近修改</option>
          <option value="name">名称</option>
          <option value="status">状态</option>
        </select>
      </div>
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  const base = "px-2.5 py-0.5 rounded-full border";
  const cls = active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50";
  return (
    <button type="button" onClick={onClick} className={`${base} ${cls}`}>
      {children}
    </button>
  );
}

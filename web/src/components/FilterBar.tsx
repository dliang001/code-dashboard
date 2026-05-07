import { useFilters } from "../hooks/useFilters";
import type { StatusFilter } from "../hooks/useFilters";

interface Props {
  languages: string[];
  /** Map of category → count, drives chip badges. */
  statusCounts: Record<StatusFilter, number>;
  archivedCount: number;
}

const STATUS_OPTIONS: ReadonlyArray<readonly [StatusFilter, string]> = [
  ["all", "全部"],
  ["running", "运行中"],
  ["idle", "已停止"],
  ["error", "异常"],
];

export function FilterBar({ languages, statusCounts, archivedCount }: Props) {
  const [filters, update] = useFilters();
  return (
    <div className="filter-strip">
      <div className="search-wrap">
        <span className="search-icon mono" aria-hidden>⌕</span>
        <input
          type="search"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="搜索项目 / 标签 / 描述"
          className="search-input"
        />
        <span className="search-hint mono">⌘K</span>
      </div>

      <div className="filter-group">
        <span className="filter-label mono">STATUS</span>
        {STATUS_OPTIONS.map(([k, lbl]) => (
          <Chip
            key={k}
            active={filters.status === k}
            onClick={() => update({ status: k })}
            count={statusCounts[k]}
          >
            {lbl}
          </Chip>
        ))}
      </div>

      <div className="filter-group">
        <span className="filter-label mono">LANG</span>
        <Chip
          active={filters.language === "all"}
          onClick={() => update({ language: "all" })}
        >
          全部
        </Chip>
        {languages.map((l) => (
          <Chip
            key={l}
            active={filters.language === l}
            onClick={() => update({ language: l })}
          >
            {l}
          </Chip>
        ))}
      </div>

      <div className="filter-spacer" />

      <Chip
        active={filters.showArchived}
        onClick={() => update({ showArchived: !filters.showArchived })}
        count={archivedCount}
      >
        含归档
      </Chip>

      <select
        className="select"
        value={filters.sort}
        onChange={(e) => update({ sort: e.target.value as "name" | "lastModified" | "status" })}
      >
        <option value="lastModified">↕ 最近修改</option>
        <option value="name">↕ 名称</option>
        <option value="status">↕ 状态</option>
      </select>
    </div>
  );
}

interface ChipProps {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count?: number;
}

function Chip({ children, active, onClick, count }: ChipProps) {
  return (
    <button
      type="button"
      className={`chip ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      <span>{children}</span>
      {count != null && <span className="chip-count mono">{count}</span>}
    </button>
  );
}

import { useMemo } from "react";
import { useProjects } from "../hooks/useProjects";
import { useFilters } from "../hooks/useFilters";
import { ProjectCard } from "../components/ProjectCard";
import { EmptyState } from "../components/EmptyState";
import { FilterBar } from "../components/FilterBar";
import { ConflictBanner } from "../components/ConflictBanner";
import { applyFilters, sortProjects, groupByParent } from "../lib/filter";

export default function Grid() {
  const { data, isLoading, error } = useProjects();
  const [filters] = useFilters();

  const { filtered, languages, counts, grouped } = useMemo(() => {
    const all = data?.projects ?? [];
    const langs = Array.from(new Set(all.map((p) => p.language).filter((l): l is string => !!l))).sort();
    const filteredList = applyFilters(all, {
      search: filters.search,
      language: filters.language,
      showArchived: filters.showArchived,
    });
    const sorted = sortProjects(filteredList, filters.sort);
    const groups = groupByParent(sorted, filters.grouped);
    const cnt = {
      all: all.length,
      archived: all.filter((p) => p.archived).length,
      conflicts: data?.conflicts.length ?? 0,
    };
    return { filtered: sorted, languages: langs, counts: cnt, grouped: groups };
  }, [data, filters]);

  if (isLoading) return <Shell><p className="text-gray-500">加载中…</p></Shell>;
  if (error) return <Shell><p className="text-red-600">加载失败：{(error as Error).message}</p></Shell>;
  if (!data || data.projects.length === 0) {
    return (
      <Shell>
        <EmptyState title="还没有扫描到项目" body="点右上角『重新扫描』开始" />
      </Shell>
    );
  }

  return (
    <>
      <ConflictBanner conflicts={data.conflicts} />
      <FilterBar languages={languages} counts={counts} />
      <main className="p-5">
        <p className="text-xs text-gray-500 mb-3">显示 {filtered.length} / {data.projects.length} 个项目</p>
        {filters.grouped ? (
          <div className="space-y-6">
            {grouped.parents.map((g) => (
              <section key={g.parent.id}>
                <h3 className="text-sm font-semibold mb-2 text-gray-700">{g.parent.name}{g.children.length > 0 && <span className="text-xs text-gray-500 ml-2">{g.children.length} 子项目</span>}</h3>
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                  <ProjectCard project={g.parent} />
                  {g.children.map((c) => <ProjectCard key={c.id} project={c} />)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {filtered.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </main>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="p-5">{children}</main>;
}

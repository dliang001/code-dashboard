import { useMemo } from "react";
import { useProjects } from "../hooks/useProjects";
import { useFilters } from "../hooks/useFilters";
import { ProjectCard } from "../components/ProjectCard";
import { EmptyState } from "../components/EmptyState";
import { FilterBar } from "../components/FilterBar";
import { ConflictBanner } from "../components/ConflictBanner";
import { applyFilters, sortProjects } from "../lib/filter";
import type { Project } from "../types";

export default function Grid() {
  const { data, isLoading, error } = useProjects();
  const [filters] = useFilters();

  const { topLevel, total, languages, counts, conflictsByPort, childrenByParent } = useMemo(() => {
    const all: Project[] = data?.projects ?? [];
    const langs = Array.from(new Set(all.map((p) => p.language).filter((l): l is string => !!l))).sort();
    // Show ONLY top-level (parent === null) in the main grid.
    const tops = all.filter((p) => p.parent === null);
    const filteredList = applyFilters(tops, {
      search: filters.search,
      language: filters.language,
      showArchived: filters.showArchived,
    });
    const sorted = sortProjects(filteredList, filters.sort);
    const cnt = {
      all: tops.length,
      archived: tops.filter((p) => p.archived).length,
      conflicts: data?.conflicts.length ?? 0,
    };
    const conflictMap = new Map<number, Set<string>>();
    for (const c of (data?.conflicts ?? [])) {
      conflictMap.set(c.port, new Set(c.projectIds));
    }
    const childIndex = new Map<string, Project[]>();
    for (const proj of all) {
      if (proj.parent) {
        const list = childIndex.get(proj.parent) ?? [];
        list.push(proj);
        childIndex.set(proj.parent, list);
      }
    }
    return {
      topLevel: sorted,
      total: tops.length,
      languages: langs,
      counts: cnt,
      conflictsByPort: conflictMap,
      childrenByParent: childIndex,
    };
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
      <main className="px-5 py-5">
        <p className="text-xs text-gray-500 mb-3">显示 {topLevel.length} / {total} 个顶层项目</p>
        <div className="grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
          {topLevel.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              runState={data.runStates[p.id] ?? "idle"}
              children={childrenByParent.get(p.id) ?? []}
              childRunStates={data.runStates}
              isInConflict={isInConflict(p, conflictsByPort)}
              conflictPeerIds={getConflictPeers(p, conflictsByPort)}
            />
          ))}
        </div>
      </main>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="p-5">{children}</main>;
}

function isInConflict(p: Project, map: Map<number, Set<string>>): boolean {
  const port = p.port ?? p.portDetected;
  if (port == null) return false;
  return map.has(port);
}

function getConflictPeers(p: Project, map: Map<number, Set<string>>): string[] {
  const port = p.port ?? p.portDetected;
  if (port == null) return [];
  const peers = map.get(port);
  if (!peers) return [];
  return Array.from(peers).filter((id) => id !== p.id);
}

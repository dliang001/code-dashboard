import { useMemo } from "react";
import { useProjects } from "../hooks/useProjects";
import { useFilters, type StatusFilter } from "../hooks/useFilters";
import { ProjectRow } from "../components/ProjectCard";
import { EmptyState } from "../components/EmptyState";
import { FilterBar } from "../components/FilterBar";
import { ConflictBanner } from "../components/ConflictBanner";
import { applyFilters, sortProjects } from "../lib/filter";
import type { Project, RunState } from "../types";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onOpenLogs?: (id: string) => void;
}

function isRunningState(s: RunState | undefined): boolean {
  return s === "running" || s === "starting" || s === "running-external";
}

function isIdleState(s: RunState | undefined): boolean {
  return !s || s === "idle" || s === "stopping";
}

export default function Grid(_props: Props) {
  const { data, isLoading, error } = useProjects();
  const [filters] = useFilters();

  const {
    visible,
    languages,
    statusCounts,
    archivedCount,
    conflictsByPort,
    childCountByParent,
  } = useMemo(() => {
    const all: Project[] = data?.projects ?? [];
    const runStates = data?.runStates ?? {};
    const tops = all.filter((p) => p.parent === null);

    const langs = Array.from(
      new Set(all.map((p) => p.language).filter((l): l is string => !!l)),
    ).sort();

    // Status filter applies on top of search/language/archived.
    const baseFiltered = applyFilters(tops, {
      search: filters.search,
      language: filters.language,
      showArchived: filters.showArchived,
    });
    const statusFiltered = baseFiltered.filter((p) => {
      if (filters.status === "all") return true;
      const s = runStates[p.id];
      if (filters.status === "running") return isRunningState(s);
      if (filters.status === "idle") return isIdleState(s);
      if (filters.status === "error") return s === "error";
      return true;
    });
    const sorted = sortProjects(statusFiltered, filters.sort);

    const counts: Record<StatusFilter, number> = {
      all: tops.length,
      running: tops.filter((p) => isRunningState(runStates[p.id])).length,
      idle: tops.filter((p) => isIdleState(runStates[p.id])).length,
      error: tops.filter((p) => runStates[p.id] === "error").length,
    };

    const conflictMap = new Map<number, Set<string>>();
    for (const c of data?.conflicts ?? []) conflictMap.set(c.port, new Set(c.projectIds));

    const childCount = new Map<string, number>();
    for (const p of all) {
      if (p.parent) childCount.set(p.parent, (childCount.get(p.parent) ?? 0) + 1);
    }

    return {
      visible: sorted,
      languages: langs,
      statusCounts: counts,
      archivedCount: tops.filter((p) => p.archived).length,
      conflictsByPort: conflictMap,
      childCountByParent: childCount,
    };
  }, [data, filters]);

  if (isLoading) {
    return (
      <div className="empty-state">
        <div className="empty-glyph mono">···</div>
        <div className="empty-title">加载中</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-glyph mono">!</div>
        <div className="empty-title">加载失败</div>
        <div className="empty-sub">{(error as Error).message}</div>
      </div>
    );
  }
  if (!data || data.projects.length === 0) {
    return <EmptyState title="还没有扫描到项目" body="点右上角『RESCAN』开始" />;
  }
  const runStates = data.runStates;
  const runningMap = data.running;

  return (
    <>
      <ConflictBanner conflicts={data.conflicts} />
      <FilterBar
        languages={languages}
        statusCounts={statusCounts}
        archivedCount={archivedCount}
      />
      <div className="list">
        <div className="list-head mono">
          <div aria-hidden></div>
          <div>PROJECT · DESCRIPTION</div>
          <div>STACK · TAGS</div>
          <div>PORT</div>
          <div>STATE</div>
          <div>TOUCHED</div>
          <div style={{ textAlign: "right" }}>RUN</div>
        </div>
        {visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-glyph mono">∅</div>
            <div className="empty-title">无匹配项目</div>
            <div className="empty-sub">尝试清空筛选条件，或重新扫描工作目录</div>
          </div>
        ) : (
          <div className="list-body">
            {visible.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                runState={runStates[p.id] ?? "idle"}
                running={runningMap[p.id] ?? null}
                childCount={childCountByParent.get(p.id) ?? 0}
                conflictPeerIds={getConflictPeers(p, conflictsByPort)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function getConflictPeers(p: Project, map: Map<number, Set<string>>): string[] {
  const port = p.port ?? p.portDetected;
  if (port == null) return [];
  const peers = map.get(port);
  if (!peers) return [];
  return Array.from(peers).filter((id) => id !== p.id);
}

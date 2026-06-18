import type { Project, RunState } from "../types";

function isRunningRunState(s: RunState | undefined): boolean {
  return s === "running" || s === "starting" || s === "running-external";
}

/**
 * A project's effective run state for the list. A parent container has no
 * process of its own (its raw state is always idle), so we treat it as running
 * when any descendant is running — otherwise it would never show under the
 * 运行中 filter even with a live subproject. A project that is itself running
 * keeps its own (more specific) state.
 */
export function effectiveRunState(
  project: Project,
  all: Project[],
  runStates: Record<string, RunState>,
): RunState {
  const own = runStates[project.id] ?? "idle";
  if (isRunningRunState(own)) return own;
  for (const d of collectDescendants(all, project.id)) {
    if (isRunningRunState(runStates[d.id])) return "running";
  }
  return own;
}

export interface FilterState {
  search: string;
  language: string; // "all" or specific
  showArchived: boolean;
}

export function applyFilters(projects: Project[], f: FilterState): Project[] {
  const q = f.search.trim().toLowerCase();
  return projects.filter((p) => {
    if (!f.showArchived && p.archived) return false;
    if (f.language !== "all" && p.language !== f.language) return false;
    if (q.length === 0) return true;
    const haystack = [
      p.name,
      p.id,
      p.description ?? "",
      p.descriptionAuto ?? "",
      p.frameworks.join(" "),
      p.tags.join(" "),
    ].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

export type SortKey = "name" | "lastModified" | "status";

export function sortProjects(projects: Project[], key: SortKey): Project[] {
  const copy = [...projects];
  if (key === "name") {
    return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (key === "lastModified") {
    return copy.sort((a, b) => {
      const av = a.lastModified ?? "";
      const bv = b.lastModified ?? "";
      // most recent first; nulls last
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return bv.localeCompare(av);
    });
  }
  // status not yet meaningful (Plan 2). Stable order by name.
  return copy.sort((a, b) => a.name.localeCompare(b.name));
}

export interface GroupResult {
  /** flat list (used when grouped=false) */
  flat: Project[];
  /** parent groups (used when grouped=true). Top-level non-parents are emitted as parents with empty children. */
  parents: Array<{ parent: Project; children: Project[] }>;
}

/**
 * Walk the project tree under `rootId` (depth-first), returning every descendant
 * (children, grandchildren, …). Excludes the root itself. Order: parent before its
 * descendants, so the subprojects tab reads top-down.
 */
export function collectDescendants(projects: Project[], rootId: string): Project[] {
  const byParent = new Map<string, Project[]>();
  for (const p of projects) {
    if (p.parent) {
      const arr = byParent.get(p.parent);
      if (arr) arr.push(p);
      else byParent.set(p.parent, [p]);
    }
  }
  const out: Project[] = [];
  const visit = (id: string): void => {
    for (const c of byParent.get(id) ?? []) {
      out.push(c);
      visit(c.id);
    }
  };
  visit(rootId);
  return out;
}

export function groupByParent(projects: Project[], grouped: boolean): GroupResult {
  if (!grouped) {
    return { flat: projects, parents: [] };
  }
  const byId = new Map(projects.map((p) => [p.id, p]));
  const tops = projects.filter((p) => p.parent === null);
  const parents = tops.map((parent) => ({
    parent,
    children: parent.children
      .map((cid) => byId.get(cid))
      .filter((p): p is Project => Boolean(p)),
  }));
  return { flat: [], parents };
}

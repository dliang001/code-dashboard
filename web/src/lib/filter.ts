import type { Project } from "../types";

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

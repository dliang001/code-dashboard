import type { Project, PortConflict } from "../types.js";

export function findConflicts(projects: Project[]): PortConflict[] {
  const byId = new Map(projects.map((p) => [p.id, p]));

  // Is `ancestorId` somewhere up the parent chain of `node`?
  const isAncestorOf = (ancestorId: string, node: Project): boolean => {
    const seen = new Set<string>();
    let cur: Project | undefined = node;
    while (cur?.parent != null && !seen.has(cur.parent)) {
      if (cur.parent === ancestorId) return true;
      seen.add(cur.parent);
      cur = byId.get(cur.parent);
    }
    return false;
  };

  const byPort = new Map<number, string[]>();
  for (const p of projects) {
    const port = p.port ?? p.portDetected;
    if (port == null) continue;
    const list = byPort.get(port) ?? [];
    list.push(p.id);
    byPort.set(port, list);
  }

  const conflicts: PortConflict[] = [];
  for (const [port, ids] of byPort) {
    // Collapse parent/child pairs: a parent that only inherits its child's
    // port (nested-package / docker scan) is the same service, not a rival.
    // Drop any id that is an ancestor of another id on the same port, keeping
    // the deepest (most specific) member to represent the service.
    const collapsed = ids.filter(
      (id) => !ids.some((other) => other !== id && isAncestorOf(id, byId.get(other)!)),
    );
    if (collapsed.length >= 2) conflicts.push({ port, projectIds: collapsed });
  }
  return conflicts;
}

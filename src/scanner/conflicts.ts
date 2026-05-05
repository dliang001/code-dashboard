import type { Project, PortConflict } from "../types.js";

export function findConflicts(projects: Project[]): PortConflict[] {
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
    if (ids.length >= 2) conflicts.push({ port, projectIds: ids });
  }
  return conflicts;
}

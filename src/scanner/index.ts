import { walkProjects } from "./walk.js";
import { findConflicts } from "./conflicts.js";
import type { ScanResult } from "../types.js";

export async function scan(scanRoot: string, extraIgnored: string[] = []): Promise<ScanResult> {
  const projects = await walkProjects(scanRoot, { extraIgnored });
  const conflicts = findConflicts(projects);
  return {
    scanRoot,
    scannedAt: new Date().toISOString(),
    projects,
    conflicts,
  };
}

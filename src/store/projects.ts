import fs from "node:fs/promises";
import path from "node:path";
import type { Project, PersistedStore, ScanResult } from "../types.js";
import { DEFAULT_SETTINGS } from "../types.js";

export async function loadProjects(file: string): Promise<PersistedStore | null> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as PersistedStore;
  } catch {
    return null;
  }
}

export async function saveProjects(
  file: string,
  scan: ScanResult,
  settings = DEFAULT_SETTINGS,
): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const payload: PersistedStore = {
    version: 1,
    scanRoot: scan.scanRoot,
    scannedAt: scan.scannedAt,
    settings,
    projects: scan.projects,
  };
  await fs.writeFile(file, JSON.stringify(payload, null, 2), "utf-8");
}

/**
 * Merge a fresh scan with previously stored projects, preserving every
 * user-editable field whose USER slot is non-null/non-empty.
 *
 * User slots: description, port, startCommand, tags, archived, lastEditedByUser
 * Auto slots (always overwritten by fresh): descriptionAuto, portDetected,
 *   startCommandDetected, frameworks, language, kind, children, parent
 *
 * Projects that disappear from disk are removed.
 * New projects are added with empty user slots.
 */
export function mergeWithScan(stored: Project[], fresh: Project[]): Project[] {
  const storedById = new Map(stored.map((p) => [p.id, p]));
  return fresh.map((freshP) => {
    const prev = storedById.get(freshP.id);
    if (!prev) return freshP;
    return {
      ...freshP, // start from fresh (auto fields up-to-date)
      // restore user-only / dual-slot user values
      description: prev.description,
      port: prev.port,
      startCommand: prev.startCommand,
      tags: prev.tags,
      archived: prev.archived,
      lastEditedByUser: prev.lastEditedByUser,
    };
  });
}

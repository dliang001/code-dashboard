import fs from "node:fs/promises";
import path from "node:path";
import type { Project, PersistedStore, ScanResult } from "../types.js";
import { DEFAULT_SETTINGS } from "../types.js";

export async function loadProjects(file: string): Promise<PersistedStore | null> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(
      `Failed to read projects file ${file}: ${(err as Error).message}`,
      { cause: err },
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Corrupt projects file at ${file}: ${(err as Error).message}. Move it aside and re-scan.`,
      { cause: err },
    );
  }
  if (!isValidPersistedStore(parsed)) {
    throw new Error(
      `Invalid projects file shape at ${file}. Expected PersistedStore (version=1, projects array).`,
    );
  }
  return parsed;
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
 * User-editable fields that must be preserved across re-scans.
 * Keep in sync with the USER-EDITABLE FIELDS section in src/types.ts.
 */
const USER_PRESERVED_FIELDS = [
  "description",
  "port",
  "startCommand",
  "tags",
  "archived",
  "lastEditedByUser",
] as const satisfies readonly (keyof Project)[];

/**
 * Merge a fresh scan with previously stored projects, preserving every
 * user-editable field listed in USER_PRESERVED_FIELDS.
 *
 * Auto slots (always overwritten by fresh): descriptionAuto, portDetected,
 *   detectedUrls, startCommandDetected, frameworks, language, kind, children, parent
 *
 * Projects that disappear from disk are removed.
 * New projects are added with empty user slots.
 */
export function mergeWithScan(stored: Project[], fresh: Project[]): Project[] {
  const storedById = new Map(stored.map((p) => [p.id, p]));
  return fresh.map((freshP) => {
    const prev = storedById.get(freshP.id);
    if (!prev) return freshP;
    const merged: Project = { ...freshP };
    for (const key of USER_PRESERVED_FIELDS) {
      // @ts-expect-error TS can't narrow indexed assignment across heterogeneous keys
      merged[key] = prev[key];
    }
    return merged;
  });
}

function isValidPersistedStore(x: unknown): x is PersistedStore {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (typeof o.scanRoot !== "string") return false;
  if (typeof o.scannedAt !== "string") return false;
  if (!o.settings || typeof o.settings !== "object") return false;
  if (!Array.isArray(o.projects)) return false;
  return true;
}

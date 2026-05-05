export type ProjectKind =
  | "node"
  | "python"
  | "docker"
  | "rust"
  | "go"
  | "parent-container"
  | "self-runnable-parent"
  | "unknown";

export type RunState =
  | "idle"
  | "starting"
  | "running"
  | "running-external"
  | "stopping"
  | "error";

export interface Project {
  /** Stable id: relative path from scanRoot, separators normalized to "/" */
  id: string;
  /** Relative path from scanRoot */
  path: string;
  /** Absolute path on disk */
  absPath: string;
  kind: ProjectKind;
  name: string;

  /**
   * USER-EDITABLE FIELDS BELOW.
   * When adding a new user-editable field, also update USER_PRESERVED_FIELDS
   * in src/store/projects.ts so re-scans don't overwrite user data.
   */
  /** User-editable description; null if user hasn't set */
  description: string | null;
  /** Auto-detected (README first paragraph) */
  descriptionAuto: string | null;

  language: string | null;
  frameworks: string[];
  tags: string[];

  startCommand: string | null;
  startCommandDetected: string | null;

  port: number | null;
  portDetected: number | null;

  archived: boolean;

  /** Children ids (relative paths) for parent containers */
  children: string[];
  /** Parent id, null for top-level */
  parent: string | null;

  /** ISO timestamp when user last edited any field */
  lastEditedByUser: string | null;

  /** Auto-detected: current git branch, null if not a git repo */
  gitBranch: string | null;
  /** Auto-detected: ISO timestamp of last activity (git last commit, fallback to dir mtime) */
  lastModified: string | null;
}

export interface PortConflict {
  port: number;
  projectIds: string[];
}

export interface ScanResult {
  scanRoot: string;
  scannedAt: string;
  projects: Project[];
  conflicts: PortConflict[];
}

export interface PersistedStore {
  version: 1;
  scanRoot: string;
  scannedAt: string;
  settings: {
    probeIntervalSec: number;
    ignoredDirs: string[];
    ignoredPaths: string[];
    showArchived: boolean;
    viewMode: "flat" | "grouped";
  };
  projects: Project[];
}

export const DEFAULT_SETTINGS: PersistedStore["settings"] = {
  probeIntervalSec: 30,
  ignoredDirs: [],
  ignoredPaths: [],
  showArchived: false,
  viewMode: "flat",
};

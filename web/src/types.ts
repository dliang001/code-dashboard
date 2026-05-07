// Re-export backend types so the rest of the app can import "../types"
// without reaching back into ../../src each time.
export type {
  Project,
  ProjectKind,
  RunState,
  PortConflict,
  ScanResult,
} from "../../src/types.js";

// Frontend-specific view types live here:
export interface RunningInfo {
  id: string;
  pid: number;
  startedAt: number;
  command: string;
  state: "starting" | "running" | "stopping" | "exited";
  exitCode: number | null;
  exitedAt: number | null;
  urls?: string[];
  allocatedPort?: number | null;
  desiredPort?: number | null;
}

export interface StartResponse {
  ok: boolean;
  running: RunningInfo | null;
  desiredPort: number | null;
  allocatedPort: number | null;
  portChanged: boolean;
}

export interface LogLine {
  seq: number;
  ts: number;
  stream: "stdout" | "stderr";
  text: string;
}

export interface ProjectListResponse {
  projects: import("../../src/types.js").Project[];
  conflicts: import("../../src/types.js").PortConflict[];
  scanRoot: string;
  scannedAt: string;
  serverStartedAt?: string;
  runStates: Record<string, import("../../src/types.js").RunState>;
  running: Record<string, RunningInfo>;
}

export interface ProjectDetailResponse {
  project: import("../../src/types.js").Project;
  runState: import("../../src/types.js").RunState;
  conflictPeers: string[];
  running: RunningInfo | null;
}

export interface StartTreeResult {
  results: Array<{ id: string; ok: boolean; reason?: string }>;
}

export interface PatchPayload {
  description?: string | null;
  tags?: string[];
  startCommand?: string | null;
  port?: number | null;
  archived?: boolean;
}

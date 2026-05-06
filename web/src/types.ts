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
export interface ProjectListResponse {
  projects: import("../../src/types.js").Project[];
  conflicts: import("../../src/types.js").PortConflict[];
  scanRoot: string;
  scannedAt: string;
  runStates: Record<string, import("../../src/types.js").RunState>;
}

export interface ProjectDetailResponse {
  project: import("../../src/types.js").Project;
  runState: import("../../src/types.js").RunState;
  conflictPeers: string[];
}

export interface PatchPayload {
  description?: string | null;
  tags?: string[];
  startCommand?: string | null;
  port?: number | null;
  archived?: boolean;
}

import net from "node:net";
import type { Project, RunState } from "../types.js";
import { listRunningProcesses, matchProjectsToProcesses } from "./process.js";
import type { ProcessManager } from "../runner/process.js";

/**
 * Walk upward from `start` (capped at `start + maxAttempts - 1`) and return
 * the first port nothing is listening on. Returns null if every candidate
 * is occupied. Used to suggest an alt port when the configured one is taken.
 */
export async function findFreePort(start: number, maxAttempts = 20): Promise<number | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = start + i;
    if (port > 65535) return null;
    const open = await probePort(port);
    if (!open) return port;
  }
  return null;
}

/**
 * Try to connect to 127.0.0.1:<port>. Resolves true if connectable
 * (port is in use), false if connection refused. Times out at 500ms.
 */
export function probePort(port: number, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, "127.0.0.1");
  });
}

/**
 * In-memory cache of probed states keyed by project id.
 * Updated periodically by probeAll.
 */
export class ProbeCache {
  private state = new Map<string, RunState>();

  get(id: string): RunState {
    return this.state.get(id) ?? "idle";
  }

  set(id: string, value: RunState): void {
    this.state.set(id, value);
  }

  /** Returns a sparse map: only ids whose state is non-idle. */
  snapshot(): Record<string, RunState> {
    const out: Record<string, RunState> = {};
    for (const [id, state] of this.state) {
      if (state !== "idle") out[id] = state;
    }
    return out;
  }
}

/**
 * Sweep run-state for every project and write results into `cache`.
 *
 * Detection layers (last write wins; we order them so stronger signals overwrite weaker ones):
 *   1. Port probe: if the project has a declared port and it's accepting connections → running-external.
 *   2. Process scan: if a server-like process's command line references the project's absPath → running-external.
 *      This catches Python/Docker/etc. projects that don't have a detectable port.
 *   3. Runner overlay: if `runner` is managing the project, the API merge layer reports "running"
 *      (with PID) — this layer doesn't write that here, but it's why we never overwrite a managed
 *      project's slot with stale "idle".
 *
 * Errors in either layer are swallowed: a transient failure must not turn the whole dashboard red.
 */
export async function probeAll(
  projects: Project[],
  cache: ProbeCache,
  runner?: ProcessManager,
  concurrency = 8,
): Promise<void> {
  // Reset every non-managed project to idle so stopped projects clear correctly.
  for (const p of projects) {
    if (runner?.isManaged(p.id)) continue;
    cache.set(p.id, "idle");
  }

  // Layer 1: port probe.
  const portTargets = projects.filter((p) => (p.port ?? p.portDetected) != null);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= portTargets.length) return;
      const proj = portTargets[idx]!;
      if (runner?.isManaged(proj.id)) continue;
      const port = (proj.port ?? proj.portDetected)!;
      const open = await probePort(port);
      if (open) cache.set(proj.id, "running-external");
    }
  }
  const n = Math.min(concurrency, portTargets.length);
  await Promise.all(Array.from({ length: n }, worker));

  // Layer 2: process scan. Catches projects that have no detectable port.
  try {
    const procs = await listRunningProcesses();
    const matches = matchProjectsToProcesses(projects, procs);
    for (const id of matches.keys()) {
      if (runner?.isManaged(id)) continue;
      cache.set(id, "running-external");
    }
  } catch {
    // Process listing failed (permissions, missing PowerShell on Windows
    // image, etc.). Stay with whatever the port probe gave us.
  }
}

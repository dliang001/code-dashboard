import net from "node:net";
import type { Project, RunState } from "../types.js";

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

  snapshot(): Record<string, RunState> {
    return Object.fromEntries(this.state);
  }
}

/**
 * Probe all projects with declared ports concurrently (capped to N at a time).
 * For each project: if port is in use → "running-external", else "idle".
 * (Without spawn tracking, we can't distinguish "running by us" from "running by user".
 * Plan 2b/2c will add PID tracking and refine this.)
 */
export async function probeAll(projects: Project[], cache: ProbeCache, concurrency = 8): Promise<void> {
  const targets = projects.filter((p) => (p.port ?? p.portDetected) != null);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= targets.length) return;
      const proj = targets[idx]!;
      const port = (proj.port ?? proj.portDetected)!;
      const open = await probePort(port);
      cache.set(proj.id, open ? "running-external" : "idle");
    }
  }
  const n = Math.min(concurrency, targets.length);
  await Promise.all(Array.from({ length: n }, worker));
}

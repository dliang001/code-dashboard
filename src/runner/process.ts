import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

export interface LogLine {
  seq: number;
  ts: number;
  stream: "stdout" | "stderr";
  text: string;
}

export type ManagedState = "starting" | "running" | "stopping" | "exited";

export interface RunningInfo {
  id: string;
  pid: number;
  startedAt: number;
  command: string;
  state: ManagedState;
  exitCode: number | null;
  exitedAt: number | null;
  /** URLs we've extracted from this process's log output, dedup'd, oldest first. */
  urls: string[];
  /** Port we asked the dev server to use via PORT env, or null if we didn't override. */
  allocatedPort: number | null;
  /** Port the user originally configured (or detected) — for "wanted X, got Y" UI messaging. */
  desiredPort: number | null;
}

export interface StartResult {
  ok: true;
  info: RunningInfo;
}

export interface StartError {
  ok: false;
  code: "already-running" | "spawn-failed" | "no-command";
  message: string;
}

export interface StartOptions {
  /** Override env (merged on top of process.env). Used to inject PORT for conflict resolution. */
  env?: Record<string, string>;
  /** Port we asked the dev server to use (mirrors env.PORT). Stored so UI can say "got 5174 instead of 5173". */
  allocatedPort?: number | null;
  /** Port the user originally configured/detected. Stored so the UI can compare. */
  desiredPort?: number | null;
}

export interface ProcessManagerEvents {
  "log": (id: string, line: LogLine) => void;
  "state": (id: string, info: RunningInfo) => void;
  "url": (id: string, url: string) => void;
}

interface Managed {
  id: string;
  child: ChildProcess;
  pid: number;
  startedAt: number;
  command: string;
  state: ManagedState;
  exitCode: number | null;
  exitedAt: number | null;
  buffer: LogLine[];
  seq: number;
  urls: string[];
  urlSet: Set<string>;
  allocatedPort: number | null;
  desiredPort: number | null;
}

const MAX_LOG_LINES = 2000;
const STOP_TIMEOUT_MS = 5000;
const MAX_URLS = 16;

/**
 * Match dev-server URLs in log lines:
 *   "Local:   http://localhost:5173/"
 *   "Server running on http://127.0.0.1:8000"
 *   "Now listening on: http://0.0.0.0:3000"
 * The path component is intentionally narrow — we only want the origin so
 * "open in browser" lands on a useful page, not a deep-link.
 */
const URL_RE = /(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d{2,5})?(?:\/[A-Za-z0-9._~/\-]*)?)/g;

function normalizeUrl(raw: string): string {
  // Trim trailing punctuation that often follows a URL in a log line.
  let u = raw.replace(/[.,;:)"'>\]]+$/, "");
  // Replace 0.0.0.0 with localhost so the link is actually clickable.
  u = u.replace(/^http(s?):\/\/0\.0\.0\.0/, "http$1://localhost");
  // Drop trailing slash ONLY when the path is just "/", so /foo and /foo/
  // are still distinct (but http://x/ and http://x become identical).
  if (u.endsWith("/") && new URL(u).pathname === "/") u = u.slice(0, -1);
  return u;
}

export class ProcessManager extends EventEmitter {
  private managed = new Map<string, Managed>();

  list(): RunningInfo[] {
    return Array.from(this.managed.values()).map(toInfo);
  }

  get(id: string): RunningInfo | null {
    const m = this.managed.get(id);
    return m ? toInfo(m) : null;
  }

  isManaged(id: string): boolean {
    const m = this.managed.get(id);
    return m != null && m.state !== "exited";
  }

  /** Snapshot of {id -> RunningInfo} for active (non-exited) processes. */
  snapshot(): Record<string, RunningInfo> {
    const out: Record<string, RunningInfo> = {};
    for (const m of this.managed.values()) {
      if (m.state !== "exited") out[m.id] = toInfo(m);
    }
    return out;
  }

  getLogs(id: string, tail?: number): LogLine[] {
    const m = this.managed.get(id);
    if (!m) return [];
    if (tail == null || tail >= m.buffer.length) return [...m.buffer];
    return m.buffer.slice(m.buffer.length - tail);
  }

  start(id: string, command: string, cwd: string, options: StartOptions = {}): StartResult | StartError {
    const cmd = command.trim();
    if (!cmd) {
      return { ok: false, code: "no-command", message: "startCommand is empty" };
    }
    const existing = this.managed.get(id);
    if (existing && existing.state !== "exited") {
      return {
        ok: false,
        code: "already-running",
        message: `process for ${id} already ${existing.state}`,
      };
    }
    let child: ChildProcess;
    try {
      child = spawnShell(cmd, cwd, options.env);
    } catch (err) {
      return {
        ok: false,
        code: "spawn-failed",
        message: (err as Error).message,
      };
    }
    if (child.pid == null) {
      return {
        ok: false,
        code: "spawn-failed",
        message: "child has no pid (spawn failed)",
      };
    }
    const m: Managed = {
      id,
      child,
      pid: child.pid,
      startedAt: Date.now(),
      command: cmd,
      state: "starting",
      exitCode: null,
      exitedAt: null,
      buffer: [],
      seq: 0,
      urls: [],
      urlSet: new Set(),
      allocatedPort: options.allocatedPort ?? null,
      desiredPort: options.desiredPort ?? null,
    };
    this.managed.set(id, m);
    this.attachStreams(m);
    // Promote to "running" once we observe the spawn event (or first byte).
    child.once("spawn", () => {
      if (m.state === "starting") {
        m.state = "running";
        this.emit("state", id, toInfo(m));
      }
    });
    child.once("exit", (code, signal) => {
      m.state = "exited";
      m.exitCode = code ?? (signal != null ? -1 : null);
      m.exitedAt = Date.now();
      this.appendLog(m, "stderr", `[process exited code=${code} signal=${signal ?? "none"}]`);
      this.emit("state", id, toInfo(m));
    });
    child.once("error", (err) => {
      this.appendLog(m, "stderr", `[spawn error] ${err.message}`);
      m.state = "exited";
      m.exitCode = -1;
      m.exitedAt = Date.now();
      this.emit("state", id, toInfo(m));
    });
    this.emit("state", id, toInfo(m));
    return { ok: true, info: toInfo(m) };
  }

  /**
   * Stop a managed process, killing its descendants too.
   * Resolves when the process has exited (or after a hard-kill timeout).
   */
  async stop(id: string): Promise<{ ok: boolean; reason?: string }> {
    const m = this.managed.get(id);
    if (!m || m.state === "exited") {
      return { ok: false, reason: "not-running" };
    }
    m.state = "stopping";
    this.emit("state", id, toInfo(m));
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok: boolean, reason?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardKillTimer);
        resolve({ ok, reason });
      };
      m.child.once("exit", () => finish(true));
      try {
        killTree(m.pid);
      } catch (err) {
        this.appendLog(m, "stderr", `[stop error] ${(err as Error).message}`);
      }
      const hardKillTimer = setTimeout(() => {
        try {
          killTree(m.pid, /* hard */ true);
        } catch {
          // ignore — child likely already gone
        }
        // Give it one more beat then give up reporting success either way.
        setTimeout(() => finish(true, "hard-kill"), 500);
      }, STOP_TIMEOUT_MS);
    });
  }

  /** Stop all managed processes. Used at server shutdown. */
  async shutdown(): Promise<void> {
    const ids = Array.from(this.managed.keys()).filter((id) => this.isManaged(id));
    await Promise.all(ids.map((id) => this.stop(id).catch(() => undefined)));
  }

  private attachStreams(m: Managed): void {
    m.child.stdout?.setEncoding("utf-8");
    m.child.stderr?.setEncoding("utf-8");
    m.child.stdout?.on("data", (chunk: string) => this.ingest(m, "stdout", chunk));
    m.child.stderr?.on("data", (chunk: string) => this.ingest(m, "stderr", chunk));
  }

  private ingest(m: Managed, stream: "stdout" | "stderr", chunk: string): void {
    // Split on newline; preserve content but drop trailing empty line from final \n.
    const parts = chunk.split(/\r?\n/);
    if (parts.length > 1 && parts[parts.length - 1] === "") parts.pop();
    for (const text of parts) {
      this.appendLog(m, stream, text);
      this.scanForUrls(m, text);
    }
    if (m.state === "starting") {
      m.state = "running";
      this.emit("state", m.id, toInfo(m));
    }
  }

  private scanForUrls(m: Managed, text: string): void {
    const matches = text.match(URL_RE);
    if (!matches) return;
    for (const raw of matches) {
      let url: string;
      try { url = normalizeUrl(raw); } catch { continue; }
      if (m.urlSet.has(url)) continue;
      if (m.urls.length >= MAX_URLS) {
        const oldest = m.urls.shift();
        if (oldest) m.urlSet.delete(oldest);
      }
      m.urls.push(url);
      m.urlSet.add(url);
      this.emit("url", m.id, url);
      this.emit("state", m.id, toInfo(m));
    }
  }

  private appendLog(m: Managed, stream: "stdout" | "stderr", text: string): void {
    const line: LogLine = {
      seq: m.seq++,
      ts: Date.now(),
      stream,
      text,
    };
    m.buffer.push(line);
    if (m.buffer.length > MAX_LOG_LINES) m.buffer.shift();
    this.emit("log", m.id, line);
  }
}

function toInfo(m: Managed): RunningInfo {
  return {
    id: m.id,
    pid: m.pid,
    startedAt: m.startedAt,
    command: m.command,
    state: m.state,
    exitCode: m.exitCode,
    exitedAt: m.exitedAt,
    urls: [...m.urls],
    allocatedPort: m.allocatedPort,
    desiredPort: m.desiredPort,
  };
}

/**
 * Spawn the user's command via a shell so things like `npm run dev` resolve
 * via PATH. On Windows shell:true uses ComSpec (cmd.exe) and we kill the
 * tree via taskkill /T at stop time. On Unix we use bash -lc to pick up
 * the user's interactive PATH, and detached:true so the child becomes its
 * own process-group leader (lets us signal the group at stop time).
 */
function spawnShell(command: string, cwd: string, envOverrides?: Record<string, string>): ChildProcess {
  // Merge: parent env first, then any overrides we want to inject (e.g. PORT=5174).
  const env = envOverrides ? { ...process.env, ...envOverrides } : process.env;
  if (process.platform === "win32") {
    return spawn(command, {
      cwd,
      env,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  }
  return spawn("bash", ["-lc", command], {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Kill a process and all its descendants, cross-platform.
 * On Windows: taskkill /T /F. We always force on Windows because hidden
 *   console apps (windowsHide:true) don't respond to the polite WM_CLOSE
 *   that /T-without-/F sends — using /T alone just stalls until timeout.
 * On Unix: signal the negative pgid; SIGTERM by default, SIGKILL when hard.
 */
function killTree(pid: number, hard = false): void {
  if (process.platform === "win32") {
    const tk = spawn("taskkill.exe", ["/pid", String(pid), "/T", "/F"], {
      detached: true,
      stdio: "ignore",
    });
    tk.unref();
    return;
  }
  // Unix: send to the process group (negative pid).
  try {
    process.kill(-pid, hard ? "SIGKILL" : "SIGTERM");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return; // already gone
    // Fall back to single-process kill if pgid signaling fails.
    if (code === "EPERM" || code === "EINVAL") {
      try { process.kill(pid, hard ? "SIGKILL" : "SIGTERM"); } catch { /* ignore */ }
      return;
    }
    throw err;
  }
}

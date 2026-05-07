import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Project } from "../types.js";

const execAsync = promisify(execFile);

export interface RunningProc {
  pid: number;
  /** Full command line as observed by the OS (executable + args). */
  commandLine: string;
  /** Lower-cased basename of the executable, e.g. "node.exe" → "node.exe". */
  binName: string;
}

export interface ListeningPort {
  pid: number;
  port: number;
}

/**
 * Binary names that typically indicate a long-running developer process.
 * Editors (Code.exe, Cursor.exe, etc.) are NOT in this list — that's
 * how we keep "VSCode opened in the project folder" from being mistaken
 * for "the project is running".
 */
const SERVER_LIKE_BINS = new Set<string>([
  "node", "node.exe",
  "npm", "npm.cmd",
  "npx", "npx.cmd",
  "yarn", "yarn.cmd",
  "pnpm", "pnpm.cmd",
  "bun", "bun.exe",
  "tsx", "tsx.cmd",
  "deno", "deno.exe",
  "python", "python.exe", "python3", "python3.exe",
  "ruby", "ruby.exe",
  "go", "go.exe",
  "java", "java.exe",
  "dotnet", "dotnet.exe",
  "cargo", "cargo.exe",
  "docker", "docker.exe",
  "docker-compose", "docker-compose.exe",
  "uvicorn", "gunicorn", "fastapi",
  "rails", "puma",
  "nginx", "nginx.exe",
  "poetry",
]);

/**
 * Last segment of a path, lower-cased. Tolerates either separator.
 */
export function basename(p: string): string {
  if (!p) return "";
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return p.slice(i + 1).toLowerCase();
}

/**
 * Is this command line consistent with the project at `absPath` being the
 * one running? We require absPath to appear at a path-component boundary
 * (followed by separator, quote, whitespace, or end-of-string) so that
 * "D:\code\xyz" doesn't match "D:\code\xyz-extra".
 */
export function commandLineMatchesPath(commandLine: string, absPath: string): boolean {
  if (!commandLine || !absPath) return false;
  // Case-insensitive on Windows because "D:\Code" and "d:\code" are the same path.
  const cl = process.platform === "win32" ? commandLine.toLowerCase() : commandLine;
  const ap = process.platform === "win32" ? absPath.toLowerCase() : absPath;
  let from = 0;
  while (from <= cl.length - ap.length) {
    const idx = cl.indexOf(ap, from);
    if (idx === -1) return false;
    const after = cl.charAt(idx + ap.length);
    if (
      after === "" ||
      after === " " ||
      after === "\t" ||
      after === "\\" ||
      after === "/" ||
      after === '"' ||
      after === "'" ||
      after === ";"
    ) {
      return true;
    }
    from = idx + 1;
  }
  return false;
}

/**
 * Enumerate processes on this machine whose binary looks like a dev-server
 * runtime. Returns an empty array on failure (we never want this probe to
 * crash the dashboard).
 */
export async function listRunningProcesses(): Promise<RunningProc[]> {
  try {
    if (process.platform === "win32") {
      return await listWindows();
    }
    return await listUnix();
  } catch {
    return [];
  }
}

export async function listListeningPortsByPid(): Promise<Map<number, number[]>> {
  try {
    const rows = process.platform === "win32"
      ? await listWindowsListeningPorts()
      : await listUnixListeningPorts();
    const out = new Map<number, number[]>();
    for (const row of rows) {
      const ports = out.get(row.pid) ?? [];
      if (!ports.includes(row.port)) ports.push(row.port);
      out.set(row.pid, ports);
    }
    for (const ports of out.values()) ports.sort((a, b) => a - b);
    return out;
  } catch {
    return new Map();
  }
}

async function listWindows(): Promise<RunningProc[]> {
  // PowerShell delivers structured JSON. We project only what we need
  // (PID, CommandLine, ExecutablePath) to keep the payload small.
  const ps =
    "Get-CimInstance Win32_Process | " +
    "Select-Object ProcessId, CommandLine, ExecutablePath | " +
    "ConvertTo-Json -Compress";
  const { stdout } = await execAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", ps],
    { maxBuffer: 32 * 1024 * 1024, windowsHide: true },
  );
  const text = stdout.trim();
  if (!text) return [];
  const parsed = JSON.parse(text) as
    | { ProcessId: number; CommandLine: string | null; ExecutablePath: string | null }
    | Array<{ ProcessId: number; CommandLine: string | null; ExecutablePath: string | null }>;
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const out: RunningProc[] = [];
  for (const p of items) {
    if (!p || p.ProcessId == null) continue;
    const cl = p.CommandLine ?? "";
    const bin = basename(p.ExecutablePath ?? "");
    if (!SERVER_LIKE_BINS.has(bin)) continue;
    out.push({ pid: p.ProcessId, commandLine: cl, binName: bin });
  }
  return out;
}

async function listUnix(): Promise<RunningProc[]> {
  // ps -eo pid,comm,args — comm is the basename, args is the full command.
  // The trailing "=" suppresses headers.
  const { stdout } = await execAsync(
    "ps",
    ["-eo", "pid=,comm=,args="],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  const out: RunningProc[] = [];
  for (const line of stdout.split("\n")) {
    const m = line.match(/^\s*(\d+)\s+(\S+)\s+(.*)$/);
    if (!m) continue;
    const pid = parseInt(m[1]!, 10);
    const bin = basename(m[2]!);
    const cmd = m[3]!;
    if (!SERVER_LIKE_BINS.has(bin)) continue;
    out.push({ pid, commandLine: cmd, binName: bin });
  }
  return out;
}

async function listWindowsListeningPorts(): Promise<ListeningPort[]> {
  const { stdout } = await execAsync("netstat.exe", ["-ano", "-p", "tcp"], {
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  const out: ListeningPort[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!/\bLISTENING\b/i.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const local = parts[1]!;
    const pid = Number(parts[4]);
    const port = parseLocalPort(local);
    if (Number.isInteger(pid) && port != null) out.push({ pid, port });
  }
  return out;
}

async function listUnixListeningPorts(): Promise<ListeningPort[]> {
  const { stdout } = await execAsync("sh", ["-lc", "lsof -nP -iTCP -sTCP:LISTEN -Fp -Pn 2>/dev/null || true"], {
    maxBuffer: 8 * 1024 * 1024,
  });
  const out: ListeningPort[] = [];
  let pid: number | null = null;
  for (const line of stdout.split("\n")) {
    if (line.startsWith("p")) {
      pid = Number(line.slice(1));
    } else if (line.startsWith("n") && pid != null) {
      const port = parseLocalPort(line.slice(1));
      if (Number.isInteger(pid) && port != null) out.push({ pid, port });
    }
  }
  return out;
}

function parseLocalPort(value: string): number | null {
  const normalized = value.trim();
  const ipv6 = normalized.match(/\]:(\d{2,5})$/);
  const generic = normalized.match(/:(\d{2,5})$/);
  const raw = ipv6?.[1] ?? generic?.[1];
  if (!raw) return null;
  const port = Number(raw);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

/**
 * Match each project to a running process whose command line references it.
 * Returns a map of projectId → first-matching-pid.
 */
export function matchProjectsToProcesses(
  projects: Project[],
  procs: RunningProc[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const proj of projects) {
    if (!proj.absPath) continue;
    for (const p of procs) {
      if (commandLineMatchesPath(p.commandLine, proj.absPath)) {
        out.set(proj.id, p.pid);
        break;
      }
    }
  }
  return out;
}

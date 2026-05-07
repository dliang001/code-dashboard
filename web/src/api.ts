import type {
  Project,
  ProjectListResponse,
  ProjectDetailResponse,
  PatchPayload,
  ScanResult,
  LogLine,
  StartTreeResult,
  StartResponse,
} from "./types";

const BASE = ""; // Vite proxy in dev; same-origin in prod.

async function http<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  // Some endpoints return JSON, some empty. Handle both.
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return undefined as unknown as T;
}

export async function listProjects(): Promise<ProjectListResponse> {
  return http<ProjectListResponse>("/api/projects");
}

export async function getProject(id: string): Promise<ProjectDetailResponse> {
  return http(`/api/projects/${encodeURIComponent(id)}`);
}

export async function patchProject(id: string, body: PatchPayload): Promise<{ project: Project }> {
  return http(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function rescan(): Promise<ScanResult> {
  return http("/api/scan", { method: "POST", body: "{}" });
}

export async function openFolder(id: string): Promise<{ ok: boolean }> {
  return http(`/api/projects/${encodeURIComponent(id)}/open-folder`, { method: "POST", body: "{}" });
}

export async function openVSCode(id: string): Promise<{ ok: boolean }> {
  return http(`/api/projects/${encodeURIComponent(id)}/open-vscode`, { method: "POST", body: "{}" });
}

export async function openTerminal(id: string): Promise<{ ok: boolean }> {
  return http(`/api/projects/${encodeURIComponent(id)}/open-terminal`, { method: "POST", body: "{}" });
}

export async function startProject(id: string): Promise<StartResponse> {
  return http(`/api/projects/${encodeURIComponent(id)}/start`, { method: "POST", body: "{}" });
}

export async function stopProject(id: string): Promise<{ ok: boolean; reason?: string }> {
  return http(`/api/projects/${encodeURIComponent(id)}/stop`, { method: "POST", body: "{}" });
}

export async function startTree(id: string): Promise<StartTreeResult> {
  return http(`/api/projects/${encodeURIComponent(id)}/start-tree`, { method: "POST", body: "{}" });
}

export async function stopTree(id: string): Promise<StartTreeResult> {
  return http(`/api/projects/${encodeURIComponent(id)}/stop-tree`, { method: "POST", body: "{}" });
}

export async function getLogs(id: string, tail?: number): Promise<{ lines: LogLine[] }> {
  const q = tail != null ? `?tail=${tail}` : "";
  return http(`/api/projects/${encodeURIComponent(id)}/logs${q}`);
}

export async function adminRestart(): Promise<{ ok: boolean }> {
  return http("/api/admin/restart", { method: "POST", body: "{}" });
}

export async function adminShutdown(): Promise<{ ok: boolean }> {
  return http("/api/admin/shutdown", { method: "POST", body: "{}" });
}

/** Open a WebSocket to stream live log lines + state for one project. */
export function openLogStream(id: string): WebSocket {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${proto}//${window.location.host}/ws/projects/${encodeURIComponent(id)}/logs`;
  return new WebSocket(url);
}

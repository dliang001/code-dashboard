import type { Project, ProjectListResponse, ProjectDetailResponse, PatchPayload, ScanResult } from "./types";

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

import Fastify, { type FastifyInstance } from "fastify";
import path from "node:path";
import { scan } from "../scanner/index.js";
import { enrichAll } from "../metadata/index.js";
import { loadProjects, saveProjects, mergeWithScan } from "../store/projects.js";
import { findConflicts } from "../scanner/conflicts.js";
import type { PersistedStore, Project } from "../types.js";
import { DEFAULT_SETTINGS } from "../types.js";

export interface BuildServerOptions {
  scanRoot: string;
  dataRoot: string;
  logger?: boolean;
}

const PATCHABLE_FIELDS = new Set([
  "description", "tags", "startCommand", "port", "archived",
]);

function validatePatchBody(body: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
  for (const [key, val] of Object.entries(body)) {
    if (!PATCHABLE_FIELDS.has(key)) return { ok: false, error: `field not editable: ${key}` };
    if (val === null) continue; // nullable user fields
    switch (key) {
      case "description":
      case "startCommand":
        if (typeof val !== "string") return { ok: false, error: `${key} must be string or null` };
        break;
      case "port":
        if (typeof val !== "number" || !Number.isInteger(val) || val < 1 || val > 65535) {
          return { ok: false, error: `port must be integer 1-65535 or null` };
        }
        break;
      case "archived":
        if (typeof val !== "boolean") return { ok: false, error: `archived must be boolean` };
        break;
      case "tags":
        if (!Array.isArray(val) || !val.every((t) => typeof t === "string")) {
          return { ok: false, error: `tags must be array of strings` };
        }
        break;
    }
  }
  return { ok: true };
}

export async function buildServer(opts: BuildServerOptions): Promise<FastifyInstance> {
  const projectsFile = path.join(opts.dataRoot, "projects.json");
  const app = Fastify({ logger: opts.logger ?? false });

  async function getStoreOrEmpty(): Promise<PersistedStore> {
    const stored = await loadProjects(projectsFile);
    return stored ?? {
      version: 1,
      scanRoot: opts.scanRoot,
      scannedAt: new Date().toISOString(),
      settings: DEFAULT_SETTINGS,
      projects: [],
    };
  }

  app.get("/api/projects", async () => {
    const store = await getStoreOrEmpty();
    return {
      projects: store.projects,
      conflicts: findConflicts(store.projects),
      scanRoot: store.scanRoot,
      scannedAt: store.scannedAt,
    };
  });

  app.get<{ Params: { id: string } }>("/api/projects/:id", async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    const store = await getStoreOrEmpty();
    const project = store.projects.find((p) => p.id === id);
    if (!project) return reply.code(404).send({ error: "not found" });
    return { project };
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/api/projects/:id",
    async (req, reply) => {
      const id = decodeURIComponent(req.params.id);
      const body = req.body ?? {};
      const v = validatePatchBody(body);
      if (!v.ok) return reply.code(400).send({ error: v.error });
      const store = await getStoreOrEmpty();
      const idx = store.projects.findIndex((p) => p.id === id);
      if (idx === -1) return reply.code(404).send({ error: "not found" });
      const prev = store.projects[idx]!;
      const next: Project = {
        ...prev,
        ...body,
        lastEditedByUser: new Date().toISOString(),
      } as Project;
      store.projects[idx] = next;
      await saveProjects(
        projectsFile,
        {
          scanRoot: store.scanRoot,
          scannedAt: store.scannedAt,
          projects: store.projects,
          conflicts: findConflicts(store.projects),
        },
        store.settings,
      );
      return { project: next };
    },
  );

  app.post("/api/scan", async () => {
    const fresh = await scan(opts.scanRoot);
    const enriched = await enrichAll(fresh.projects);
    const stored = await loadProjects(projectsFile);
    const merged = mergeWithScan(stored?.projects ?? [], enriched);
    const result = { ...fresh, projects: merged, conflicts: findConflicts(merged) };
    await saveProjects(projectsFile, result, stored?.settings ?? DEFAULT_SETTINGS);
    return result;
  });

  return app;
}

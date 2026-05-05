import Fastify, { type FastifyInstance } from "fastify";
import path from "node:path";
import { scan } from "../scanner/index.js";
import { enrichAll } from "../metadata/index.js";
import { loadProjects, saveProjects, mergeWithScan } from "../store/projects.js";
import { findConflicts } from "../scanner/conflicts.js";
import type { PersistedStore, Project, ScanResult } from "../types.js";
import { DEFAULT_SETTINGS } from "../types.js";

export interface BuildServerOptions {
  scanRoot: string;
  dataRoot: string;
  logger?: boolean;
}

export interface ScanContext {
  scanRoot: string;
  projectsFile: string;
}

export async function performScanAndPersist(ctx: ScanContext): Promise<ScanResult> {
  const fresh = await scan(ctx.scanRoot);
  const enriched = await enrichAll(fresh.projects);
  const stored = await loadProjects(ctx.projectsFile);
  const merged = mergeWithScan(stored?.projects ?? [], enriched);
  const result: ScanResult = { ...fresh, projects: merged, conflicts: findConflicts(merged) };
  await saveProjects(ctx.projectsFile, result, stored?.settings ?? DEFAULT_SETTINGS);
  return result;
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

  // PowerShell's Invoke-RestMethod -Method Post defaults to form-urlencoded with empty body.
  // We don't accept form-urlencoded data anywhere, so treat it as an empty object.
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, _body, done) => {
    done(null, {});
  });

  // Replace default JSON parser with one that accepts empty body as {}.
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    const trimmed = (body as string).trim();
    if (trimmed === "") return done(null, {});
    try {
      done(null, JSON.parse(trimmed));
    } catch (err) {
      // Mark as 400 so Fastify treats it like its built-in malformed-JSON response.
      const e = err as Error & { statusCode?: number };
      e.statusCode = 400;
      done(e, undefined);
    }
  });

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
    return await performScanAndPersist({ scanRoot: opts.scanRoot, projectsFile });
  });

  return app;
}

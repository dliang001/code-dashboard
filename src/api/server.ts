import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { spawn } from "node:child_process";
import path from "node:path";
import { scan } from "../scanner/index.js";
import { enrichAll } from "../metadata/index.js";
import { loadProjects, saveProjects, mergeWithScan } from "../store/projects.js";
import { findConflicts } from "../scanner/conflicts.js";
import type { PersistedStore, Project, RunState, ScanResult } from "../types.js";
import { DEFAULT_SETTINGS } from "../types.js";
import * as openHelpers from "./open.js";
import { ProbeCache, probePort, isPortExcluded, isPortAvailable } from "../probe/port.js";
import { listListeningPortsByPid } from "../probe/process.js";
import { ProcessManager, type LogLine, type RunningInfo } from "../runner/process.js";
import { applyPortToCommand } from "../runner/schedule.js";

export interface BuildServerOptions {
  scanRoot: string;
  dataRoot: string;
  logger?: boolean;
  /** Path to web/dist for production static serving. If undefined, no static serving. */
  webDist?: string;
  probeCache?: ProbeCache;
  processManager?: ProcessManager;
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
  const runner = opts.processManager;
  const serverStartedAt = new Date().toISOString();
  await app.register(fastifyWebsocket);

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

  function mergedRunState(id: string): RunState {
    const managed = runner?.get(id);
    if (managed && managed.state !== "exited") {
      if (managed.state === "starting") return "starting";
      if (managed.state === "stopping") return "stopping";
      return "running";
    }
    return opts.probeCache?.get(id) ?? "idle";
  }

  /** Build a sparse map: only keys whose merged state is non-idle. */
  function runStatesSnapshot(ids: string[]): Record<string, RunState> {
    const out: Record<string, RunState> = {};
    for (const id of ids) {
      const s = mergedRunState(id);
      if (s !== "idle") out[id] = s;
    }
    return out;
  }

  async function runningSnapshot(): Promise<Record<string, RunningInfo>> {
    const snapshot = runner?.snapshot() ?? {};
    const portsByPid = await listListeningPortsByPid();
    const out: Record<string, RunningInfo> = {};
    for (const [id, info] of Object.entries(snapshot)) {
      out[id] = withListeningUrls(info, portsByPid.get(info.pid) ?? []);
    }
    return out;
  }

  async function runningInfo(id: string): Promise<RunningInfo | null> {
    const info = runner?.get(id);
    if (!info || info.state === "exited") return null;
    const portsByPid = await listListeningPortsByPid();
    return withListeningUrls(info, portsByPid.get(info.pid) ?? []);
  }

  function withListeningUrls(info: RunningInfo, ports: number[]): RunningInfo {
    if (info.urls.length > 0 || ports.length === 0) return info;
    return {
      ...info,
      urls: ports.map((port) => `http://localhost:${port}`),
      allocatedPort: info.allocatedPort ?? ports[0] ?? null,
      desiredPort: info.desiredPort ?? ports[0] ?? null,
    };
  }

  app.get("/api/projects", async () => {
    const store = await getStoreOrEmpty();
    const ids = store.projects.map((p) => p.id);
    return {
      projects: store.projects,
      conflicts: findConflicts(store.projects),
      scanRoot: store.scanRoot,
      scannedAt: store.scannedAt,
      serverStartedAt,
      runStates: runStatesSnapshot(ids),
      running: await runningSnapshot(),
    };
  });

  app.get<{ Params: { id: string } }>("/api/projects/:id", async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    const store = await getStoreOrEmpty();
    const project = store.projects.find((p) => p.id === id);
    if (!project) return reply.code(404).send({ error: "not found" });
    const runState = mergedRunState(id);
    const conflicts = findConflicts(store.projects);
    const port = project.port ?? project.portDetected;
    const conflictPeers = port != null
      ? (conflicts.find((c) => c.port === port)?.projectIds.filter((cid) => cid !== id) ?? [])
      : [];
    const running = await runningInfo(id);
    return {
      project,
      runState,
      conflictPeers,
      running,
    };
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

  function registerOpenRoute(suffix: string, getHelper: () => (p: string) => Promise<void>): void {
    app.post<{ Params: { id: string } }>(`/api/projects/:id/${suffix}`, async (req, reply) => {
      const id = decodeURIComponent(req.params.id);
      const store = await getStoreOrEmpty();
      const proj = store.projects.find((p) => p.id === id);
      if (!proj) return reply.code(404).send({ error: "not found" });
      try {
        await getHelper()(proj.absPath);
        return { ok: true };
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }
    });
  }

  registerOpenRoute("open-folder",   () => openHelpers.openFolder);
  registerOpenRoute("open-vscode",   () => openHelpers.openVSCode);
  registerOpenRoute("open-terminal", () => openHelpers.openTerminal);

  if (runner) registerRunnerRoutes(app, runner, getStoreOrEmpty);
  registerAdminRoutes(app, runner);

  if (opts.webDist) {
    await app.register(fastifyStatic, {
      root: opts.webDist,
      prefix: "/",
    });
    // SPA fallback: any unknown GET serves index.html
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api/")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "not found" });
    });
  }

  return app;
}

/**
 * Run the actual restart/shutdown choreography. Reply has already been sent
 * by the route handler — we're now in fire-and-forget mode and can take
 * however long the cleanup needs.
 *
 * Sequence: stop managed children → close server (releases the port) →
 * brief slack so the OS frees the bind socket → optionally respawn ourselves
 * with the same argv → exit.
 */
async function performAdminAction(
  action: "restart" | "shutdown",
  app: FastifyInstance,
  runner?: ProcessManager,
): Promise<void> {
  if (runner) {
    await runner.shutdown().catch(() => undefined);
  }
  // Race app.close() against a hard timeout — if a websocket peer refuses to
  // hang up we don't want to be stuck here forever.
  await Promise.race([
    app.close().catch(() => undefined),
    new Promise((res) => setTimeout(res, 2000)),
  ]);
  // Brief slack: gives the OS a chance to release the listening socket so the
  // next dashboard process can rebind cleanly without TIME_WAIT collisions.
  await new Promise((res) => setTimeout(res, 300));

  if (action === "restart") {
    // Re-launch using the exact same node binary + script path + flags the
    // user originally passed. detached + unref so the new process outlives us.
    const child = spawn(process.execPath, process.argv.slice(1), {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      cwd: process.cwd(),
    });
    child.unref();
  }
  process.exit(0);
}

function registerAdminRoutes(app: FastifyInstance, runner?: ProcessManager): void {
  app.post("/api/admin/restart", async (_req, reply) => {
    void reply.send({ ok: true, action: "restart" });
    // Defer the heavy lifting one tick so the response is flushed first.
    setTimeout(() => {
      performAdminAction("restart", app, runner).catch(() => process.exit(1));
    }, 50);
  });

  app.post("/api/admin/shutdown", async (_req, reply) => {
    void reply.send({ ok: true, action: "shutdown" });
    setTimeout(() => {
      performAdminAction("shutdown", app, runner).catch(() => process.exit(1));
    }, 50);
  });
}

function findProjectAndDescendants(projects: Project[], id: string): Project[] {
  const root = projects.find((p) => p.id === id);
  if (!root) return [];
  const out: Project[] = [root];
  const queue = [...root.children];
  while (queue.length > 0) {
    const cid = queue.shift()!;
    const child = projects.find((p) => p.id === cid);
    if (!child) continue;
    out.push(child);
    queue.push(...child.children);
  }
  return out;
}

function registerRunnerRoutes(
  app: FastifyInstance,
  runner: ProcessManager,
  getStore: () => Promise<PersistedStore>,
): void {
  interface StartOutcome {
    id: string;
    ok: boolean;
    reason?: string;
    desiredPort?: number | null;
    allocatedPort?: number | null;
    portChanged?: boolean;
  }

  /** Ports already handed out to other still-running managed processes. */
  function reservedPorts(): Set<number> {
    const reserved = new Set<number>();
    for (const info of runner.list()) {
      if (info.state === "exited") continue;
      if (info.allocatedPort != null) reserved.add(info.allocatedPort);
    }
    return reserved;
  }

  /** First bindable port ≥ start that isn't already reserved this session. */
  async function findFreePortAvoiding(start: number, reserved: Set<number>): Promise<number | null> {
    for (let port = start, tries = 0; port <= 65535 && tries < 500; port++, tries++) {
      if (reserved.has(port)) continue;
      if (await isPortAvailable(port)) return port;
    }
    return null;
  }

  async function startOne(proj: Project): Promise<StartOutcome> {
    const cmd = proj.startCommand ?? proj.startCommandDetected;
    if (!cmd || cmd.trim() === "") return { id: proj.id, ok: false, reason: "no-command" };
    const desiredPort = proj.port ?? proj.portDetected;
    let allocatedPort: number | null = desiredPort;
    let portChanged = false;
    let command = cmd;
    let env: Record<string, string> = {};

    // Conflict scheduling: a port is unavailable if the OS is using/reserving
    // it OR another project we just launched this session already claimed it
    // (covers start-tree of several same-port siblings, e.g. five :3000 apps).
    // When taken, allocate the next free port and inject it the way THIS tool
    // understands — Vite needs --port on argv, others read PORT env, and an
    // explicit --port in the command gets rewritten. See runner/schedule.ts.
    if (desiredPort != null && !runner.isManaged(proj.id)) {
      const reserved = reservedPorts();
      const inUse =
        reserved.has(desiredPort) ||
        (await isPortExcluded(desiredPort)) ||
        (await probePort(desiredPort));
      if (inUse) {
        const free = await findFreePortAvoiding(desiredPort + 1, reserved);
        if (free == null) return { id: proj.id, ok: false, reason: "no-free-port", desiredPort };
        allocatedPort = free;
        portChanged = true;
        const injected = applyPortToCommand(cmd, proj.frameworks, free);
        command = injected.command;
        env = injected.env;
      }
    }

    const r = runner.start(proj.id, command, proj.absPath, {
      env,
      desiredPort,
      allocatedPort,
    });
    if (!r.ok) return { id: proj.id, ok: false, reason: r.code, desiredPort, allocatedPort };
    return { id: proj.id, ok: true, desiredPort, allocatedPort, portChanged };
  }

  app.post<{ Params: { id: string } }>("/api/projects/:id/start", async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    const store = await getStore();
    const proj = store.projects.find((p) => p.id === id);
    if (!proj) return reply.code(404).send({ error: "not found" });
    const r = await startOne(proj);
    if (!r.ok) {
      const status = r.reason === "no-command" ? 400 : r.reason === "no-free-port" ? 409 : 500;
      return reply.code(status).send({ error: r.reason, desiredPort: r.desiredPort });
    }
    return {
      ok: true,
      running: runner.get(id),
      desiredPort: r.desiredPort,
      allocatedPort: r.allocatedPort,
      portChanged: r.portChanged,
    };
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/stop", async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    if (!runner.isManaged(id)) return reply.code(409).send({ error: "not-running" });
    const r = await runner.stop(id);
    return { ok: r.ok, reason: r.reason };
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/start-tree", async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    const store = await getStore();
    const targets = findProjectAndDescendants(store.projects, id);
    if (targets.length === 0) return reply.code(404).send({ error: "not found" });
    const results = await Promise.all(targets.map(startOne));
    return { results };
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/stop-tree", async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    const store = await getStore();
    const targets = findProjectAndDescendants(store.projects, id);
    if (targets.length === 0) return reply.code(404).send({ error: "not found" });
    const results = await Promise.all(
      targets
        .filter((p) => runner.isManaged(p.id))
        .map(async (p) => {
          const r = await runner.stop(p.id);
          return { id: p.id, ok: r.ok, reason: r.reason };
        }),
    );
    return { results };
  });

  app.get<{ Params: { id: string }; Querystring: { tail?: string } }>(
    "/api/projects/:id/logs",
    async (req) => {
      const id = decodeURIComponent(req.params.id);
      const tail = req.query.tail != null ? Number(req.query.tail) : undefined;
      return { lines: runner.getLogs(id, Number.isFinite(tail) ? tail : undefined) };
    },
  );

  // WebSocket: stream live log lines + state changes for a single project.
  app.get<{ Params: { id: string } }>(
    "/ws/projects/:id/logs",
    { websocket: true },
    (socket, req) => {
      const id = decodeURIComponent(req.params.id);
      // Replay the full buffer so a fresh client gets context.
      for (const line of runner.getLogs(id)) {
        socket.send(JSON.stringify({ type: "log", line }));
      }
      const info = runner.get(id);
      if (info) socket.send(JSON.stringify({ type: "state", info }));

      const onLog = (lid: string, line: LogLine) => {
        if (lid !== id) return;
        socket.send(JSON.stringify({ type: "log", line }));
      };
      const onState = (lid: string, info: RunningInfo) => {
        if (lid !== id) return;
        socket.send(JSON.stringify({ type: "state", info }));
      };
      const onUrl = (lid: string, url: string) => {
        if (lid !== id) return;
        socket.send(JSON.stringify({ type: "url", url }));
      };
      runner.on("log", onLog);
      runner.on("state", onState);
      runner.on("url", onUrl);
      socket.on("close", () => {
        runner.off("log", onLog);
        runner.off("state", onState);
        runner.off("url", onUrl);
      });
    },
  );
}

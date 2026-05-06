import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildServer } from "../src/api/server";
import { ProbeCache } from "../src/probe/port";
import type { FastifyInstance } from "fastify";

const FIX = path.join(__dirname, "fixtures", "sample-tree");
let server: FastifyInstance;
let tmpRoot: string;
let cache: ProbeCache;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "dash-runstate-"));
  cache = new ProbeCache();
  server = await buildServer({ scanRoot: FIX, dataRoot: tmpRoot, probeCache: cache });
  await server.inject({ method: "POST", url: "/api/scan" });
});

afterEach(async () => {
  await server.close();
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("runState in /api/projects", () => {
  it("returns empty runStates map by default", async () => {
    const res = await server.inject({ method: "GET", url: "/api/projects" });
    const body = res.json() as { runStates: Record<string, string> };
    expect(body.runStates).toEqual({});
  });

  it("includes set states from probe cache", async () => {
    cache.set("node-app", "running-external");
    const res = await server.inject({ method: "GET", url: "/api/projects" });
    const body = res.json() as { runStates: Record<string, string> };
    expect(body.runStates["node-app"]).toBe("running-external");
  });
});

describe("runState in /api/projects/:id", () => {
  it("returns idle by default", async () => {
    const res = await server.inject({ method: "GET", url: "/api/projects/" + encodeURIComponent("node-app") });
    const body = res.json() as { runState: string };
    expect(body.runState).toBe("idle");
  });

  it("returns cached state when set", async () => {
    cache.set("node-app", "running-external");
    const res = await server.inject({ method: "GET", url: "/api/projects/" + encodeURIComponent("node-app") });
    const body = res.json() as { runState: string };
    expect(body.runState).toBe("running-external");
  });
});

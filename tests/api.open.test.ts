import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import * as openModule from "../src/api/open";
import { buildServer } from "../src/api/server";
import type { FastifyInstance } from "fastify";

const FIX = path.join(__dirname, "fixtures", "sample-tree");
let server: FastifyInstance;
let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "dash-open-"));
  server = await buildServer({ scanRoot: FIX, dataRoot: tmpRoot });
  await server.inject({ method: "POST", url: "/api/scan" });
});

afterEach(async () => {
  await server.close();
  await fs.rm(tmpRoot, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("POST /api/projects/:id/open-folder", () => {
  it("returns 200 + ok:true for a valid project", async () => {
    const spy = vi.spyOn(openModule, "openFolder").mockImplementation(() => {});
    const res = await server.inject({
      method: "POST",
      url: "/api/projects/" + encodeURIComponent("node-app") + "/open-folder",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toContain("node-app");
  });

  it("returns 404 for unknown project id", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/projects/does-not-exist/open-folder",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 500 when openFolder throws", async () => {
    vi.spyOn(openModule, "openFolder").mockImplementation(() => {
      throw new Error("explorer.exe not found");
    });
    const res = await server.inject({
      method: "POST",
      url: "/api/projects/" + encodeURIComponent("node-app") + "/open-folder",
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: expect.stringContaining("explorer.exe") });
  });
});

describe("POST /api/projects/:id/open-vscode", () => {
  it("returns 200 for valid project", async () => {
    vi.spyOn(openModule, "openVSCode").mockImplementation(() => {});
    const res = await server.inject({
      method: "POST",
      url: "/api/projects/" + encodeURIComponent("node-app") + "/open-vscode",
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("POST /api/projects/:id/open-terminal", () => {
  it("returns 200 for valid project", async () => {
    vi.spyOn(openModule, "openTerminal").mockImplementation(() => {});
    const res = await server.inject({
      method: "POST",
      url: "/api/projects/" + encodeURIComponent("node-app") + "/open-terminal",
    });
    expect(res.statusCode).toBe(200);
  });
});

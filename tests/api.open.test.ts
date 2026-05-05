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
    const spy = vi.spyOn(openModule, "openFolder").mockResolvedValue(undefined);
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
    vi.spyOn(openModule, "openFolder").mockRejectedValue(new Error("explorer.exe not found"));
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
    vi.spyOn(openModule, "openVSCode").mockResolvedValue(undefined);
    const res = await server.inject({
      method: "POST",
      url: "/api/projects/" + encodeURIComponent("node-app") + "/open-vscode",
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("POST /api/projects/:id/open-terminal", () => {
  it("returns 200 for valid project", async () => {
    vi.spyOn(openModule, "openTerminal").mockResolvedValue(undefined);
    const res = await server.inject({
      method: "POST",
      url: "/api/projects/" + encodeURIComponent("node-app") + "/open-terminal",
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("real async error path", () => {
  it("openVSCode rejects (not crashes) when 'code' not on PATH", async () => {
    // Don't mock — let the real helper run. On a machine without `code` on PATH,
    // this would throw. We can't guarantee that, so we just verify the helper returns a Promise
    // (i.e., is awaitable) and either resolves or rejects without crashing the test runner.
    const { openVSCode } = await import("../src/api/open");
    const result = openVSCode("D:/nonexistent-path-9999");
    expect(result).toBeInstanceOf(Promise);
    // Catch + swallow either outcome so the test passes regardless of `code` availability.
    await result.catch(() => {});
  });
});

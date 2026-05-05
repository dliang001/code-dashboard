import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildServer } from "../src/api/server";
import type { FastifyInstance } from "fastify";

const FIX = path.join(__dirname, "fixtures", "sample-tree");
let server: FastifyInstance;
let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "dash-api-"));
  server = await buildServer({ scanRoot: FIX, dataRoot: tmpRoot });
});

afterEach(async () => {
  await server.close();
});

describe("GET /api/projects", () => {
  it("returns the scanned project list with conflicts", async () => {
    await server.inject({ method: "POST", url: "/api/scan" }); // ensure scanned
    const res = await server.inject({ method: "GET", url: "/api/projects" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { projects: unknown[]; conflicts: unknown[] };
    expect(body.projects.length).toBeGreaterThan(5);
    expect(Array.isArray(body.conflicts)).toBe(true);
  });
});

describe("PATCH /api/projects/:id", () => {
  it("updates user-editable fields", async () => {
    await server.inject({ method: "POST", url: "/api/scan" });
    const res = await server.inject({
      method: "PATCH",
      url: "/api/projects/" + encodeURIComponent("node-app"),
      payload: { description: "manually written", tags: ["活跃"] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { project: { description: string; tags: string[] } };
    expect(body.project.description).toBe("manually written");
    expect(body.project.tags).toEqual(["活跃"]);
  });

  it("rejects unknown fields with descriptive error", async () => {
    await server.inject({ method: "POST", url: "/api/scan" });
    const res = await server.inject({
      method: "PATCH",
      url: "/api/projects/" + encodeURIComponent("node-app"),
      payload: { language: "spanish" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: expect.stringContaining("language") });
  });

  it("rejects PATCH with wrong-typed archived", async () => {
    await server.inject({ method: "POST", url: "/api/scan" });
    const res = await server.inject({
      method: "PATCH",
      url: "/api/projects/" + encodeURIComponent("node-app"),
      payload: { archived: "yes" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: expect.stringContaining("archived") });
  });

  it("rejects PATCH with non-integer port", async () => {
    await server.inject({ method: "POST", url: "/api/scan" });
    const res = await server.inject({
      method: "PATCH",
      url: "/api/projects/" + encodeURIComponent("node-app"),
      payload: { port: "3000" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects PATCH with port out of range", async () => {
    await server.inject({ method: "POST", url: "/api/scan" });
    const res = await server.inject({
      method: "PATCH",
      url: "/api/projects/" + encodeURIComponent("node-app"),
      payload: { port: 70000 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects PATCH with non-array tags", async () => {
    await server.inject({ method: "POST", url: "/api/scan" });
    const res = await server.inject({
      method: "PATCH",
      url: "/api/projects/" + encodeURIComponent("node-app"),
      payload: { tags: "single-string" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("accepts PATCH with valid types", async () => {
    await server.inject({ method: "POST", url: "/api/scan" });
    const res = await server.inject({
      method: "PATCH",
      url: "/api/projects/" + encodeURIComponent("node-app"),
      payload: { archived: true, port: 5000, tags: ["a", "b"] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { project: { archived: boolean; port: number; tags: string[] } };
    expect(body.project.archived).toBe(true);
    expect(body.project.port).toBe(5000);
    expect(body.project.tags).toEqual(["a", "b"]);
  });

  it("returns 404 for unknown project id with error body", async () => {
    await server.inject({ method: "POST", url: "/api/scan" });
    const res = await server.inject({
      method: "PATCH",
      url: "/api/projects/does-not-exist",
      payload: { description: "x" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "not found" });
  });
});

describe("POST /api/scan", () => {
  it("re-scans and returns updated result", async () => {
    const res = await server.inject({ method: "POST", url: "/api/scan" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { projects: unknown[] };
    expect(body.projects.length).toBeGreaterThan(0);
  });

  it("preserves user edits across re-scan", async () => {
    await server.inject({ method: "POST", url: "/api/scan" });
    await server.inject({
      method: "PATCH",
      url: "/api/projects/" + encodeURIComponent("node-app"),
      payload: { description: "kept across rescans" },
    });
    await server.inject({ method: "POST", url: "/api/scan" });
    const res = await server.inject({ method: "GET", url: "/api/projects/" + encodeURIComponent("node-app") });
    const body = res.json() as { project: { description: string } };
    expect(body.project.description).toBe("kept across rescans");
  });
});

describe("POST content-type tolerance", () => {
  it("accepts POST /api/scan with form-urlencoded content-type and empty body", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/scan",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "",
    });
    expect(res.statusCode).toBe(200);
  });

  it("accepts POST /api/scan with json content-type and empty body", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/scan",
      headers: { "content-type": "application/json" },
      payload: "",
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects PATCH with json content-type and malformed JSON body", async () => {
    await server.inject({ method: "POST", url: "/api/scan" });
    const res = await server.inject({
      method: "PATCH",
      url: "/api/projects/" + encodeURIComponent("node-app"),
      headers: { "content-type": "application/json" },
      payload: "{ not valid",
    });
    // Fastify still returns 400 for malformed JSON
    expect(res.statusCode).toBe(400);
  });
});

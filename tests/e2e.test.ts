import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildServer } from "../src/api/server";
import type { FastifyInstance } from "fastify";

const REAL_ROOT = "D:\\code";
let server: FastifyInstance;
let tmpData: string;

beforeAll(async () => {
  tmpData = await fs.mkdtemp(path.join(os.tmpdir(), "dash-e2e-"));
  server = await buildServer({ scanRoot: REAL_ROOT, dataRoot: tmpData });
}, 30000);

afterAll(async () => {
  await server.close();
});

describe("e2e against real D:\\code", () => {
  it("scans without throwing", async () => {
    const res = await server.inject({ method: "POST", url: "/api/scan" });
    expect(res.statusCode).toBe(200);
  }, 60000);

  it("returns at least 20 projects", async () => {
    const res = await server.inject({ method: "GET", url: "/api/projects" });
    const body = res.json() as { projects: unknown[] };
    expect(body.projects.length).toBeGreaterThanOrEqual(20);
  });

  it("identifies known projects from D:\\code", async () => {
    const res = await server.inject({ method: "GET", url: "/api/projects" });
    const body = res.json() as { projects: { id: string }[] };
    const ids = body.projects.map((p) => p.id);
    expect(ids).toContain("autoposter");
    expect(ids).toContain("photo");
  });

  it("handles Chinese path names", async () => {
    const res = await server.inject({ method: "GET", url: "/api/projects" });
    const body = res.json() as { projects: { id: string }[] };
    const cn = body.projects.filter((p) => /[一-鿿]/.test(p.id));
    expect(cn.length).toBeGreaterThan(0);
  });
});

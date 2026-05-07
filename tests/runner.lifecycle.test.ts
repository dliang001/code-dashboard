import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProcessManager } from "../src/runner/process.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(here, "fixtures", "runner");
const echoLoop = path.join(fixtureDir, "echo-loop.js");
// Quote the absolute path so spaces in directory names don't break the shell.
const echoCmd = `node "${echoLoop}"`;

function waitFor<T>(check: () => T | undefined, timeoutMs = 3000, stepMs = 25): Promise<T> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const v = check();
      if (v !== undefined && v !== null && v !== false) return resolve(v as T);
      if (Date.now() - start > timeoutMs) return reject(new Error("waitFor timeout"));
      setTimeout(tick, stepMs);
    };
    tick();
  });
}

describe("ProcessManager", () => {
  let mgr: ProcessManager;
  beforeEach(() => { mgr = new ProcessManager(); });
  afterEach(async () => { await mgr.shutdown(); });

  it("rejects empty command", () => {
    const r = mgr.start("p1", "  ", fixtureDir);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("no-command");
  });

  it("starts a process and reports running state", async () => {
    const r = mgr.start("p1", echoCmd, fixtureDir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.info.pid).toBeGreaterThan(0);
    // Wait for at least one log line — proves the child actually executed.
    const lines = await waitFor(() => {
      const l = mgr.getLogs("p1");
      return l.length > 0 ? l : undefined;
    });
    expect(lines[0]?.text).toMatch(/tick/);
    const info = mgr.get("p1");
    expect(info?.state === "running" || info?.state === "starting").toBe(true);
  });

  it("rejects starting the same id twice while running", async () => {
    const r1 = mgr.start("p1", echoCmd, fixtureDir);
    expect(r1.ok).toBe(true);
    await waitFor(() => mgr.getLogs("p1").length > 0);
    const r2 = mgr.start("p1", echoCmd, fixtureDir);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe("already-running");
  });

  it("stops a running process and reports exited state", async () => {
    const r = mgr.start("p1", echoCmd, fixtureDir);
    expect(r.ok).toBe(true);
    await waitFor(() => mgr.getLogs("p1").length > 0);
    const stopped = await mgr.stop("p1");
    expect(stopped.ok).toBe(true);
    const info = mgr.get("p1");
    expect(info?.state).toBe("exited");
    expect(mgr.isManaged("p1")).toBe(false);
  });

  it("allows restart after a clean stop", async () => {
    const r1 = mgr.start("p1", echoCmd, fixtureDir);
    expect(r1.ok).toBe(true);
    await waitFor(() => mgr.getLogs("p1").length > 0);
    await mgr.stop("p1");
    const r2 = mgr.start("p1", echoCmd, fixtureDir);
    expect(r2.ok).toBe(true);
  });

  it("stop on an unknown id reports not-running", async () => {
    const r = await mgr.stop("does-not-exist");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not-running");
  });

  it("getLogs(tail=N) returns last N lines", async () => {
    mgr.start("p1", echoCmd, fixtureDir);
    await waitFor(() => mgr.getLogs("p1").length >= 3);
    const tail = mgr.getLogs("p1", 2);
    expect(tail.length).toBeLessThanOrEqual(2);
    const all = mgr.getLogs("p1");
    expect(tail[tail.length - 1]?.seq).toBe(all[all.length - 1]?.seq);
  });

  it("emits log events as lines arrive", async () => {
    const events: string[] = [];
    mgr.on("log", (id, line) => { if (id === "p1") events.push(line.text); });
    mgr.start("p1", echoCmd, fixtureDir);
    await waitFor(() => events.length >= 2);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.every((t) => t.startsWith("tick"))).toBe(true);
  });

  it("snapshot reflects active processes only", async () => {
    mgr.start("p1", echoCmd, fixtureDir);
    await waitFor(() => mgr.getLogs("p1").length > 0);
    expect(Object.keys(mgr.snapshot())).toContain("p1");
    await mgr.stop("p1");
    expect(Object.keys(mgr.snapshot())).not.toContain("p1");
  });

  it("shutdown stops all managed children", async () => {
    mgr.start("p1", echoCmd, fixtureDir);
    mgr.start("p2", echoCmd, fixtureDir);
    await waitFor(() => mgr.getLogs("p1").length > 0 && mgr.getLogs("p2").length > 0);
    await mgr.shutdown();
    expect(mgr.snapshot()).toEqual({});
  });

  it("extracts access URLs from log lines", async () => {
    // Fixture that prints a vite-like banner then exits.
    const urlScript = path.join(fixtureDir, "url-emitter.js");
    require("node:fs").writeFileSync(
      urlScript,
      `console.log('  Local:   http://localhost:5174/');\n` +
      `console.log('Server running on http://127.0.0.1:8000.');\n` +
      `setInterval(() => {}, 1000);\n`,
    );
    mgr.start("p1", `node "${urlScript}"`, fixtureDir);
    await waitFor(() => (mgr.get("p1")?.urls.length ?? 0) >= 2);
    const info = mgr.get("p1");
    expect(info?.urls).toContain("http://localhost:5174");
    expect(info?.urls).toContain("http://127.0.0.1:8000");
  });

  it("dedupes URLs that appear multiple times", async () => {
    const urlScript = path.join(fixtureDir, "url-dup.js");
    require("node:fs").writeFileSync(
      urlScript,
      `for (let i = 0; i < 5; i++) console.log('  Local: http://localhost:3000/');\n` +
      `setInterval(() => {}, 1000);\n`,
    );
    mgr.start("p1", `node "${urlScript}"`, fixtureDir);
    await waitFor(() => (mgr.get("p1")?.urls.length ?? 0) >= 1);
    // Wait an extra beat in case more dup writes are coming.
    await new Promise((r) => setTimeout(r, 100));
    expect(mgr.get("p1")?.urls.length).toBe(1);
  });

  it("passes PORT env var via StartOptions.env", async () => {
    const portScript = path.join(fixtureDir, "port-echo.js");
    require("node:fs").writeFileSync(
      portScript,
      `console.log('PORT=' + process.env.PORT);\n` +
      `setInterval(() => {}, 1000);\n`,
    );
    mgr.start("p1", `node "${portScript}"`, fixtureDir, {
      env: { PORT: "5174" },
      desiredPort: 5173,
      allocatedPort: 5174,
    });
    await waitFor(() => mgr.getLogs("p1").some((l) => l.text.includes("PORT=5174")));
    const info = mgr.get("p1");
    expect(info?.allocatedPort).toBe(5174);
    expect(info?.desiredPort).toBe(5173);
  });
});

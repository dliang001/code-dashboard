import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Spawn `node` directly with tsx's JS entry point. Avoids two Windows pitfalls:
//   1. `shell: true` makes child.kill() only kill cmd.exe, leaving orphan tsx/node.
//   2. Spawning `npx.cmd` without a shell throws EINVAL on Node >=20 (CVE-2024-27980).
const TSX_CLI = path.resolve(__dirname, "..", "node_modules", "tsx", "dist", "cli.mjs");

let tmpData: string;

function runCli(args: string[], timeoutMs = 15000): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [TSX_CLI, "src/index.ts", ...args], {
      cwd: path.join(__dirname, ".."),
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += String(d); });
    child.stderr.on("data", (d) => { stderr += String(d); });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("timeout"));
    }, timeoutMs);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

beforeAll(async () => {
  tmpData = await fs.mkdtemp(path.join(os.tmpdir(), "cd-cli-test-"));
});

afterAll(async () => {
  await fs.rm(tmpData, { recursive: true, force: true });
});

describe("CLI", () => {
  it("prints --help text", async () => {
    const r = await runCli(["--help", "--data", tmpData]);
    expect(r.stdout + r.stderr).toMatch(/--root/);
    expect(r.stdout + r.stderr).toMatch(/--port/);
  });

  it("scan-only mode prints project count and exits 0", async () => {
    const fix = path.join(__dirname, "fixtures", "sample-tree");
    const r = await runCli(["--root", fix, "--scan-only", "--data", tmpData]);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/projects? found/i);
  });
}, { timeout: 60000 });

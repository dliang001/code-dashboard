import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";

function runCli(args: string[], timeoutMs = 5000): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", "src/index.ts", ...args], {
      cwd: path.join(__dirname, ".."),
      shell: true,
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += String(d); });
    child.stderr.on("data", (d) => { stderr += String(d); });
    const timer = setTimeout(() => { child.kill(); reject(new Error("timeout")); }, timeoutMs);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

describe("CLI", () => {
  it("prints --help text", async () => {
    const r = await runCli(["--help"]);
    expect(r.stdout + r.stderr).toMatch(/--root/);
    expect(r.stdout + r.stderr).toMatch(/--port/);
  });

  it("scan-only mode prints project count and exits 0", async () => {
    const fix = path.join(__dirname, "fixtures", "sample-tree");
    const r = await runCli(["--root", fix, "--scan-only"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/projects? found/i);
  });
}, { timeout: 30000 });

import { describe, it, expect } from "vitest";
import path from "node:path";
import { detectSignals } from "../src/scanner/signals";

const FIX = path.join(__dirname, "fixtures", "sample-tree");

describe("detectSignals", () => {
  it("identifies a Node.js project from package.json", async () => {
    const sig = await detectSignals(path.join(FIX, "node-app"));
    expect(sig.kind).toBe("node");
    expect(sig.language).toBe("node");
    expect(sig.startCommandDetected).toBe("npm run dev");
    expect(sig.frameworks).toContain("next");
    expect(sig.frameworks).toContain("react");
  });

  it("identifies a Python project from requirements.txt + fastapi", async () => {
    const sig = await detectSignals(path.join(FIX, "python-app"));
    expect(sig.kind).toBe("python");
    expect(sig.language).toBe("python");
    expect(sig.startCommandDetected).toBe("uvicorn app:app --reload");
    expect(sig.frameworks).toContain("fastapi");
  });

  it("identifies a Docker Compose project", async () => {
    const sig = await detectSignals(path.join(FIX, "docker-app"));
    expect(sig.kind).toBe("docker");
    expect(sig.startCommandDetected).toBe("docker-compose up");
  });

  it("identifies a Rust project", async () => {
    const sig = await detectSignals(path.join(FIX, "rust-app"));
    expect(sig.kind).toBe("rust");
    expect(sig.language).toBe("rust");
    expect(sig.startCommandDetected).toBe("cargo run");
  });

  it("returns kind=unknown for empty directory", async () => {
    const tmp = path.join(__dirname, "fixtures", "empty-dir");
    const fs = await import("node:fs/promises");
    await fs.mkdir(tmp, { recursive: true });
    const sig = await detectSignals(tmp);
    expect(sig.kind).toBe("unknown");
    expect(sig.startCommandDetected).toBeNull();
  });

  it("prefers dev > start > serve for npm scripts", async () => {
    const sig = await detectSignals(path.join(FIX, "node-app"));
    expect(sig.startCommandDetected).toBe("npm run dev");
  });
});

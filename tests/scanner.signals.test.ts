import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { detectSignals } from "../src/scanner/signals";

const FIX = path.join(__dirname, "fixtures", "sample-tree");

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `signals-${prefix}-`));
  tempDirs.push(dir);
  return dir;
}

async function writePackageJson(
  dir: string,
  scripts: Record<string, string>,
): Promise<void> {
  await fs.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "tmp", version: "0.0.0", scripts }),
    "utf-8",
  );
}

describe("detectSignals", () => {
  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (!dir) continue;
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        /* best-effort cleanup */
      }
    }
  });

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

  it("finds a Flask entry file when app.py/main.py are absent", async () => {
    const sig = await detectSignals(path.join(FIX, "flask-custom-entry"));
    expect(sig.kind).toBe("python");
    expect(sig.frameworks).toContain("flask");
    expect(sig.startCommandDetected).toBe("python assistant.py");
  });

  it("identifies a Docker Compose project", async () => {
    const sig = await detectSignals(path.join(FIX, "docker-app"));
    expect(sig.kind).toBe("docker");
    expect(sig.startCommandDetected).toBe("docker-compose up");
  });

  it("prefers package scripts when docker-compose only defines backing services", async () => {
    const sig = await detectSignals(path.join(FIX, "node-with-compose"));
    expect(sig.kind).toBe("node");
    expect(sig.startCommandDetected).toBe("npm run dev");
  });

  it("identifies a Rust project", async () => {
    const sig = await detectSignals(path.join(FIX, "rust-app"));
    expect(sig.kind).toBe("rust");
    expect(sig.language).toBe("rust");
    expect(sig.startCommandDetected).toBe("cargo run");
  });

  it("returns kind=unknown for empty directory", async () => {
    const tmp = await makeTempDir("empty");
    const sig = await detectSignals(tmp);
    expect(sig.kind).toBe("unknown");
    expect(sig.startCommandDetected).toBeNull();
  });

  describe("npm script priority (dev > start > serve > first)", () => {
    // Priority scripts are intentionally placed AFTER lower-priority scripts in
    // these fixtures so the tests fail if the implementation simply returns
    // the first key of `scripts` (Object.keys preserves insertion order in JS).

    it("picks `start` when `dev` is absent (start placed after build)", async () => {
      const dir = await makeTempDir("start");
      await writePackageJson(dir, { build: "tsc", start: "node server.js" });
      const sig = await detectSignals(dir);
      expect(sig.startCommandDetected).toBe("npm run start");
    });

    it("picks `serve` when `dev` and `start` are absent (serve placed last)", async () => {
      const dir = await makeTempDir("serve");
      await writePackageJson(dir, { build: "tsc", lint: "eslint .", serve: "vite preview" });
      const sig = await detectSignals(dir);
      expect(sig.startCommandDetected).toBe("npm run serve");
    });

  it("does not treat build/lint scripts as start commands", async () => {
    const dir = await makeTempDir("fallback");
    await writePackageJson(dir, { build: "tsc", lint: "eslint ." });
    const sig = await detectSignals(dir);
    expect(sig.startCommandDetected).toBeNull();
  });

    it("prefers `dev` when all three are present (dev placed last)", async () => {
      const dir = await makeTempDir("all");
      await writePackageJson(dir, {
        serve: "next serve",
        start: "next start",
        dev: "next dev",
      });
      const sig = await detectSignals(dir);
      expect(sig.startCommandDetected).toBe("npm run dev");
    });
  });

  it("does not invent a Python entry command when no entry file exists", async () => {
    const sig = await detectSignals(path.join(FIX, "default-flask"));
    expect(sig.kind).toBe("python");
    expect(sig.frameworks).toContain("flask");
    expect(sig.startCommandDetected).toBeNull();
  });

  it("detects plain Python main.py projects without requirements.txt", async () => {
    const sig = await detectSignals(path.join(FIX, "plain-python-main"));
    expect(sig.kind).toBe("python");
    expect(sig.startCommandDetected).toBe("python main.py");
  });

  it("falls back to README start-all scripts for Python projects without an entry file", async () => {
    const dir = await makeTempDir("readme-start-all");
    await fs.mkdir(path.join(dir, "scripts"));
    await fs.writeFile(path.join(dir, "requirements.txt"), "imageio-ffmpeg\n", "utf-8");
    await fs.writeFile(path.join(dir, "scripts", "start-all.ps1"), "", "utf-8");
    await fs.writeFile(
      path.join(dir, "README.md"),
      [
        "# Industrial 3D Pipeline",
        "",
        "```powershell",
        ".\\scripts\\setup.ps1",
        ".\\scripts\\verify-env.ps1",
        "```",
        "",
        "Run the management UI:",
        "",
        "```powershell",
        ".\\scripts\\start-all.ps1",
        "```",
      ].join("\n"),
      "utf-8",
    );

    const sig = await detectSignals(dir);
    expect(sig.kind).toBe("python");
    expect(sig.startCommandDetected).toBe(
      "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\start-all.ps1",
    );
  });

  it("picks uni h5 development scripts", async () => {
    const sig = await detectSignals(path.join(FIX, "uni-app"));
    expect(sig.kind).toBe("node");
    expect(sig.startCommandDetected).toBe("npm run dev:h5");
  });
});

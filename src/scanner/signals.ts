import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseToml } from "toml";
import type { ProjectKind } from "../types.js";

export interface Signals {
  kind: ProjectKind;
  language: string | null;
  frameworks: string[];
  startCommandDetected: string | null;
}

const NODE_FRAMEWORK_DEPS = [
  "next", "nuxt", "react", "vue", "svelte", "express", "fastify",
  "vite", "remix", "astro", "nest",
];

const PY_FRAMEWORKS = ["fastapi", "django", "flask", "starlette"];

async function tryReadJSON<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function pickNpmScript(scripts: Record<string, string>): string | null {
  const priority = ["dev", "start", "serve"];
  for (const name of priority) {
    if (scripts[name]) return `npm run ${name}`;
  }
  const first = Object.keys(scripts)[0];
  return first ? `npm run ${first}` : null;
}

export async function detectSignals(dir: string): Promise<Signals> {
  // Priority 1: docker-compose
  if (await exists(path.join(dir, "docker-compose.yml")) || await exists(path.join(dir, "docker-compose.yaml"))) {
    return {
      kind: "docker",
      language: "docker",
      frameworks: [],
      startCommandDetected: "docker-compose up",
    };
  }

  // Priority 2: package.json
  const pkg = await tryReadJSON<{ scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(path.join(dir, "package.json"));
  if (pkg) {
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const frameworks = NODE_FRAMEWORK_DEPS.filter((f) => f in allDeps);
    const startCmd = pkg.scripts ? pickNpmScript(pkg.scripts) : null;
    return {
      kind: "node",
      language: "node",
      frameworks,
      startCommandDetected: startCmd,
    };
  }

  // Priority 3: pyproject.toml
  const pyprojectPath = path.join(dir, "pyproject.toml");
  if (await exists(pyprojectPath)) {
    const content = await fs.readFile(pyprojectPath, "utf-8");
    let cmd: string | null = null;
    try {
      const parsed = parseToml(content) as { tool?: { poetry?: { scripts?: Record<string, string> } } };
      const scripts = parsed.tool?.poetry?.scripts;
      if (scripts) {
        const first = Object.keys(scripts)[0];
        if (first) cmd = `poetry run ${first}`;
      }
    } catch { /* ignore parse errors */ }
    return {
      kind: "python",
      language: "python",
      frameworks: [],
      startCommandDetected: cmd ?? "poetry run python -m main",
    };
  }

  // Priority 4: requirements.txt
  if (await exists(path.join(dir, "requirements.txt"))) {
    const reqs = (await fs.readFile(path.join(dir, "requirements.txt"), "utf-8")).toLowerCase();
    const frameworks = PY_FRAMEWORKS.filter((f) => reqs.includes(f));
    let startCmd: string;
    if (await exists(path.join(dir, "manage.py"))) {
      startCmd = "python manage.py runserver";
    } else if (frameworks.includes("fastapi") && (await exists(path.join(dir, "app.py")) || await exists(path.join(dir, "main.py")))) {
      const entry = (await exists(path.join(dir, "app.py"))) ? "app:app" : "main:app";
      startCmd = `uvicorn ${entry} --reload`;
    } else if (await exists(path.join(dir, "main.py"))) {
      startCmd = "python main.py";
    } else if (await exists(path.join(dir, "app.py"))) {
      startCmd = "python app.py";
    } else {
      startCmd = "python -m main";
    }
    return {
      kind: "python",
      language: "python",
      frameworks,
      startCommandDetected: startCmd,
    };
  }

  // Priority 5: Cargo.toml
  if (await exists(path.join(dir, "Cargo.toml"))) {
    return { kind: "rust", language: "rust", frameworks: [], startCommandDetected: "cargo run" };
  }

  // Priority 6: go.mod
  if (await exists(path.join(dir, "go.mod"))) {
    return { kind: "go", language: "go", frameworks: [], startCommandDetected: "go run ." };
  }

  return { kind: "unknown", language: null, frameworks: [], startCommandDetected: null };
}

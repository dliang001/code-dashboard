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

async function findPythonEntry(dir: string, frameworks: string[]): Promise<string | null> {
  for (const file of ["app.py", "main.py"]) {
    if (await exists(path.join(dir, file))) return file;
  }

  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  if (!frameworks.includes("flask")) return null;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".py")) continue;
    let content: string;
    try {
      content = await fs.readFile(path.join(dir, entry.name), "utf-8");
    } catch {
      continue;
    }
    if (content.includes("Flask(") && /\bapp\.run\s*\(/.test(content)) {
      return entry.name;
    }
  }

  return null;
}

function pickNpmScript(scripts: Record<string, string>): string | null {
  const priority = ["dev", "dev:h5", "start", "serve", "preview"];
  for (const name of priority) {
    if (scripts[name]) return `npm run ${name}`;
  }
  for (const [name, cmd] of Object.entries(scripts)) {
    if (/\b(vite|next|nuxt|astro|remix|svelte-kit|webpack-dev-server|uni)\b/.test(cmd)) {
      return `npm run ${name}`;
    }
    if (/\b(node|tsx|ts-node)\b.*\b(server|app|index)\.[cm]?[jt]s\b/.test(cmd)) {
      return `npm run ${name}`;
    }
  }
  return null;
}

export async function detectSignals(dir: string): Promise<Signals> {
  // Priority 1: package.json. Many app repos keep docker-compose only for
  // backing services such as Postgres/Redis, so the app package is the better
  // runnable target when both are present.
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

  // Priority 2: docker-compose-only projects
  if (await exists(path.join(dir, "docker-compose.yml")) || await exists(path.join(dir, "docker-compose.yaml"))) {
    return {
      kind: "docker",
      language: "docker",
      frameworks: [],
      startCommandDetected: "docker-compose up",
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
      startCommandDetected: cmd,
    };
  }

  // Priority 4: requirements.txt
  if (await exists(path.join(dir, "requirements.txt"))) {
    const reqs = (await fs.readFile(path.join(dir, "requirements.txt"), "utf-8")).toLowerCase();
    const frameworks = PY_FRAMEWORKS.filter((f) => reqs.includes(f));
    const entryFile = await findPythonEntry(dir, frameworks);
    let startCmd: string | null;
    if (await exists(path.join(dir, "manage.py"))) {
      startCmd = "python manage.py runserver";
    } else if (frameworks.includes("fastapi") && entryFile != null) {
      const entry = `${entryFile.replace(/\.py$/, "")}:app`;
      startCmd = `uvicorn ${entry} --reload`;
    } else if (entryFile != null) {
      startCmd = `python ${entryFile}`;
    } else {
      startCmd = null;
    }
    return {
      kind: "python",
      language: "python",
      frameworks,
      startCommandDetected: startCmd,
    };
  }

  // Priority 5: plain Python scripts without a requirements file.
  const pyEntry = await findPythonEntry(dir, []);
  if (pyEntry != null) {
    return {
      kind: "python",
      language: "python",
      frameworks: [],
      startCommandDetected: `python ${pyEntry}`,
    };
  }

  // Priority 6: Cargo.toml
  if (await exists(path.join(dir, "Cargo.toml"))) {
    return { kind: "rust", language: "rust", frameworks: [], startCommandDetected: "cargo run" };
  }

  // Priority 7: go.mod
  if (await exists(path.join(dir, "go.mod"))) {
    return { kind: "go", language: "go", frameworks: [], startCommandDetected: "go run ." };
  }

  return { kind: "unknown", language: null, frameworks: [], startCommandDetected: null };
}

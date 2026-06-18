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
const README_FILES = ["README.md", "README.mdx", "readme.md", "readme.mdx"];

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

async function readSafe(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf-8");
  } catch {
    return null;
  }
}

function normalizeReadmeCommand(command: string): string | null {
  let cmd = command.trim();
  cmd = cmd.replace(/^\s*(?:PS\s+)?[A-Z]:\\[^>]+>\s*/i, "");
  cmd = cmd.replace(/^\s*(?:\$|>|PS>)\s*/, "");
  cmd = cmd.replace(/\s+#.*$/, "").trim();
  if (!cmd || cmd.startsWith("#")) return null;

  const ps1 = cmd.match(/^\.?[\\/](.+\.ps1)(?:\s+(.*))?$/i);
  if (ps1) {
    const script = `.\\${ps1[1]!.replace(/\//g, "\\")}`;
    const args = ps1[2]?.trim();
    return `powershell -NoProfile -ExecutionPolicy Bypass -File ${script}${args ? ` ${args}` : ""}`;
  }

  return cmd;
}

/**
 * Reject README commands whose runtime doesn't match the project we detected.
 * Stops a Python project (whose README documents a sibling frontend's
 * `npm run dev`) from adopting a node command it can't actually run, and
 * vice-versa. Non-runtime commands (powershell/docker/.sh) pass for any kind.
 */
function commandMatchesKind(command: string, kind: ProjectKind): boolean {
  const lower = command.toLowerCase();
  const isNodeCmd = /(?:^|\s|&&\s*)(?:npm|pnpm|yarn|bun|npx|node|tsx|ts-node|deno)\b/.test(lower);
  const isPyCmd = /(?:^|\s|&&\s*)(?:python3?|uv|uvicorn|gunicorn|flask|streamlit|poetry|pipenv)\b/.test(lower);
  if (kind === "node") return !isPyCmd;
  if (kind === "python") return !isNodeCmd;
  return true;
}

function scoreReadmeCommand(command: string): number {
  const lower = command.toLowerCase();
  let score = 0;

  if (/(^|\s)(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:dev|start|serve|preview)\b/.test(lower)) score += 60;
  if (/\buvicorn\b|\bflask\s+run\b|\bstreamlit\s+run\b/.test(lower)) score += 60;
  if (/\bpython(?:3)?\s+[\w./\\-]*(?:app|main|server|web|manage)\.py\b/.test(lower)) score += 50;
  if (/\bdocker(?:-compose|\s+compose)\s+up\b/.test(lower)) score += 50;
  if (/[\\/](?:start|run|dev)[\w.-]*\.(?:ps1|sh|bat|cmd)\b/.test(lower)) score += 70;
  if (/\bstart-all\.(?:ps1|sh|bat|cmd)\b/.test(lower)) score += 40;

  if (/\b(?:install|setup|build|test|lint|format|verify|extract|colmap|train|publish)\b/.test(lower)) score -= 40;
  if (/^\s*cd\s+/.test(lower)) score -= 20;
  return score;
}

function collectCodeLines(markdown: string): string[] {
  const lines: string[] = [];
  const fenceRe = /```[\w-]*\r?\n([\s\S]*?)```/g;
  for (const match of markdown.matchAll(fenceRe)) {
    const block = match[1] ?? "";
    const blockLines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (let i = 0; i < blockLines.length; i += 1) {
      const current = normalizeReadmeCommand(blockLines[i]!);
      if (!current) continue;
      const prev = i > 0 ? normalizeReadmeCommand(blockLines[i - 1]!) : null;
      if (prev && /^cd\s+/i.test(prev) && !/^cd\s+/i.test(current)) {
        lines.push(`${prev} && ${current}`);
      }
      lines.push(current);
    }
  }
  return lines;
}

async function detectReadmeStartCommand(dir: string, kind: ProjectKind): Promise<string | null> {
  const candidates: Array<{ command: string; score: number }> = [];

  for (const file of README_FILES) {
    const content = await readSafe(path.join(dir, file));
    if (!content) continue;
    for (const command of collectCodeLines(content)) {
      if (!commandMatchesKind(command, kind)) continue;
      const score = scoreReadmeCommand(command);
      if (score > 0) candidates.push({ command, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.command ?? null;
}

export async function findPythonEntry(dir: string, frameworks: string[]): Promise<string | null> {
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
  const readmeStartCommand = (kind: ProjectKind) => detectReadmeStartCommand(dir, kind);

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
      startCommandDetected: startCmd ?? (await readmeStartCommand("node")),
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
      startCommandDetected: cmd ?? (await readmeStartCommand("python")),
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
      startCommandDetected: startCmd ?? (await readmeStartCommand("python")),
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

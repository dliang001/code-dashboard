import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

async function readSafe(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf-8");
  } catch {
    return null;
  }
}

function fromScripts(scripts: Record<string, string>): number | null {
  for (const cmd of Object.values(scripts)) {
    const m = cmd.match(/--port[\s=](\d{2,5})|(?:^|\s)-p[\s=](\d{2,5})/);
    if (m) {
      const v = parseInt(m[1] ?? m[2] ?? "", 10);
      if (!isNaN(v)) return v;
    }
  }
  return null;
}

function depNames(pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): Set<string> {
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
}

function fromNodeDeps(deps: Set<string>): number | null {
  if (deps.has("vite") || deps.has("@vitejs/plugin-react") || deps.has("@vitejs/plugin-vue")) return 5173;
  if (deps.has("next")) return 3000;
  if (deps.has("nuxt")) return 3000;
  if (deps.has("astro")) return 4321;
  if (deps.has("@sveltejs/kit")) return 5173;
  return null;
}

async function fromNestedPackageScripts(dir: string): Promise<number | null> {
  const candidates = [
    ["apps", "web"],
    ["apps", "frontend"],
    ["packages", "web"],
    ["packages", "frontend"],
    ["web"],
    ["frontend"],
    ["client"],
  ];

  for (const parts of candidates) {
    const raw = await readSafe(path.join(dir, ...parts, "package.json"));
    if (!raw) continue;
    try {
      const pkg = JSON.parse(raw) as {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      if (!pkg.scripts) continue;
      const port = fromScripts(pkg.scripts);
      if (port !== null) return port;
      const fromDeps = fromNodeDeps(depNames(pkg));
      if (fromDeps !== null) return fromDeps;
    } catch {
      // ignore malformed child package files
    }
  }
  return null;
}

function fromViteConfig(content: string): number | null {
  const m = content.match(/port\s*:\s*(\d{2,5})/);
  return m ? parseInt(m[1]!, 10) : null;
}

function fromEnv(content: string): number | null {
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:VITE_|NEXT_PUBLIC_)?PORT\s*=\s*(\d{2,5})\s*$/);
    if (m) return parseInt(m[1]!, 10);
  }
  return null;
}

function fromJsonConfig(content: string): number | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    for (const key of ["port", "assistant_port", "flask_run_port"]) {
      const value = parsed[key];
      if (typeof value === "number" && Number.isInteger(value)) return value;
      if (typeof value === "string" && /^\d{2,5}$/.test(value)) return parseInt(value, 10);
    }
  } catch {
    // ignore malformed config files
  }
  return null;
}

function fromPythonText(content: string): number | null {
  const lower = content.toLowerCase();
  const explicit = lower.match(/(?:port|flask_run_port)\s*=\s*["']?(\d{2,5})/);
  if (explicit) return parseInt(explicit[1]!, 10);
  const configFallback = lower.match(/\.get\(\s*["'](?:assistant_)?port["']\s*,\s*(\d{2,5})\s*\)/);
  if (configFallback) return parseInt(configFallback[1]!, 10);
  if (/\buvicorn\b|\bfastapi\b/.test(lower)) return 8000;
  if (/\bflask\b/.test(lower)) return 5000;
  return null;
}

function fromDockerCompose(content: string): number | null {
  try {
    const parsed = parseYaml(content) as { services?: Record<string, { ports?: (string | number)[] }> };
    if (!parsed.services) return null;
    for (const svc of Object.values(parsed.services)) {
      if (!svc.ports) continue;
      for (const entry of svc.ports) {
        const s = String(entry);
        const m = s.match(/^(\d{2,5}):/);
        if (m) return parseInt(m[1]!, 10);
      }
    }
  } catch { /* ignore */ }
  return null;
}

export async function detectPort(dir: string): Promise<number | null> {
  // 1. package.json scripts
  const pkgRaw = await readSafe(path.join(dir, "package.json"));
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw) as {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      if (pkg.scripts) {
        const fromS = fromScripts(pkg.scripts);
        if (fromS !== null) return fromS;
      }
      const fromDeps = fromNodeDeps(depNames(pkg));
      if (fromDeps !== null) return fromDeps;
    } catch { /* ignore */ }
  }

  // 2. Common monorepo app packages, e.g. root script delegates to apps/web.
  const fromNested = await fromNestedPackageScripts(dir);
  if (fromNested !== null) return fromNested;

  // 3. vite.config.{ts,js,mjs}
  for (const fn of ["vite.config.ts", "vite.config.js", "vite.config.mjs"]) {
    const c = await readSafe(path.join(dir, fn));
    if (c) {
      const v = fromViteConfig(c);
      if (v !== null) return v;
    }
  }

  // 4. .env / JSON config files
  for (const fn of [".env.local", ".env"]) {
    const c = await readSafe(path.join(dir, fn));
    if (c) {
      const v = fromEnv(c);
      if (v !== null) return v;
    }
  }
  for (const fn of ["config.json"]) {
    const c = await readSafe(path.join(dir, fn));
    if (c) {
      const v = fromJsonConfig(c);
      if (v !== null) return v;
    }
  }

  // 5. Python explicit app ports before broad framework defaults.
  for (const fn of ["pyproject.toml", "app.py", "main.py", "assistant.py", "server.py", "web.py", "requirements.txt"]) {
    const c = await readSafe(path.join(dir, fn));
    if (c) {
      const v = fromPythonText(c);
      if (v !== null) return v;
    }
  }

  // 6. docker-compose
  for (const fn of ["docker-compose.yml", "docker-compose.yaml"]) {
    const c = await readSafe(path.join(dir, fn));
    if (c) {
      const v = fromDockerCompose(c);
      if (v !== null) return v;
    }
  }

  return null;
}

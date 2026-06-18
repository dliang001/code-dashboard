import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { findPythonEntry } from "./signals.js";

export interface DetectPortOptions {
  /** Local URLs already harvested from the project's docs (see scanner/urls). */
  detectedUrls?: string[];
  /**
   * The Python entry file the signal detector already resolved (e.g.
   * "auto_leak_monitor.py"). Passing it lets us read that one file directly
   * instead of re-running the expensive all-`.py`-files Flask scan. Pass `null`
   * to skip the entry scan entirely; omit (`undefined`) to let detectPort find
   * the entry itself (used by unit tests on small fixtures).
   */
  pythonEntry?: string | null;
}

/**
 * Pull the Python entry filename out of a resolved start command, e.g.
 * "python src/app.py --port 8000" → "src/app.py". Returns null for non-file
 * commands (uvicorn module targets, npm, etc.).
 */
export function pythonEntryFromCommand(command: string | null): string | null {
  if (!command) return null;
  const m = command.match(/(?:^|\s)python3?\s+(\S+\.py)\b/i);
  return m?.[1] ?? null;
}

const PY_FRAMEWORK_NAMES = ["flask", "fastapi", "django", "starlette"];

async function readSafe(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Extract the first `--port N` or ` -p N` from a single command string.
 * Used by both package.json script scanning and README code-block scanning.
 */
export function portFromCommand(cmd: string): number | null {
  const m = cmd.match(/--port[\s=](\d{2,5})|(?:^|\s)-p[\s=](\d{2,5})/);
  if (!m) return null;
  const v = parseInt(m[1] ?? m[2] ?? "", 10);
  return isNaN(v) ? null : v;
}

function fromScripts(scripts: Record<string, string>): number | null {
  for (const cmd of Object.values(scripts)) {
    const v = portFromCommand(cmd);
    if (v !== null) return v;
  }
  return null;
}

/**
 * Walk README code blocks for the first command that carries an explicit port.
 * Lowest-priority fallback for projects whose actual entry file lives in a
 * subdir (e.g. shouqian/app/server, whose uvicorn target is app.main:app).
 */
function fromReadmeCommands(readme: string): number | null {
  const fenceRe = /```[\w-]*\r?\n([\s\S]*?)```/g;
  for (const match of readme.matchAll(fenceRe)) {
    const block = match[1] ?? "";
    for (const line of block.split(/\r?\n/)) {
      const v = portFromCommand(line);
      if (v !== null) return v;
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
    } catch {
      // ignore malformed child package files
    }
  }
  return null;
}

function fromViteConfig(content: string): number | null {
  const m = content.match(/port\s*:\s*(\d{2,5})/);
  if (m) return parseInt(m[1]!, 10);

  const ref = content.match(/port\s*:\s*([A-Za-z_$][\w$]*)/);
  if (!ref) return null;
  const name = ref[1]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fallback = content.match(new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*[^;]*\\|\\|\\s*(\\d{2,5})`));
  return fallback ? parseInt(fallback[1]!, 10) : null;
}

function fromEnv(content: string): number | null {
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:VITE_|NEXT_PUBLIC_)?PORT\s*=\s*(\d{2,5})\s*$/);
    if (m) return parseInt(m[1]!, 10);
    const url = line.match(/^\s*(?:APP_URL|PUBLIC_URL|BASE_URL|NEXT_PUBLIC_APP_URL)\s*=\s*["']?https?:\/\/(?:localhost|127\.0\.0\.1)(?::(\d{2,5}))?/);
    if (url?.[1]) return parseInt(url[1], 10);
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

function fromPythonText(content: string, allowFrameworkDefaults: boolean): number | null {
  const lower = content.toLowerCase();
  const explicit = lower.match(/(?:port|flask_run_port)\s*=\s*["']?(\d{2,5})/);
  if (explicit) return parseInt(explicit[1]!, 10);
  const configFallback = lower.match(/\.get\(\s*["'](?:assistant_)?port["']\s*,\s*(\d{2,5})\s*\)/);
  if (configFallback) return parseInt(configFallback[1]!, 10);
  if (!allowFrameworkDefaults) return null;
  if (/\buvicorn\b|\bfastapi\b/.test(lower)) return 8000;
  if (/\bflask\b/.test(lower) && /\bapp\.run\s*\(/.test(lower)) return 5000;
  return null;
}

function fromDockerCompose(content: string): number | null {
  try {
    const parsed = parseYaml(content) as { services?: Record<string, { ports?: (string | number)[] }> };
    if (!parsed.services) return null;
    const candidates: Array<{ port: number; score: number }> = [];
    for (const [name, svc] of Object.entries(parsed.services)) {
      if (!svc.ports) continue;
      for (const entry of svc.ports) {
        const s = String(entry);
        const m = s.match(/^(\d{2,5}):/);
        if (!m) continue;
        const port = parseInt(m[1]!, 10);
        const lowerName = name.toLowerCase();
        let score = 0;
        if (/\b(web|frontend|front|app|api|server|dashboard)\b/.test(lowerName)) score += 100;
        if ([80, 443, 3000, 3001, 5000, 5173, 8000, 8080, 9000].includes(port)) score += 20;
        if ([5432, 3306, 6379, 27017, 9200, 9300].includes(port)) score -= 50;
        candidates.push({ port, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.port ?? null;
  } catch { /* ignore */ }
  return null;
}

/**
 * Scan the project's *actual* detected Python entry file for an explicit port.
 * The fixed filename allow-list in step 5 misses custom-named entries
 * (e.g. auto_leak_monitor.py), so we ask the signal detector which file it
 * would launch and read that one too.
 */
async function fromPythonEntryFile(dir: string, entryHint: string | null | undefined): Promise<number | null> {
  let entry = entryHint;
  if (entry === undefined) {
    // No hint (unit-test path): resolve the entry ourselves. The expensive
    // all-`.py` Flask scan only runs here, never during a full workspace walk.
    const req = await readSafe(path.join(dir, "requirements.txt"));
    const frameworks = req
      ? PY_FRAMEWORK_NAMES.filter((f) => req.toLowerCase().includes(f))
      : [];
    entry = await findPythonEntry(dir, frameworks);
  }
  if (!entry) return null;
  const content = await readSafe(path.join(dir, entry));
  if (!content) return null;
  return fromPythonText(content, /* allowFrameworkDefaults */ true);
}

/**
 * Pick the most-referenced localhost port from already-harvested doc URLs.
 * Evidence-based last resort: when nothing else carries a port but the README
 * links to http://localhost:8787, that's almost certainly the dev port.
 */
export function portFromUrls(urls: string[] | undefined): number | null {
  if (!urls || urls.length === 0) return null;
  const counts = new Map<number, number>();
  for (const url of urls) {
    const m = url.match(/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::(\d{2,5}))?/i);
    if (!m?.[1]) continue;
    const port = parseInt(m[1], 10);
    counts.set(port, (counts.get(port) ?? 0) + 1);
  }
  // Most-referenced port wins; ties keep the first-seen URL (READMEs usually
  // document the project's own UI before any sibling/service link).
  let best: number | null = null;
  let bestCount = 0;
  for (const [port, count] of counts) {
    if (count > bestCount) {
      best = port;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Lowest-priority framework default. Used only when a project carries no
 * explicit port anywhere — a bare Vite app genuinely binds 5173, so surfacing
 * it beats a blank port column. The runtime scheduler still re-checks/​moves
 * the port at launch, so a wrong guess here is self-correcting.
 */
async function fromFrameworkDefault(dir: string): Promise<number | null> {
  const pkgRaw = await readSafe(path.join(dir, "package.json"));
  if (pkgRaw) {
    try {
      const deps = depNames(JSON.parse(pkgRaw) as Parameters<typeof depNames>[0]);
      if (deps.has("vite")) return 5173;
      if (deps.has("next") || deps.has("nuxt") || deps.has("react-scripts")) return 3000;
      if (deps.has("@remix-run/dev") || deps.has("remix")) return 3000;
    } catch { /* ignore malformed package.json */ }
  }
  const req = (await readSafe(path.join(dir, "requirements.txt")))?.toLowerCase() ?? "";
  const pyproject = (await readSafe(path.join(dir, "pyproject.toml")))?.toLowerCase() ?? "";
  const blob = `${req}\n${pyproject}`;
  if (/\bfastapi\b|\buvicorn\b|\bstarlette\b|\bdjango\b/.test(blob)) return 8000;
  if (/\bflask\b/.test(blob)) return 5000;
  return null;
}

export async function detectPort(dir: string, opts: DetectPortOptions = {}): Promise<number | null> {
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
    } catch { /* ignore */ }
  }

  // 2. vite.config.{ts,js,mjs} with explicit server.port.
  for (const fn of ["vite.config.ts", "vite.config.js", "vite.config.mjs"]) {
    const c = await readSafe(path.join(dir, fn));
    if (c) {
      const v = fromViteConfig(c);
      if (v !== null) return v;
    }
  }

  // 3. .env / JSON config files
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

  // 4. Common monorepo app packages, e.g. root script delegates to apps/web.
  const fromNested = await fromNestedPackageScripts(dir);
  if (fromNested !== null) return fromNested;

  // 5. Python explicit app ports before broad framework defaults.
  for (const fn of ["pyproject.toml", "app.py", "main.py", "assistant.py", "server.py", "web.py", "requirements.txt"]) {
    const c = await readSafe(path.join(dir, fn));
    if (c) {
      const allowDefaults = fn !== "requirements.txt" && fn !== "pyproject.toml";
      const v = fromPythonText(c, allowDefaults);
      if (v !== null) return v;
    }
  }

  // 5b. The project's real Python entry file, even when its name isn't in the
  // allow-list above (e.g. auto_leak_monitor.py, simple_recharge_system.py).
  const fromEntry = await fromPythonEntryFile(dir, opts.pythonEntry);
  if (fromEntry !== null) return fromEntry;

  // 6. docker-compose
  for (const fn of ["docker-compose.yml", "docker-compose.yaml"]) {
    const c = await readSafe(path.join(dir, fn));
    if (c) {
      const v = fromDockerCompose(c);
      if (v !== null) return v;
    }
  }

  // 7. README code-block commands — last resort for projects whose entry is
  // nested under a subdir and whose only --port hint is the documented
  // invocation (e.g. `uvicorn app.main:app --port 8000`).
  for (const fn of ["README.md", "README.mdx", "readme.md", "readme.mdx"]) {
    const c = await readSafe(path.join(dir, fn));
    if (c) {
      const v = fromReadmeCommands(c);
      if (v !== null) return v;
    }
  }

  // 8. Evidence-based fallback: a localhost port already harvested from docs
  // (README links etc.). Catches Flask/Express apps whose only port hint is a
  // documented http://localhost:<port> URL.
  const fromDocUrls = portFromUrls(opts.detectedUrls);
  if (fromDocUrls !== null) return fromDocUrls;

  // 9. Framework default (lowest priority) so a bare web project still shows a
  // port instead of a blank cell. Self-correcting: the launch scheduler
  // re-checks and reassigns the port at start time.
  const fromDefault = await fromFrameworkDefault(dir);
  if (fromDefault !== null) return fromDefault;

  return null;
}

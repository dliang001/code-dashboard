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
      const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };
      if (pkg.scripts) {
        const fromS = fromScripts(pkg.scripts);
        if (fromS !== null) return fromS;
      }
    } catch { /* ignore */ }
  }

  // 2. vite.config.{ts,js,mjs}
  for (const fn of ["vite.config.ts", "vite.config.js", "vite.config.mjs"]) {
    const c = await readSafe(path.join(dir, fn));
    if (c) {
      const v = fromViteConfig(c);
      if (v !== null) return v;
    }
  }

  // 3. .env files
  for (const fn of [".env.local", ".env"]) {
    const c = await readSafe(path.join(dir, fn));
    if (c) {
      const v = fromEnv(c);
      if (v !== null) return v;
    }
  }

  // 4. docker-compose
  for (const fn of ["docker-compose.yml", "docker-compose.yaml"]) {
    const c = await readSafe(path.join(dir, fn));
    if (c) {
      const v = fromDockerCompose(c);
      if (v !== null) return v;
    }
  }

  return null;
}

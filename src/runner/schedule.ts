/**
 * Port-injection planning for the runner.
 *
 * When the scheduler decides a project must run on a different port than the
 * one baked into its command/config, it has to hand that port to the dev
 * server in the way that *specific* tool understands. There is no single
 * mechanism that works everywhere:
 *
 *   - Vite ignores `process.env.PORT` entirely — it only honours `--port` (or
 *     `server.port`). Injecting PORT silently does nothing and the server
 *     collides anyway.
 *   - A command with an explicit `--port 8718` / `-p 3000` overrides any env,
 *     so we must rewrite the flag rather than set PORT.
 *   - Next.js, CRA, most Express/Nest apps and uvicorn-via-env DO read PORT.
 *
 * applyPortToCommand picks the right strategy and returns the (possibly
 * rewritten) command plus the env overrides to spawn with.
 */
export interface PortInjection {
  command: string;
  env: Record<string, string>;
}

const EXPLICIT_PORT_RE = /(--port[ =]|(?:^|\s)-p[ =])(\d{2,5})/;
const NODE_PM_RE = /^(npm|pnpm|yarn|bun)\b/;

export function applyPortToCommand(
  command: string,
  frameworks: string[],
  port: number,
): PortInjection {
  // 1. The command already pins a port → rewrite it. Authoritative over env.
  if (EXPLICIT_PORT_RE.test(command)) {
    return { command: command.replace(EXPLICIT_PORT_RE, `$1${port}`), env: {} };
  }

  // 2. Vite: must receive --port on argv. Through a package manager the flag
  //    has to cross the `--` boundary (npm/pnpm) or is passed straight (yarn/bun).
  const isVite = frameworks.includes("vite") || /\bvite\b/.test(command);
  if (isVite) {
    const trimmed = command.trim();
    const pm = trimmed.match(NODE_PM_RE)?.[1];
    if (pm === "npm" || pm === "pnpm") {
      return { command: `${command} -- --port ${port}`, env: {} };
    }
    if (pm === "yarn" || pm === "bun") {
      return { command: `${command} --port ${port}`, env: {} };
    }
    return { command: `${command} --port ${port}`, env: {} };
  }

  // 3. Everything else: PORT env (Next.js, CRA, Express, Nest, uvicorn-via-env).
  return { command, env: { PORT: String(port) } };
}

/**
 * Choose the port to launch a project on.
 *
 * Prefers a previously-remembered allocation (so a project bumped to :5174
 * stays on :5174 across restarts — stable URLs), falling back to the desired
 * port, then walking upward to the first free port. `isFree` must fold in
 * everything that makes a port unusable (OS-occupied, OS-reserved, AND ports
 * already claimed by other projects this session). Returns null if nothing in
 * range is free.
 */
export async function chooseLaunchPort(
  desiredPort: number,
  remembered: number | undefined,
  isFree: (port: number) => Promise<boolean>,
  maxScan = 500,
): Promise<number | null> {
  const preferred = remembered ?? desiredPort;
  if (await isFree(preferred)) return preferred;
  for (let port = preferred + 1, i = 0; port <= 65535 && i < maxScan; port++, i++) {
    if (await isFree(port)) return port;
  }
  return null;
}

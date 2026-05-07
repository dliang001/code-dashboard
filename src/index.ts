#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildServer, performScanAndPersist } from "./api/server.js";
import { scan } from "./scanner/index.js";
import { enrichAll } from "./metadata/index.js";
import { loadProjects } from "./store/projects.js";
import { getDashboardPaths } from "./config.js";
import { ProbeCache, probeAll } from "./probe/port.js";
import { ProcessManager } from "./runner/process.js";

interface CliArgs {
  root?: string;
  port: number;
  "scan-only": boolean;
  data?: string;
}

async function loadOrPromptScanRoot(configFile: string, fromCli?: string): Promise<string> {
  if (fromCli) return path.resolve(fromCli);
  try {
    const cfg = JSON.parse(await fs.readFile(configFile, "utf-8")) as { scanRoot?: string };
    if (cfg.scanRoot) return cfg.scanRoot;
  } catch { /* fall through */ }
  // Default: cwd. v1 has no interactive prompt; v4 will add one.
  return process.cwd();
}

async function saveScanRoot(configFile: string, scanRoot: string): Promise<void> {
  await fs.mkdir(path.dirname(configFile), { recursive: true });
  await fs.writeFile(configFile, JSON.stringify({ scanRoot }, null, 2), "utf-8");
}

async function main() {
  const argv = (await yargs(hideBin(process.argv))
    .option("root", { type: "string", description: "Workspace root to scan" })
    .option("port", { type: "number", default: 7420, description: "HTTP port" })
    .option("scan-only", { type: "boolean", default: false, description: "Run a scan and exit (no server)" })
    .option("data", { type: "string", description: "Override data dir (default ~/.code-dashboard)" })
    .help().argv) as CliArgs;

  const paths = getDashboardPaths(argv.data);
  const scanRoot = await loadOrPromptScanRoot(paths.configFile, argv.root);
  await saveScanRoot(paths.configFile, scanRoot);

  if (argv["scan-only"]) {
    const result = await scan(scanRoot);
    const enriched = await enrichAll(result.projects);
    console.log(`${enriched.length} projects found in ${scanRoot}`);
    if (result.conflicts.length > 0) {
      console.log(`Port conflicts: ${result.conflicts.length}`);
    }
    return;
  }

  const probeCache = new ProbeCache();
  const processManager = new ProcessManager();
  // Resolve to <project-root>/web/dist relative to dist/index.js (or src/index.ts in dev)
  const here = fileURLToPath(new URL(".", import.meta.url));
  const webDist = path.resolve(here, "..", "web", "dist");
  const webDistExists = await fs.access(webDist).then(() => true).catch(() => false);

  const server = await buildServer({
    scanRoot,
    dataRoot: paths.root,
    logger: true,
    webDist: webDistExists ? webDist : undefined,
    probeCache,
    processManager,
  });

  // Tear down all managed children on dashboard exit so the user doesn't
  // end up with orphaned `npm run dev` processes after Ctrl+C.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\nReceived ${signal}, stopping managed processes...`);
    try {
      await processManager.shutdown();
    } catch (err) {
      console.error("shutdown error:", err);
    }
    try {
      await server.close();
    } catch { /* ignore */ }
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // Auto-scan on first run so GET /api/projects has data immediately.
  const existing = await loadProjects(paths.projectsFile);
  if (!existing) {
    console.log("First run — scanning workspace...");
    const result = await performScanAndPersist({ scanRoot, projectsFile: paths.projectsFile });
    console.log(`Initial scan complete: ${result.projects.length} projects, ${result.conflicts.length} conflicts`);
  }

  await server.listen({ port: argv.port, host: "127.0.0.1" });
  console.log(`Dashboard backend listening on http://localhost:${argv.port}`);
  if (webDistExists) {
    console.log(`Frontend served from ${webDist}`);
    console.log(`Open in browser: http://localhost:${argv.port}/`);
  } else {
    console.log("Frontend not built (run `npm run build:web`); only API is available.");
  }
  console.log(`Scan root: ${scanRoot}`);
  console.log(`Data root: ${paths.root}`);

  // Run an initial probe sweep, then schedule recurring sweeps every 30s.
  const stored = await loadProjects(paths.projectsFile);
  const projectsForProbe = stored?.projects ?? [];
  if (projectsForProbe.length > 0) {
    void probeAll(projectsForProbe, probeCache, processManager).catch(() => {});
    setInterval(() => {
      void probeAll(projectsForProbe, probeCache, processManager).catch(() => {});
    }, 30_000);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

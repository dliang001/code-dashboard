import fs from "node:fs/promises";
import path from "node:path";
import { isIgnored } from "./ignored.js";
import { detectSignals } from "./signals.js";
import { detectPort, pythonEntryFromCommand } from "./ports.js";
import { detectUrls } from "./urls.js";
import type { Project, ProjectKind } from "../types.js";

interface WalkOptions {
  extraIgnored?: string[];
}

// scanRoot itself is depth 0 (never registered). Projects are emitted from
// depth 1 through MAX_DEPTH. Depth 3 covers the common nested-monorepo shape
// where a workspace top-level holds an `app/` (or `apps/`) container whose
// children are the actual runnable services (e.g. shouqian/app/{web,server}).
const MAX_DEPTH = 3;

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

function toId(scanRoot: string, abs: string): string {
  const rel = path.relative(scanRoot, abs);
  return rel.split(path.sep).join("/");
}

async function buildBareProject(scanRoot: string, abs: string): Promise<Project | null> {
  const sig = await detectSignals(abs);
  // Bail before the costly URL/port probes: an unknown dir is discarded here
  // anyway (it may still become a parent-container, which carries no port/urls).
  if (sig.kind === "unknown") return null;
  const detectedUrls = await detectUrls(abs);
  // Reuse the entry the signal detector already resolved so detectPort doesn't
  // re-run the expensive all-`.py` Flask scan on big directories.
  const pythonEntry = sig.kind === "python"
    ? pythonEntryFromCommand(sig.startCommandDetected)
    : null;
  const port = await detectPort(abs, { detectedUrls, pythonEntry });
  const id = toId(scanRoot, abs);
  return {
    id,
    path: id,
    absPath: abs,
    kind: sig.kind,
    name: path.basename(abs),
    description: null,
    descriptionAuto: null,
    language: sig.language,
    frameworks: sig.frameworks,
    tags: [],
    startCommand: null,
    startCommandDetected: sig.startCommandDetected,
    port: null,
    portDetected: port,
    detectedUrls,
    archived: false,
    children: [],
    parent: null,
    lastEditedByUser: null,
    gitBranch: null,
    lastModified: null,
  };
}

function bareContainer(scanRoot: string, abs: string): Project {
  const id = toId(scanRoot, abs);
  return {
    id,
    path: id,
    absPath: abs,
    kind: "parent-container",
    name: path.basename(abs),
    description: null,
    descriptionAuto: null,
    language: null,
    frameworks: [],
    tags: [],
    startCommand: null,
    startCommandDetected: null,
    port: null,
    portDetected: null,
    detectedUrls: [],
    archived: false,
    children: [],
    parent: null,
    lastEditedByUser: null,
    gitBranch: null,
    lastModified: null,
  };
}

/**
 * Recursively walk `dir` and emit projects into `out`. Returns the id this dir
 * was registered under (project or container), or null if neither.
 *
 * - Depth 0 is the scanRoot itself: never registered, but its children are scanned.
 * - A dir with its own signals AND descendant projects becomes self-runnable-parent.
 * - A dir without signals but with descendant projects becomes parent-container.
 * - Recursion stops at MAX_DEPTH.
 */
async function walk(
  scanRoot: string,
  dir: string,
  depth: number,
  parentId: string | null,
  opts: WalkOptions,
  out: Project[],
): Promise<string | null> {
  const own = depth === 0 ? null : await buildBareProject(scanRoot, dir);
  const myId = depth === 0 ? null : toId(scanRoot, dir);

  const childIds: string[] = [];
  if (depth < MAX_DEPTH) {
    const subNames = await listDirs(dir);
    for (const sn of subNames) {
      if (isIgnored(sn, opts.extraIgnored)) continue;
      const subAbs = path.join(dir, sn);
      const cid = await walk(scanRoot, subAbs, depth + 1, myId, opts, out);
      if (cid) childIds.push(cid);
    }
  }

  if (depth === 0) return null;

  if (own) {
    out.push({
      ...own,
      kind: childIds.length > 0 ? ("self-runnable-parent" as ProjectKind) : own.kind,
      children: childIds,
      parent: parentId,
    });
    return own.id;
  }
  if (childIds.length > 0) {
    const container = bareContainer(scanRoot, dir);
    out.push({ ...container, children: childIds, parent: parentId });
    return container.id;
  }
  return null;
}

export async function walkProjects(scanRoot: string, opts: WalkOptions = {}): Promise<Project[]> {
  const out: Project[] = [];
  await walk(scanRoot, scanRoot, 0, null, opts, out);
  return out;
}

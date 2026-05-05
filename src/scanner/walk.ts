import fs from "node:fs/promises";
import path from "node:path";
import { isIgnored } from "./ignored.js";
import { detectSignals } from "./signals.js";
import { detectPort } from "./ports.js";
import type { Project, ProjectKind } from "../types.js";

const MAX_DEPTH = 2;

interface WalkOptions {
  extraIgnored?: string[];
}

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
  const port = await detectPort(abs);
  const id = toId(scanRoot, abs);
  if (sig.kind === "unknown") return null;
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
    archived: false,
    children: [],
    parent: null,
    lastEditedByUser: null,
    gitBranch: null,
    lastModified: null,
  };
}

export async function walkProjects(scanRoot: string, opts: WalkOptions = {}): Promise<Project[]> {
  const out: Project[] = [];
  const topNames = await listDirs(scanRoot);

  for (const topName of topNames) {
    if (isIgnored(topName, opts.extraIgnored)) continue;
    const topAbs = path.join(scanRoot, topName);
    const topProject = await buildBareProject(scanRoot, topAbs);

    // Find children regardless of whether parent itself is a project
    const childNames = await listDirs(topAbs);
    const childProjects: Project[] = [];
    for (const cn of childNames) {
      if (isIgnored(cn, opts.extraIgnored)) continue;
      const childAbs = path.join(topAbs, cn);
      const cp = await buildBareProject(scanRoot, childAbs);
      if (cp) childProjects.push(cp);
    }

    if (topProject) {
      const parent: Project = {
        ...topProject,
        kind: childProjects.length > 0 ? ("self-runnable-parent" as ProjectKind) : topProject.kind,
        children: childProjects.map((c) => c.id),
      };
      out.push(parent);
      for (const cp of childProjects) {
        out.push({ ...cp, parent: parent.id });
      }
    } else if (childProjects.length > 0) {
      // parent has no signals → pure container
      const containerId = toId(scanRoot, topAbs);
      out.push({
        id: containerId,
        path: containerId,
        absPath: topAbs,
        kind: "parent-container",
        name: topName,
        description: null,
        descriptionAuto: null,
        language: null,
        frameworks: [],
        tags: [],
        startCommand: null,
        startCommandDetected: null,
        port: null,
        portDetected: null,
        archived: false,
        children: childProjects.map((c) => c.id),
        parent: null,
        lastEditedByUser: null,
        gitBranch: null,
        lastModified: null,
      });
      for (const cp of childProjects) {
        out.push({ ...cp, parent: containerId });
      }
    }
    // else: no project, no children → skip entirely
    void MAX_DEPTH; // depth fixed at 2 (top + immediate children)
  }

  return out;
}

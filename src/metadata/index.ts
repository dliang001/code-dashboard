import fs from "node:fs/promises";
import { extractReadmeFirstParagraph } from "./readme.js";
import { getGitInfo } from "./git.js";
import type { Project } from "../types.js";

async function getDirMtime(dir: string): Promise<string | null> {
  try {
    const stat = await fs.stat(dir);
    return stat.mtime.toISOString();
  } catch {
    return null;
  }
}

export async function enrichWithMetadata(project: Project): Promise<Project> {
  const [descAuto, git, mtime] = await Promise.all([
    extractReadmeFirstParagraph(project.absPath),
    getGitInfo(project.absPath),
    getDirMtime(project.absPath),
  ]);
  return {
    ...project,
    descriptionAuto: descAuto,
    gitBranch: git.branch,
    lastModified: git.lastCommitISO ?? mtime,
  };
}

export async function enrichAll(projects: Project[], concurrency = 8): Promise<Project[]> {
  const out: Project[] = new Array(projects.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= projects.length) return;
      out[i] = await enrichWithMetadata(projects[i]!);
    }
  }
  const n = Math.min(concurrency, projects.length);
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

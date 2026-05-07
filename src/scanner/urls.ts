import fs from "node:fs/promises";
import path from "node:path";

const LOCAL_URL_RE = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{2,5})?(?:\/[^\s"'<>`)]+)?/gi;
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "data",
  "dist",
  "node_modules",
]);
const URL_FILE_NAMES = new Set(["README.md", "README.mdx", "readme.md", "readme.mdx"]);
const MAX_DEPTH = 3;
const MAX_FILES = 40;

async function readSafe(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf-8");
  } catch {
    return null;
  }
}

function trimUrl(url: string): string {
  return url.replace(/[`.,;!?]+$/g, "");
}

async function collectUrlFiles(dir: string, depth = 0, out: string[] = []): Promise<string[]> {
  if (depth > MAX_DEPTH || out.length >= MAX_FILES) return out;

  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (out.length >= MAX_FILES) break;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await collectUrlFiles(abs, depth + 1, out);
      continue;
    }
    if (entry.isFile() && URL_FILE_NAMES.has(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

export async function detectUrls(dir: string): Promise<string[]> {
  const files = await collectUrlFiles(dir);
  const urls = new Set<string>();

  for (const file of files) {
    const content = await readSafe(file);
    if (!content) continue;
    for (const match of content.matchAll(LOCAL_URL_RE)) {
      urls.add(trimUrl(match[0]));
    }
  }

  return [...urls];
}

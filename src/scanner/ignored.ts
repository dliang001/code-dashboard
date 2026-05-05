export const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "node_modules",
  "dist",
  "build",
  "out",
  "target",
  "__pycache__",
  ".pytest_cache",
  ".venv",
  "venv",
  ".cache",
  "coverage",
  ".turbo",
  ".parcel-cache",
  "deploy-temp",
]);

export function isIgnored(dirName: string, extraIgnored: string[] = []): boolean {
  if (DEFAULT_IGNORED_DIRS.has(dirName)) return true;
  if (extraIgnored.includes(dirName)) return true;
  if (dirName.startsWith("_")) return true;
  return false;
}

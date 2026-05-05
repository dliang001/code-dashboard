import os from "node:os";
import path from "node:path";

export interface DashboardPaths {
  root: string;
  configFile: string;
  projectsFile: string;
  runtimeFile: string;
  logsDir: string;
}

export function getDashboardPaths(override?: string): DashboardPaths {
  const root = override ?? path.join(os.homedir(), ".code-dashboard");
  return {
    root,
    configFile: path.join(root, "config.json"),
    projectsFile: path.join(root, "projects.json"),
    runtimeFile: path.join(root, "runtime.json"),
    logsDir: path.join(root, "logs"),
  };
}

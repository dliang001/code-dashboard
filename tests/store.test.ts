import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadProjects, saveProjects, mergeWithScan } from "../src/store/projects";
import type { Project, ScanResult } from "../src/types";

let tmpRoot: string;

function makeProject(over: Partial<Project> = {}): Project {
  return {
    id: "demo", path: "demo", absPath: "/x/demo",
    kind: "node", name: "demo",
    description: null, descriptionAuto: null,
    language: "node", frameworks: [], tags: [],
    startCommand: null, startCommandDetected: null,
    port: null, portDetected: null,
    archived: false, children: [], parent: null,
    lastEditedByUser: null, gitBranch: null, lastModified: null,
    ...over,
  };
}

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "dash-test-"));
});

describe("save + load projects.json", () => {
  it("round-trips a single project", async () => {
    const file = path.join(tmpRoot, "projects.json");
    const original: ScanResult = {
      scanRoot: "/test",
      scannedAt: "2026-05-05T00:00:00Z",
      projects: [makeProject({ description: "user-edited" })],
      conflicts: [],
    };
    await saveProjects(file, original);
    const loaded = await loadProjects(file);
    expect(loaded?.projects[0]?.description).toBe("user-edited");
  });

  it("returns null when file does not exist", async () => {
    const file = path.join(tmpRoot, "nope.json");
    const loaded = await loadProjects(file);
    expect(loaded).toBeNull();
  });
});

describe("mergeWithScan", () => {
  it("preserves user-edited description across re-scans", () => {
    const stored = makeProject({
      description: "I wrote this myself",
      descriptionAuto: "old auto",
    });
    const fresh = makeProject({
      description: null,
      descriptionAuto: "new auto from README",
    });
    const merged = mergeWithScan([stored], [fresh]);
    expect(merged[0]?.description).toBe("I wrote this myself");
    expect(merged[0]?.descriptionAuto).toBe("new auto from README");
  });

  it("preserves user tags, custom port, custom startCommand, archived flag", () => {
    const stored = makeProject({
      tags: ["活跃", "实验"],
      port: 8888,
      startCommand: "custom-cmd",
      archived: true,
    });
    const fresh = makeProject({
      tags: [],
      port: null,
      portDetected: 3000,
      startCommand: null,
      startCommandDetected: "npm run dev",
      archived: false,
    });
    const merged = mergeWithScan([stored], [fresh]);
    expect(merged[0]?.tags).toEqual(["活跃", "实验"]);
    expect(merged[0]?.port).toBe(8888);
    expect(merged[0]?.startCommand).toBe("custom-cmd");
    expect(merged[0]?.archived).toBe(true);
    expect(merged[0]?.portDetected).toBe(3000);          // auto field updated
    expect(merged[0]?.startCommandDetected).toBe("npm run dev");
  });

  it("adds newly discovered projects", () => {
    const stored: Project[] = [];
    const fresh = [makeProject({ id: "new-one" })];
    const merged = mergeWithScan(stored, fresh);
    expect(merged.map((p) => p.id)).toEqual(["new-one"]);
  });

  it("drops projects that no longer exist on disk", () => {
    const stored = [makeProject({ id: "deleted" }), makeProject({ id: "kept" })];
    const fresh = [makeProject({ id: "kept" })];
    const merged = mergeWithScan(stored, fresh);
    expect(merged.map((p) => p.id)).toEqual(["kept"]);
  });
});

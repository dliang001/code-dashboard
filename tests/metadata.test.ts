import { describe, it, expect } from "vitest";
import path from "node:path";
import { extractReadmeFirstParagraph } from "../src/metadata/readme";
import { enrichWithMetadata } from "../src/metadata";
import type { Project } from "../src/types";

const FIX = path.join(__dirname, "fixtures", "sample-tree");

function bareProject(id: string, abs: string): Project {
  return {
    id, path: id, absPath: abs, kind: "node", name: id,
    description: null, descriptionAuto: null, language: "node",
    frameworks: [], tags: [], startCommand: null, startCommandDetected: null,
    port: null, portDetected: null, archived: false, children: [], parent: null,
    lastEditedByUser: null, gitBranch: null, lastModified: null,
  };
}

describe("extractReadmeFirstParagraph", () => {
  it("returns the first paragraph after stripping H1", async () => {
    const p = await extractReadmeFirstParagraph(path.join(FIX, "node-app"));
    expect(p).toContain("sample Node.js application");
    expect(p).not.toContain("# Node App");
    expect(p).not.toContain("Installation");
  });

  it("returns null when no README exists", async () => {
    const p = await extractReadmeFirstParagraph(path.join(FIX, "rust-app"));
    expect(p).toBeNull();
  });
});

describe("enrichWithMetadata", () => {
  it("populates descriptionAuto from README", async () => {
    const proj = bareProject("node-app", path.join(FIX, "node-app"));
    const enriched = await enrichWithMetadata(proj);
    expect(enriched.descriptionAuto).toContain("sample Node.js application");
  });

  it("populates lastModified (git commit or dir mtime fallback)", async () => {
    const proj = bareProject("node-app", path.join(FIX, "node-app"));
    const enriched = await enrichWithMetadata(proj);
    expect(enriched.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("gitBranch is null when not a git repo", async () => {
    const proj = bareProject("rust-app", path.join(FIX, "rust-app"));
    const enriched = await enrichWithMetadata(proj);
    expect(enriched.gitBranch).toBeNull();
  });
});

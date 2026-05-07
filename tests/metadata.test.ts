import { describe, it, expect } from "vitest";
import path from "node:path";
import { extractReadmeFirstParagraph, parseFirstParagraph } from "../src/metadata/readme";
import { enrichWithMetadata } from "../src/metadata";
import type { Project } from "../src/types";

const FIX = path.join(__dirname, "fixtures", "sample-tree");

function bareProject(id: string, abs: string): Project {
  return {
    id, path: id, absPath: abs, kind: "node", name: id,
    description: null, descriptionAuto: null, language: "node",
    frameworks: [], tags: [], startCommand: null, startCommandDetected: null,
    port: null, portDetected: null, detectedUrls: [], archived: false, children: [], parent: null,
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

describe("parseFirstParagraph edge cases", () => {
  it("handles CRLF line endings", () => {
    const md = "# Title\r\n\r\nFirst paragraph here.\r\n\r\n## Next";
    expect(parseFirstParagraph(md)).toBe("First paragraph here.");
  });

  it("returns null for empty input", () => {
    expect(parseFirstParagraph("")).toBeNull();
  });

  it("returns null for headings-only README", () => {
    expect(parseFirstParagraph("# Title\n\n## Section\n\n### Subsection")).toBeNull();
  });

  it("skips badges before the paragraph", () => {
    const md = "# Title\n\n![badge](url)\n[![ci](u1)](u2)\n\nReal description here.";
    expect(parseFirstParagraph(md)).toBe("Real description here.");
  });

  it("collapses multi-line wrapped paragraphs into one space-separated string", () => {
    const md = "# T\n\nLine one of\nthe paragraph\nspanning three lines.\n\n## Next";
    expect(parseFirstParagraph(md)).toBe("Line one of the paragraph spanning three lines.");
  });

  it("collapses internal whitespace to single spaces", () => {
    const md = "# T\n\nMultiple    spaces   between  words.";
    expect(parseFirstParagraph(md)).toBe("Multiple spaces between words.");
  });
});

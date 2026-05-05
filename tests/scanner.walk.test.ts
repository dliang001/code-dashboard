import { describe, it, expect } from "vitest";
import path from "node:path";
import { walkProjects } from "../src/scanner/walk";

const FIX = path.join(__dirname, "fixtures", "sample-tree");

describe("walkProjects", () => {
  it("finds top-level projects", async () => {
    const found = await walkProjects(FIX);
    const ids = found.map((p) => p.id).sort();
    expect(ids).toContain("node-app");
    expect(ids).toContain("python-app");
    expect(ids).toContain("docker-app");
    expect(ids).toContain("rust-app");
  });

  it("finds nested children up to depth 2", async () => {
    const found = await walkProjects(FIX);
    const ids = found.map((p) => p.id);
    expect(ids).toContain("monorepo-parent");
    expect(ids).toContain("monorepo-parent/child-a");
    expect(ids).toContain("monorepo-parent/child-b");
  });

  it("flags monorepo-parent as self-runnable-parent (has own pkg + children)", async () => {
    const found = await walkProjects(FIX);
    const parent = found.find((p) => p.id === "monorepo-parent")!;
    expect(parent.kind).toBe("self-runnable-parent");
    expect(parent.children.sort()).toEqual(["monorepo-parent/child-a", "monorepo-parent/child-b"]);
  });

  it("sets parent on children", async () => {
    const found = await walkProjects(FIX);
    const child = found.find((p) => p.id === "monorepo-parent/child-a")!;
    expect(child.parent).toBe("monorepo-parent");
  });

  it("ignores node_modules and _reference inside noisy/", async () => {
    const found = await walkProjects(FIX);
    const ids = found.map((p) => p.id);
    expect(ids).not.toContain("noisy/node_modules");
    expect(ids).not.toContain("noisy/_reference");
    expect(ids).toContain("noisy");
  });

  it("uses forward-slash separators in id even on Windows", async () => {
    const found = await walkProjects(FIX);
    for (const p of found) {
      expect(p.id).not.toContain("\\");
    }
  });
});

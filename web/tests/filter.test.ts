import { describe, it, expect } from "vitest";
import { applyFilters, sortProjects, groupByParent } from "../src/lib/filter";
import type { Project } from "../src/types";

function p(over: Partial<Project>): Project {
  return {
    id: "x", path: "x", absPath: "/x", kind: "node", name: "x",
    description: null, descriptionAuto: null, language: "node",
    frameworks: [], tags: [], startCommand: null, startCommandDetected: null,
    port: null, portDetected: null, archived: false,
    detectedUrls: [],
    children: [], parent: null,
    lastEditedByUser: null, gitBranch: null, lastModified: null,
    ...over,
  };
}

describe("applyFilters", () => {
  it("returns all when no filters set", () => {
    const list = [p({ id: "a" }), p({ id: "b" })];
    expect(applyFilters(list, { search: "", language: "all", showArchived: false }).length).toBe(2);
  });

  it("filters by language", () => {
    const list = [p({ id: "a", language: "node" }), p({ id: "b", language: "python" })];
    expect(applyFilters(list, { search: "", language: "node", showArchived: false })).toHaveLength(1);
  });

  it("hides archived by default", () => {
    const list = [p({ id: "a", archived: true }), p({ id: "b" })];
    expect(applyFilters(list, { search: "", language: "all", showArchived: false }).map((x) => x.id)).toEqual(["b"]);
  });

  it("includes archived when showArchived=true", () => {
    const list = [p({ id: "a", archived: true }), p({ id: "b" })];
    expect(applyFilters(list, { search: "", language: "all", showArchived: true }).length).toBe(2);
  });

  it("searches name, description, tags case-insensitively", () => {
    const list = [
      p({ id: "alpha", name: "alpha", description: "uses Next.js" }),
      p({ id: "beta", name: "beta", tags: ["实验"] }),
      p({ id: "gamma", name: "gamma", descriptionAuto: "fastapi project" }),
    ];
    expect(applyFilters(list, { search: "next", language: "all", showArchived: false }).map((x) => x.id)).toEqual(["alpha"]);
    expect(applyFilters(list, { search: "实验", language: "all", showArchived: false }).map((x) => x.id)).toEqual(["beta"]);
    expect(applyFilters(list, { search: "FASTAPI", language: "all", showArchived: false }).map((x) => x.id)).toEqual(["gamma"]);
  });
});

describe("sortProjects", () => {
  it("sorts by name asc", () => {
    const list = [p({ id: "b", name: "b" }), p({ id: "a", name: "a" })];
    expect(sortProjects(list, "name").map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("sorts by lastModified desc (most recent first)", () => {
    const list = [
      p({ id: "old", lastModified: "2024-01-01T00:00:00Z" }),
      p({ id: "new", lastModified: "2026-05-01T00:00:00Z" }),
      p({ id: "missing", lastModified: null }),
    ];
    const sorted = sortProjects(list, "lastModified").map((x) => x.id);
    expect(sorted[0]).toBe("new");
    expect(sorted[1]).toBe("old");
    expect(sorted[2]).toBe("missing");
  });
});

describe("groupByParent", () => {
  it("returns flat list when grouped=false", () => {
    const list = [
      p({ id: "a" }),
      p({ id: "a/b", parent: "a" }),
      p({ id: "c" }),
    ];
    const result = groupByParent(list, false);
    expect(result.flat).toHaveLength(3);
    expect(result.parents).toEqual([]);
  });

  it("nests children under parent when grouped=true", () => {
    const list = [
      p({ id: "a", children: ["a/b", "a/c"] }),
      p({ id: "a/b", parent: "a" }),
      p({ id: "a/c", parent: "a" }),
      p({ id: "d" }),
    ];
    const result = groupByParent(list, true);
    expect(result.parents.map((g) => g.parent.id)).toEqual(["a", "d"]);
    const aGroup = result.parents.find((g) => g.parent.id === "a")!;
    expect(aGroup.children.map((c) => c.id)).toEqual(["a/b", "a/c"]);
  });
});

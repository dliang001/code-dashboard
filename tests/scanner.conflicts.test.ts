import { describe, it, expect } from "vitest";
import { findConflicts } from "../src/scanner/conflicts";
import type { Project } from "../src/types";

function p(over: Partial<Project> & { id: string }): Project {
  return {
    id: over.id,
    path: over.id,
    absPath: `D:\\code\\${over.id}`,
    kind: "node",
    name: over.id,
    description: null,
    descriptionAuto: null,
    language: "node",
    frameworks: [],
    tags: [],
    startCommand: null,
    startCommandDetected: null,
    port: null,
    portDetected: null,
    detectedUrls: [],
    archived: false,
    children: [],
    parent: null,
    lastEditedByUser: null,
    gitBranch: null,
    lastModified: null,
    ...over,
  };
}

describe("findConflicts", () => {
  it("flags two unrelated projects sharing a port", () => {
    const projects = [
      p({ id: "a", portDetected: 3000 }),
      p({ id: "b", portDetected: 3000 }),
    ];
    const conflicts = findConflicts(projects);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.port).toBe(3000);
    expect(conflicts[0]!.projectIds.sort()).toEqual(["a", "b"]);
  });

  it("does NOT flag a parent and its own child sharing a port", () => {
    // shouqian/app (parent, inherits child's port via nested scan) and
    // shouqian/app/web are the same service surfaced at two depths.
    const projects = [
      p({ id: "app", portDetected: 8717, children: ["app/web"] }),
      p({ id: "app/web", portDetected: 8717, parent: "app" }),
    ];
    expect(findConflicts(projects)).toHaveLength(0);
  });

  it("does NOT flag an ancestor sharing a port with a deeper descendant", () => {
    const projects = [
      p({ id: "top", portDetected: 8000, children: ["top/backend"] }),
      p({ id: "top/backend", portDetected: 8000, parent: "top", children: ["top/backend/app"] }),
      p({ id: "top/backend/app", portDetected: 8000, parent: "top/backend" }),
    ];
    expect(findConflicts(projects)).toHaveLength(0);
  });

  it("still flags real conflicts that include a parent/child pair", () => {
    // app + app/web are one service (8717), but `other` is a genuine third
    // project also on 8717 → a real 2-way conflict between the service and other.
    const projects = [
      p({ id: "app", portDetected: 8717, children: ["app/web"] }),
      p({ id: "app/web", portDetected: 8717, parent: "app" }),
      p({ id: "other", portDetected: 8717 }),
    ];
    const conflicts = findConflicts(projects);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.projectIds).toContain("other");
    // The deepest of the family (app/web) represents the service.
    expect(conflicts[0]!.projectIds).toContain("app/web");
    expect(conflicts[0]!.projectIds).not.toContain("app");
  });
});

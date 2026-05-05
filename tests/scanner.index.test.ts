import { describe, it, expect } from "vitest";
import path from "node:path";
import { scan } from "../src/scanner";

const FIX = path.join(__dirname, "fixtures", "sample-tree");

describe("scan", () => {
  it("returns ScanResult with projects and conflicts", async () => {
    const result = await scan(FIX);
    expect(result.scanRoot).toBe(FIX);
    expect(result.scannedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.projects.length).toBeGreaterThan(5);
  });

  it("detects port conflicts", async () => {
    const result = await scan(FIX);
    const c = result.conflicts.find((c) => c.port === 9999);
    expect(c).toBeDefined();
    expect(c!.projectIds.sort()).toEqual(["port-conflict-a", "port-conflict-b"]);
  });

  it("does not flag unique ports as conflicts", async () => {
    const result = await scan(FIX);
    const ports = result.conflicts.map((c) => c.port);
    expect(ports).not.toContain(4111); // node-app's unique port
  });
});

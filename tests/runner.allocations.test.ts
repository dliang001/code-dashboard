import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { AllocationStore } from "../src/runner/allocations";

const tempDirs: string[] = [];

async function tmpFile(name = "alloc.json"): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "alloc-"));
  tempDirs.push(dir);
  return path.join(dir, name);
}

describe("AllocationStore", () => {
  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("loads empty from a missing file", async () => {
    const store = await AllocationStore.load(await tmpFile());
    expect(store.get("anything")).toBeUndefined();
    expect(store.snapshot()).toEqual({});
  });

  it("persists a set and survives a reload (cross-restart stability)", async () => {
    const file = await tmpFile();
    const a = await AllocationStore.load(file);
    await a.set("photo/web", 5174);
    const b = await AllocationStore.load(file);
    expect(b.get("photo/web")).toBe(5174);
  });

  it("updates an existing allocation", async () => {
    const file = await tmpFile();
    const a = await AllocationStore.load(file);
    await a.set("x", 5174);
    await a.set("x", 5180);
    expect((await AllocationStore.load(file)).get("x")).toBe(5180);
  });

  it("clears an allocation", async () => {
    const file = await tmpFile();
    const a = await AllocationStore.load(file);
    await a.set("x", 5174);
    await a.clear("x");
    expect((await AllocationStore.load(file)).get("x")).toBeUndefined();
  });

  it("ignores a corrupt allocations file instead of throwing", async () => {
    const file = await tmpFile();
    await fs.writeFile(file, "{ not valid json", "utf-8");
    const store = await AllocationStore.load(file);
    expect(store.snapshot()).toEqual({});
  });

  it("handles concurrent sets without corrupting the file", async () => {
    const file = await tmpFile();
    const a = await AllocationStore.load(file);
    await Promise.all([
      a.set("a", 5174),
      a.set("b", 5175),
      a.set("c", 5176),
    ]);
    const reloaded = await AllocationStore.load(file);
    expect(reloaded.snapshot()).toEqual({ a: 5174, b: 5175, c: 5176 });
  });
});

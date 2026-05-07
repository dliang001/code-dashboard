import { describe, it, expect } from "vitest";
import net from "node:net";
import { probePort, ProbeCache, probeAll } from "../src/probe/port";
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

describe("probePort", () => {
  it("returns false for an unused port", async () => {
    const result = await probePort(63123);
    expect(result).toBe(false);
  });

  it("returns true for a port that has a listener", async () => {
    const server = net.createServer();
    await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const result = await probePort(port);
    server.close();
    expect(result).toBe(true);
  });
});

describe("ProbeCache", () => {
  it("returns idle as default", () => {
    const c = new ProbeCache();
    expect(c.get("missing")).toBe("idle");
  });

  it("set/get round-trips", () => {
    const c = new ProbeCache();
    c.set("a", "running-external");
    expect(c.get("a")).toBe("running-external");
  });
});

describe("probeAll", () => {
  it("marks listening ports as running-external", async () => {
    const server = net.createServer();
    await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const cache = new ProbeCache();
    await probeAll([p({ id: "live", portDetected: port })], cache);
    server.close();
    expect(cache.get("live")).toBe("running-external");
  });

  it("marks unlistened ports as idle", async () => {
    const cache = new ProbeCache();
    await probeAll([p({ id: "dead", portDetected: 63124 })], cache);
    expect(cache.get("dead")).toBe("idle");
  });

  it("ignores projects with no declared port", async () => {
    const cache = new ProbeCache();
    await probeAll([p({ id: "noport" })], cache);
    expect(cache.snapshot()).toEqual({});
  });
});

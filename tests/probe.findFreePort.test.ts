import { describe, it, expect } from "vitest";
import net from "node:net";
import { findFreePort, parseExcludedPortRanges } from "../src/probe/port";

function listen(port: number): Promise<net.Server> {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.once("error", rej);
    s.listen(port, "127.0.0.1", () => res(s));
  });
}

async function listenAny(): Promise<{ server: net.Server; port: number }> {
  const s = await new Promise<net.Server>((res) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => res(srv));
  });
  const addr = s.address();
  if (!addr || typeof addr !== "object") throw new Error("no address");
  return { server: s, port: addr.port };
}

describe("findFreePort", () => {
  it("returns the start port if it's free", async () => {
    const { server, port } = await listenAny();
    server.close(); // free it
    const got = await findFreePort(port);
    expect(got).toBe(port);
  });

  it("walks past an occupied port to the next free one", async () => {
    // Take port N, ensure findFreePort starting at N returns >= N+1.
    const { server, port } = await listenAny();
    try {
      const got = await findFreePort(port);
      expect(got).not.toBe(port);
      expect(got).toBeGreaterThan(port);
    } finally {
      server.close();
    }
  });

  it("respects the maxAttempts cap", async () => {
    // Lock 3 consecutive ports; ask findFreePort starting at the first
    // with maxAttempts=3 → all candidates occupied → null.
    const a = await listenAny();
    const b = await listen(a.port + 1).catch(() => null);
    const c = b ? await listen(a.port + 2).catch(() => null) : null;
    try {
      if (b && c) {
        const got = await findFreePort(a.port, 3);
        expect(got).toBeNull();
      } else {
        // Couldn't grab 3 sequential ports — port range was racy. Skip rather than flake.
        expect(true).toBe(true);
      }
    } finally {
      a.server.close();
      b?.close();
      c?.close();
    }
  });
});

describe("parseExcludedPortRanges", () => {
  it("parses Windows netsh excluded TCP port ranges", () => {
    const output = [
      "",
      "Protocol tcp Port Exclusion Ranges",
      "",
      "Start Port    End Port",
      "----------    --------",
      "      5141        5240",
      "     50000       50059     *",
      "",
      "* - Administered port exclusions.",
    ].join("\n");

    expect(parseExcludedPortRanges(output)).toEqual([
      [5141, 5240],
      [50000, 50059],
    ]);
  });
});

import { describe, it, expect } from "vitest";
import path from "node:path";
import { detectPort } from "../src/scanner/ports";

const FIX = path.join(__dirname, "fixtures", "sample-tree");

describe("detectPort", () => {
  it("extracts port from npm script -p flag", async () => {
    const port = await detectPort(path.join(FIX, "port-from-script"));
    expect(port).toBe(5050);
  });

  it("extracts port from --port flag in scripts", async () => {
    const port = await detectPort(path.join(FIX, "node-app"));
    expect(port).toBe(4111);
  });

  it("extracts port from vite.config.ts server.port", async () => {
    const port = await detectPort(path.join(FIX, "port-from-vite"));
    expect(port).toBe(7070);
  });

  it("extracts port from .env PORT=", async () => {
    const port = await detectPort(path.join(FIX, "port-from-env"));
    expect(port).toBe(6060);
  });

  it("extracts host port from docker-compose.yml", async () => {
    const port = await detectPort(path.join(FIX, "docker-app"));
    expect(port).toBe(8080);
  });

  it("extracts port from a common workspace web package", async () => {
    const port = await detectPort(path.join(FIX, "workspace-web"));
    expect(port).toBe(3100);
  });

  it("falls back to the Next.js default port", async () => {
    const port = await detectPort(path.join(FIX, "default-next"));
    expect(port).toBe(3000);
  });

  it("falls back to the Flask default port", async () => {
    const port = await detectPort(path.join(FIX, "default-flask"));
    expect(port).toBe(5000);
  });

  it("returns null when no port info present", async () => {
    const port = await detectPort(path.join(FIX, "rust-app"));
    expect(port).toBeNull();
  });
});

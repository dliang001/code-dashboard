import { describe, it, expect } from "vitest";
import path from "node:path";
import { detectPort, portFromUrls } from "../src/scanner/ports";

const FIX = path.join(__dirname, "fixtures", "sample-tree");

describe("portFromUrls", () => {
  it("returns null when no localhost URL carries a port", () => {
    expect(portFromUrls(["https://example.com", "http://localhost"])).toBeNull();
    expect(portFromUrls([])).toBeNull();
    expect(portFromUrls(undefined)).toBeNull();
  });

  it("picks the most-referenced localhost port", () => {
    expect(portFromUrls([
      "http://localhost:3000/api",
      "http://localhost:8765",
      "http://localhost:3000",
    ])).toBe(3000);
  });

  it("keeps the first-seen port on a tie (own UI before sibling links)", () => {
    // notebooklm: its own UI :8765 is documented before a sibling's :3000.
    expect(portFromUrls(["http://127.0.0.1:8765", "http://localhost:3000"])).toBe(8765);
  });
});

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

  it("extracts fallback port from a Vite config port variable", async () => {
    const port = await detectPort(path.join(FIX, "port-from-vite-env"));
    expect(port).toBe(5780);
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

  // Behavior change (requested): a web project should surface SOME port even
  // when nothing is written down, so the dashboard's port column isn't blank.
  // Framework defaults are the lowest-priority fallback, used only when no
  // explicit port and no documented URL was found.
  it("falls back to the Next.js default port when deps say next", async () => {
    const port = await detectPort(path.join(FIX, "default-next"));
    expect(port).toBe(3000);
  });

  it("falls back to the Flask default port when requirements say flask", async () => {
    const port = await detectPort(path.join(FIX, "default-flask"));
    expect(port).toBe(5000);
  });

  it("falls back to the Vite default port for a bare Vite project", async () => {
    const port = await detectPort(path.join(FIX, "vite-default"));
    expect(port).toBe(5173);
  });

  it("scans the actual detected Python entry file, not just the allow-list", async () => {
    // auto_leak_monitor.py is the real Flask entry but its name is not in the
    // hard-coded filename list, so the explicit app.run(port=5005) was missed.
    const port = await detectPort(path.join(FIX, "port-from-python-entry"));
    expect(port).toBe(5005);
  });

  it("falls back to a localhost port documented in detectedUrls", async () => {
    // The README only carries the port via a URL (http://localhost:8787); there
    // is no script/config/env to read it from.
    const port = await detectPort(path.join(FIX, "url-fallback"), {
      detectedUrls: ["http://localhost:8787"],
    });
    expect(port).toBe(8787);
  });

  it("extracts a Flask config fallback port from a custom entry file", async () => {
    const port = await detectPort(path.join(FIX, "flask-custom-entry"));
    expect(port).toBe(5679);
  });

  it("prefers web-like docker services over database ports", async () => {
    const port = await detectPort(path.join(FIX, "docker-with-db"));
    expect(port).toBe(8080);
  });

  it("extracts port from APP_URL in .env", async () => {
    const port = await detectPort(path.join(FIX, "port-from-app-url"));
    expect(port).toBe(3301);
  });

  it("returns null when no port info present", async () => {
    const port = await detectPort(path.join(FIX, "rust-app"));
    expect(port).toBeNull();
  });

  it("falls back to a --port flag from a README code block", async () => {
    // shouqian/app/server scenario: requirements.txt is present but its
    // framework-default rule is disabled, the real entry sits under app/main.py
    // (which the .py file probe never sees), and the only --port hint is in
    // the documented uvicorn invocation inside the README.
    const port = await detectPort(path.join(FIX, "port-from-readme"));
    expect(port).toBe(8765);
  });
});

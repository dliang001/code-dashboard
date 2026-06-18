import { describe, it, expect } from "vitest";
import { applyPortToCommand, chooseLaunchPort } from "../src/runner/schedule";

describe("applyPortToCommand", () => {
  it("passes --port through an npm script for Vite (PORT env is ignored by Vite)", () => {
    const r = applyPortToCommand("npm run dev", ["react", "vite"], 5174);
    expect(r.command).toBe("npm run dev -- --port 5174");
    expect(r.env).toEqual({});
  });

  it("passes --port straight through for yarn", () => {
    const r = applyPortToCommand("yarn dev", ["vite"], 5174);
    expect(r.command).toBe("yarn dev --port 5174");
  });

  it("detects Vite from the command even without a framework hint", () => {
    const r = applyPortToCommand("vite", [], 5175);
    expect(r.command).toBe("vite --port 5175");
  });

  it("rewrites an explicit --port flag instead of appending", () => {
    const r = applyPortToCommand(
      ".venv\\Scripts\\uvicorn app.main:app --reload --port 8718",
      ["fastapi"],
      8719,
    );
    expect(r.command).toBe(".venv\\Scripts\\uvicorn app.main:app --reload --port 8719");
    expect(r.env).toEqual({});
  });

  it("rewrites a short -p flag", () => {
    const r = applyPortToCommand("next dev -p 3000", ["next"], 3001);
    expect(r.command).toBe("next dev -p 3001");
  });

  it("uses PORT env for Next.js / Express (which read it)", () => {
    const r = applyPortToCommand("npm run dev", ["next", "react"], 3001);
    expect(r.command).toBe("npm run dev");
    expect(r.env).toEqual({ PORT: "3001" });
  });

  it("falls back to PORT env for an unknown express command", () => {
    const r = applyPortToCommand("npm run start", ["express"], 4001);
    expect(r.command).toBe("npm run start");
    expect(r.env).toEqual({ PORT: "4001" });
  });
});

describe("chooseLaunchPort", () => {
  const free = (...taken: number[]) => async (p: number) => !taken.includes(p);

  it("uses the desired port when free and nothing remembered", async () => {
    expect(await chooseLaunchPort(3000, undefined, free())).toBe(3000);
  });

  it("prefers a remembered allocation for stability, even if the desired port is free", async () => {
    // bumped to 5174 last time → keep 5174 so the bookmark stays valid.
    expect(await chooseLaunchPort(3000, 5174, free())).toBe(5174);
  });

  it("re-bumps when the remembered port is now taken", async () => {
    expect(await chooseLaunchPort(3000, 5174, free(5174))).toBe(5175);
  });

  it("walks up from the desired port when it is taken and nothing remembered", async () => {
    expect(await chooseLaunchPort(3000, undefined, free(3000, 3001))).toBe(3002);
  });

  it("returns null when no port in range is free", async () => {
    expect(await chooseLaunchPort(3000, undefined, async () => false, 5)).toBeNull();
  });
});

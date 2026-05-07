import { describe, it, expect } from "vitest";
import path from "node:path";
import { detectUrls } from "../src/scanner/urls";

const FIX = path.join(__dirname, "fixtures", "sample-tree");

describe("detectUrls", () => {
  it("extracts localhost URLs from nested README files", async () => {
    const urls = await detectUrls(path.join(FIX, "tool-url"));
    expect(urls).toContain("http://localhost:3000/api/automation-lab/ui/");
  });

  it("ignores generated data directories", async () => {
    const urls = await detectUrls(path.join(FIX, "tool-url"));
    expect(urls).not.toContain("http://localhost:9999/ignored");
  });
});

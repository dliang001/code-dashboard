import { describe, it, expect } from "vitest";
import { formatRelative, formatPort, projectEmoji } from "../src/lib/format";

describe("formatRelative", () => {
  it("returns dash for null", () => {
    expect(formatRelative(null)).toBe("—");
  });

  it("returns 'just now' for <1m old", () => {
    const iso = new Date(Date.now() - 30_000).toISOString();
    expect(formatRelative(iso)).toBe("刚刚");
  });

  it("returns minutes for <1h old", () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelative(iso)).toMatch(/5 分钟前/);
  });

  it("returns hours for <1d old", () => {
    const iso = new Date(Date.now() - 3 * 3600_000).toISOString();
    expect(formatRelative(iso)).toMatch(/3 小时前/);
  });

  it("returns days for older", () => {
    const iso = new Date(Date.now() - 4 * 24 * 3600_000).toISOString();
    expect(formatRelative(iso)).toMatch(/4 天前/);
  });
});

describe("formatPort", () => {
  it("dashes when null", () => {
    expect(formatPort(null)).toBe("—");
  });
  it("formats with leading colon", () => {
    expect(formatPort(3000)).toBe(":3000");
  });
});

describe("projectEmoji (geometric glyphs)", () => {
  // The cosmic-console design uses ASCII-ish geometric markers, not emoji.
  it("returns ▣ for docker", () => {
    expect(projectEmoji("docker")).toBe("▣");
  });
  it("returns ◇ for python", () => {
    expect(projectEmoji("python")).toBe("◇");
  });
  it("returns □ for unknown kind", () => {
    expect(projectEmoji("unknown")).toBe("□");
  });
});

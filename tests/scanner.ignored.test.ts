import { describe, it, expect } from "vitest";
import { isIgnored, DEFAULT_IGNORED_DIRS } from "../src/scanner/ignored";

describe("isIgnored", () => {
  it("returns true for default ignored dirs", () => {
    expect(isIgnored("node_modules")).toBe(true);
    expect(isIgnored(".next")).toBe(true);
    expect(isIgnored("__pycache__")).toBe(true);
    expect(isIgnored("dist")).toBe(true);
    expect(isIgnored(".git")).toBe(true);
    expect(isIgnored("target")).toBe(true);
  });

  it("returns true for any underscore-prefixed dir", () => {
    expect(isIgnored("_reference")).toBe(true);
    expect(isIgnored("_old")).toBe(true);
  });

  it("returns false for normal project names", () => {
    expect(isIgnored("photo")).toBe(false);
    expect(isIgnored("autoposter")).toBe(false);
    expect(isIgnored("数据标定-升级版V1.0")).toBe(false);
  });

  it("does not ignore .env (it is a file, not a dir)", () => {
    expect(isIgnored(".env")).toBe(false);
  });

  it("respects user-supplied additional ignores", () => {
    expect(isIgnored("custom-noise", ["custom-noise"])).toBe(true);
  });

  it("DEFAULT_IGNORED_DIRS contains expected entries", () => {
    expect(DEFAULT_IGNORED_DIRS).toContain("node_modules");
    expect(DEFAULT_IGNORED_DIRS).toContain(".next");
    expect(DEFAULT_IGNORED_DIRS).not.toContain(".env");
  });
});

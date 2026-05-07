import { describe, it, expect } from "vitest";
import { commandLineMatchesPath, basename, matchProjectsToProcesses, type RunningProc } from "../src/probe/process";
import type { Project } from "../src/types";

function p(over: Partial<Project>): Project {
  return {
    id: over.id ?? "x",
    path: over.path ?? "x",
    absPath: over.absPath ?? "/x",
    kind: "node",
    name: over.name ?? "x",
    description: null, descriptionAuto: null,
    language: null, frameworks: [], tags: [],
    startCommand: null, startCommandDetected: null,
    port: null, portDetected: null,
    detectedUrls: [],
    archived: false,
    children: [], parent: null,
    lastEditedByUser: null, gitBranch: null, lastModified: null,
    ...over,
  };
}

describe("basename", () => {
  it("returns the last segment lowercased", () => {
    expect(basename("/usr/bin/node")).toBe("node");
    expect(basename("C:\\Program Files\\nodejs\\node.exe")).toBe("node.exe");
    expect(basename("Python3.exe")).toBe("python3.exe");
  });

  it("handles empty input", () => {
    expect(basename("")).toBe("");
  });
});

describe("commandLineMatchesPath", () => {
  it("matches when path is followed by a separator", () => {
    expect(commandLineMatchesPath('node D:\\code\\photo\\server.js', "D:\\code\\photo")).toBe(true);
  });

  it("matches when path is wrapped in quotes", () => {
    expect(commandLineMatchesPath('"D:\\code\\photo" --port 3000', "D:\\code\\photo")).toBe(true);
  });

  it("matches when path appears at the end of the command", () => {
    expect(commandLineMatchesPath('cd D:\\code\\photo', "D:\\code\\photo")).toBe(true);
  });

  it("does NOT match a path that's a prefix of a longer path", () => {
    // The bug we want to avoid: D:\code\xyz should not match D:\code\xyz-extra.
    expect(commandLineMatchesPath('node D:\\code\\xyz-extra\\server.js', "D:\\code\\xyz")).toBe(false);
  });

  it("matches case-insensitively on Windows-style paths", () => {
    // On win32 platform, case shouldn't matter.
    if (process.platform !== "win32") return;
    expect(commandLineMatchesPath('node D:\\Code\\Photo\\server.js', "d:\\code\\photo")).toBe(true);
  });

  it("matches Unix-style paths", () => {
    expect(commandLineMatchesPath("python /home/me/proj/app.py", "/home/me/proj")).toBe(true);
    expect(commandLineMatchesPath("python /home/me/proj-extra/app.py", "/home/me/proj")).toBe(false);
  });

  it("returns false on empty inputs", () => {
    expect(commandLineMatchesPath("", "/x")).toBe(false);
    expect(commandLineMatchesPath("node /x/server.js", "")).toBe(false);
  });
});

describe("matchProjectsToProcesses", () => {
  const procs: RunningProc[] = [
    { pid: 1001, commandLine: "node D:\\code\\photo\\server.js", binName: "node.exe" },
    { pid: 1002, commandLine: "python D:\\code\\autoposter\\main.py", binName: "python.exe" },
    { pid: 1003, commandLine: "code.exe D:\\code\\open-design", binName: "code.exe" },
  ];

  it("matches projects with their running process", () => {
    const projects = [
      p({ id: "photo", absPath: "D:\\code\\photo" }),
      p({ id: "autoposter", absPath: "D:\\code\\autoposter" }),
      p({ id: "unrelated", absPath: "D:\\code\\unrelated" }),
    ];
    const m = matchProjectsToProcesses(projects, procs);
    expect(m.get("photo")).toBe(1001);
    expect(m.get("autoposter")).toBe(1002);
    expect(m.has("unrelated")).toBe(false);
  });

  it("returns empty map when no procs match", () => {
    const m = matchProjectsToProcesses([p({ id: "z", absPath: "D:\\code\\nope" })], procs);
    expect(m.size).toBe(0);
  });

  it("returns first matching pid only", () => {
    const dupProcs: RunningProc[] = [
      { pid: 9001, commandLine: "node D:\\code\\photo\\a.js", binName: "node.exe" },
      { pid: 9002, commandLine: "node D:\\code\\photo\\b.js", binName: "node.exe" },
    ];
    const m = matchProjectsToProcesses([p({ id: "photo", absPath: "D:\\code\\photo" })], dupProcs);
    expect(m.get("photo")).toBe(9001);
  });
});

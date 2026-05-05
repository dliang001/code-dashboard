import { spawn, type SpawnOptions } from "node:child_process";

/**
 * Run a detached, fire-and-forget process.
 * Resolves once the child has spawned successfully (after the 'spawn' event).
 * Rejects on spawn-level errors (ENOENT etc.).
 */
function spawnDetached(label: string, cmd: string, args: string[], options: SpawnOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore", ...options });
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
    child.once("error", (err) => {
      reject(new Error(`${label} failed: ${err.message}`));
    });
  });
}

function pickCmd(win: string, mac: string, linux: string): string {
  if (process.platform === "win32") return win;
  if (process.platform === "darwin") return mac;
  return linux;
}

/**
 * Cross-platform "open in OS file manager".
 */
export async function openFolder(absPath: string): Promise<void> {
  const cmd = pickCmd("explorer.exe", "open", "xdg-open");
  await spawnDetached("openFolder", cmd, [absPath]);
}

/**
 * Open the project in VSCode via the `code` CLI on PATH.
 */
export async function openVSCode(absPath: string): Promise<void> {
  const cmd = process.platform === "win32" ? "code.cmd" : "code";
  try {
    await spawnDetached("openVSCode", cmd, [absPath]);
  } catch (err) {
    throw new Error(`openVSCode failed (is 'code' on PATH?): ${(err as Error).message}`);
  }
}

/**
 * Open a new terminal window in the project directory.
 */
export async function openTerminal(absPath: string): Promise<void> {
  if (process.platform === "win32") {
    // Try Windows Terminal first; fall back to cmd.exe in a new window.
    // Path is quoted to handle spaces. Both wt.exe and the cmd fallback receive a quoted path.
    try {
      await spawnDetached("openTerminal(wt)", "wt.exe", ["-d", absPath]);
      return;
    } catch {
      // wt not on PATH; try cmd fallback
    }
    // Use cmd.exe arg-array form (no shell concat) so spaces in absPath are safe.
    // `start "" "cmd" /K "cd /d <quoted-path>"` opens a new window.
    const cdCmd = `cd /d "${absPath.replace(/"/g, '""')}"`;
    await spawnDetached("openTerminal(cmd)", "cmd.exe", ["/c", "start", "", "cmd.exe", "/K", cdCmd]);
    return;
  }
  if (process.platform === "darwin") {
    // Use single quotes around the path inside the shell command;
    // escape any embedded single quotes via the standard '\'' trick.
    const safePath = absPath.replace(/'/g, `'\\''`);
    const osa = `tell application "Terminal" to do script "cd '${safePath}'"`;
    await spawnDetached("openTerminal", "osascript", ["-e", osa]);
    return;
  }
  // Linux: try $TERMINAL, then a list of common emulators with their working-directory flag.
  // Different terminals use different flags, so we provide pairs.
  const candidates: Array<{ cmd: string; args: string[] }> = [];
  if (process.env.TERMINAL) {
    candidates.push({ cmd: process.env.TERMINAL, args: ["--working-directory", absPath] });
  }
  candidates.push(
    { cmd: "x-terminal-emulator", args: ["--working-directory", absPath] },
    { cmd: "gnome-terminal", args: ["--working-directory", absPath] },
    { cmd: "konsole", args: ["--workdir", absPath] },
    { cmd: "xfce4-terminal", args: ["--working-directory", absPath] },
    { cmd: "xterm", args: ["-e", `cd "${absPath.replace(/"/g, '\\"')}" && bash`] },
  );
  let lastErr: Error | null = null;
  for (const { cmd, args } of candidates) {
    try {
      await spawnDetached("openTerminal", cmd, args);
      return;
    } catch (err) {
      lastErr = err as Error;
    }
  }
  throw new Error(`openTerminal failed: no terminal emulator found on PATH (last error: ${lastErr?.message ?? "n/a"})`);
}

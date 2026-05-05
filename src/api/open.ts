import { spawn } from "node:child_process";

/**
 * Cross-platform "open in OS file manager".
 * Windows: explorer.exe <path>
 * macOS: open <path>
 * Linux: xdg-open <path>
 * Returns void; spawn errors propagate as thrown errors.
 */
export function openFolder(absPath: string): void {
  const cmd = pickCmd("explorer.exe", "open", "xdg-open");
  const child = spawn(cmd, [absPath], { detached: true, stdio: "ignore" });
  child.on("error", (err) => {
    // Surface a meaningful message for the API layer to wrap as 500.
    throw new Error(`openFolder failed: ${err.message}`);
  });
  child.unref();
}

/**
 * Open the project in VSCode via the `code` CLI on PATH.
 * Falls through to throw if `code` is not on PATH.
 */
export function openVSCode(absPath: string): void {
  const cmd = process.platform === "win32" ? "code.cmd" : "code";
  const child = spawn(cmd, [absPath], { detached: true, stdio: "ignore" });
  child.on("error", (err) => {
    throw new Error(`openVSCode failed (is 'code' on PATH?): ${err.message}`);
  });
  child.unref();
}

/**
 * Open a new terminal window in the project directory.
 * Windows: Windows Terminal `wt -d <path>` if available, else `cmd /K cd /d <path>`
 * macOS: AppleScript via `osascript`
 * Linux: best-effort via $TERMINAL or x-terminal-emulator
 */
export function openTerminal(absPath: string): void {
  if (process.platform === "win32") {
    // Try Windows Terminal first; fall back to cmd in a new window.
    // We can't reliably detect wt presence cheaply, so try wt and let spawn ENOENT fall through.
    const wt = spawn("wt.exe", ["-d", absPath], { detached: true, stdio: "ignore" });
    wt.on("error", () => {
      const fallback = spawn("cmd.exe", ["/c", "start", "cmd.exe", "/K", `cd /d ${absPath}`], {
        detached: true, stdio: "ignore", windowsVerbatimArguments: false,
      });
      fallback.on("error", (err) => {
        throw new Error(`openTerminal failed: ${err.message}`);
      });
      fallback.unref();
    });
    wt.unref();
    return;
  }
  if (process.platform === "darwin") {
    const osa = `tell application "Terminal" to do script "cd ${shellEscape(absPath)}"`;
    const child = spawn("osascript", ["-e", osa], { detached: true, stdio: "ignore" });
    child.on("error", (err) => { throw new Error(`openTerminal failed: ${err.message}`); });
    child.unref();
    return;
  }
  // linux: try $TERMINAL, x-terminal-emulator, gnome-terminal in turn.
  const candidates = [process.env.TERMINAL, "x-terminal-emulator", "gnome-terminal", "konsole", "xterm"].filter(Boolean) as string[];
  trySpawn(candidates, ["--working-directory", absPath]);
}

function pickCmd(win: string, mac: string, linux: string): string {
  if (process.platform === "win32") return win;
  if (process.platform === "darwin") return mac;
  return linux;
}

function shellEscape(s: string): string {
  return s.replace(/(["\\$`])/g, "\\$1");
}

function trySpawn(candidates: string[], args: string[]): void {
  if (candidates.length === 0) {
    throw new Error("openTerminal failed: no terminal emulator found on PATH");
  }
  const [head, ...rest] = candidates;
  const child = spawn(head!, args, { detached: true, stdio: "ignore" });
  child.on("error", () => trySpawn(rest, args));
  child.unref();
}

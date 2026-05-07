import { useState } from "react";
import * as api from "../api";

type Phase =
  | { kind: "idle" }
  | { kind: "confirm"; action: "restart" | "shutdown" }
  | { kind: "restarting" }
  | { kind: "shutdown-done" }
  | { kind: "error"; message: string };

/**
 * Topbar admin controls: restart / shutdown the dashboard process itself.
 * The dashboard runs hidden in the background after the desktop launcher
 * starts it, so this is the only ergonomic way to bounce it without going
 * through Task Manager.
 */
export function AdminMenu() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const onRestart = async () => {
    setPhase({ kind: "restarting" });
    const previousStartedAt = await getServerStartedAt();
    try {
      await api.adminRestart();
    } catch {
      // Connection drop is normal during restart — fall through to polling.
    }
    pollUntilRestarted(previousStartedAt).then((ok) => {
      if (ok) {
        window.location.reload();
      } else {
        setPhase({
          kind: "error",
          message: "重启超时（30s 未响应）。请检查桌面快捷方式或 Task Manager。",
        });
      }
    });
  };

  const onShutdown = async () => {
    try {
      await api.adminShutdown();
    } catch {
      /* expected — server is going away */
    }
    setPhase({ kind: "shutdown-done" });
  };

  return (
    <>
      <button
        type="button"
        className="ghost-btn"
        onClick={() => setPhase({ kind: "confirm", action: "restart" })}
        title="重启 dashboard 服务"
      >
        <span className="mono">↻ RESTART</span>
      </button>
      <button
        type="button"
        className="ghost-btn is-danger"
        onClick={() => setPhase({ kind: "confirm", action: "shutdown" })}
        title="关闭 dashboard"
      >
        <span className="mono">⏻ SHUTDOWN</span>
      </button>

      {phase.kind === "confirm" && (
        <Modal>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--ink-2)", marginBottom: 8 }}>
            {phase.action === "restart" ? "确认 · 重启" : "确认 · 关闭"}
          </div>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--ink-0)" }}>
            {phase.action === "restart" ? "重启 dashboard?" : "关闭 dashboard?"}
          </h3>
          <p style={{ margin: "10px 0 18px", fontSize: 13, color: "var(--ink-1)", lineHeight: 1.6 }}>
            所有由 dashboard 启动的子进程会被停止。
            {phase.action === "shutdown" && (
              <>
                {" "}
                想要再启动，请双击桌面{" "}
                <span className="mono" style={{ color: "var(--ink-0)" }}>
                  Code Dashboard
                </span>{" "}
                图标。
              </>
            )}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="run-btn is-ghost"
              onClick={() => setPhase({ kind: "idle" })}
            >
              取消
            </button>
            <button
              type="button"
              className={phase.action === "restart" ? "run-btn is-open" : "run-btn is-stop"}
              onClick={() => (phase.action === "restart" ? onRestart() : onShutdown())}
            >
              确认{phase.action === "restart" ? "重启" : "关闭"}
            </button>
          </div>
        </Modal>
      )}

      {phase.kind === "restarting" && (
        <Modal>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Spinner />
            <div>
              <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--ink-2)" }}>
                正在重启
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--ink-0)", marginTop: 4 }}>
                服务即将就绪
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 6 }}>
                就绪后页面会自动刷新
              </div>
            </div>
          </div>
        </Modal>
      )}

      {phase.kind === "shutdown-done" && (
        <Modal>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--ink-2)", marginBottom: 8 }}>
            已关闭
          </div>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>服务已断开</h3>
          <p style={{ margin: "10px 0 6px", fontSize: 13, color: "var(--ink-1)", lineHeight: 1.6 }}>
            要重新使用，请双击桌面{" "}
            <span className="mono" style={{ color: "var(--ink-0)" }}>
              Code Dashboard
            </span>{" "}
            图标。
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "var(--ink-3)" }}>这个标签页可以关闭了。</p>
        </Modal>
      )}

      {phase.kind === "error" && (
        <Modal>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--c-err)", marginBottom: 8 }}>
            错误
          </div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>没能完成</h3>
          <p style={{ margin: "10px 0 18px", fontSize: 13, color: "var(--ink-1)", lineHeight: 1.6 }}>
            {phase.message}
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="run-btn is-ghost"
              onClick={() => setPhase({ kind: "idle" })}
            >
              知道了
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-modal-back">
      <div className="admin-modal">{children}</div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        border: "2px solid var(--line-2)",
        borderTopColor: "var(--c-accent)",
        animation: "spin 0.9s linear infinite",
        display: "inline-block",
      }}
    />
  );
}

async function pollUntilRestarted(previousStartedAt: string | null): Promise<boolean> {
  const deadline = Date.now() + 30_000;
  let sawOldServerGoAway = false;
  await sleep(500);
  while (Date.now() < deadline) {
    try {
      const r = await fetch("/api/projects", { cache: "no-store" });
      if (r.ok) {
        const body = (await r.json().catch(() => null)) as { serverStartedAt?: string } | null;
        if (previousStartedAt && body?.serverStartedAt && body.serverStartedAt !== previousStartedAt) {
          return true;
        }
        if (!previousStartedAt && sawOldServerGoAway) return true;
      }
    } catch {
      sawOldServerGoAway = true;
    }
    await sleep(500);
  }
  return false;
}

async function getServerStartedAt(): Promise<string | null> {
  try {
    const r = await fetch("/api/projects", { cache: "no-store" });
    if (!r.ok) return null;
    const body = (await r.json()) as { serverStartedAt?: string };
    return body.serverStartedAt ?? null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

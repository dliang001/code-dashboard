import { useEffect, useState } from "react";
import { useStartProject, useStopProject } from "../hooks/useRunner";
import type { RunState, RunningInfo } from "../types";

interface Props {
  projectId: string;
  hasCommand: boolean;
  runState: RunState;
  running: RunningInfo | null;
  /** When provided, renders a "查看日志" button that calls into App-level logs panel. */
  onOpenLogs?: () => void;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function RunControls({ projectId, hasCommand, runState, running, onOpenLogs }: Props) {
  const start = useStartProject(projectId);
  const stop = useStopProject(projectId);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const busy = start.isPending || stop.isPending;
  const isManaged = running != null && running.state !== "exited";
  const isExternal = runState === "running-external";
  const startData = start.data;
  const portChanged =
    startData?.portChanged && startData.desiredPort != null && startData.allocatedPort != null;
  const primaryUrl = running?.urls?.[0] ?? null;
  const lastError =
    (start.error as Error | undefined)?.message ?? (stop.error as Error | undefined)?.message ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="sc-actions" style={{ paddingTop: 0, borderTop: 0 }}>
        {!isManaged && (
          <button
            type="button"
            className="run-btn is-start"
            disabled={!hasCommand || busy}
            onClick={() => start.mutate()}
            title={!hasCommand ? "未配置启动命令" : isExternal ? "端口已被外部进程占用，启动会自动换端口" : "启动"}
          >
            <svg viewBox="0 0 14 14" width="9" height="9" aria-hidden>
              <polygon points="3,2 12,7 3,12" fill="currentColor" />
            </svg>
            启动
          </button>
        )}
        {isManaged && (
          <button
            type="button"
            className="run-btn is-stop"
            disabled={busy}
            onClick={() => stop.mutate()}
          >
            <svg viewBox="0 0 14 14" width="9" height="9" aria-hidden>
              <rect x="3" y="3" width="8" height="8" fill="currentColor" />
            </svg>
            停止
          </button>
        )}
        {isManaged && primaryUrl && (
          <a
            className="run-btn is-open"
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={primaryUrl}
          >
            打开 ↗
          </a>
        )}
        {onOpenLogs && (
          <button type="button" className="run-btn is-ghost" onClick={onOpenLogs}>
            查看日志
          </button>
        )}
        {isManaged && running && (
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)", alignSelf: "center" }}>
            PID {running.pid} · {formatUptime(now - running.startedAt)}
          </span>
        )}
      </div>
      {portChanged && (
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--c-warn)",
            borderLeft: "2px solid var(--c-warn)",
            paddingLeft: 10,
          }}
        >
          原端口 {startData!.desiredPort} 被占，已自动换到{" "}
          <strong>{startData!.allocatedPort}</strong>
        </div>
      )}
      {isExternal && !isManaged && (
        <div style={{ fontSize: 11, color: "var(--ink-2)" }}>
          端口已被外部进程占用 —— 启动会自动换到其他端口（PORT env）
        </div>
      )}
      {lastError && (
        <div
          style={{
            fontSize: 12,
            color: "var(--c-err)",
            borderLeft: "2px solid var(--c-err)",
            paddingLeft: 10,
          }}
        >
          {lastError}
        </div>
      )}
    </div>
  );
}

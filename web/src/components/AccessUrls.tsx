import type { RunState } from "../types";

interface Props {
  urls: string[];
  port: number | null;
  runState: RunState;
  desiredPort?: number | null;
  allocatedPort?: number | null;
}

/**
 * Access URL panel. Source priority:
 *   1. URLs extracted from log output of a process WE manage (verified).
 *   2. http://localhost:<port> derived from the configured port — used for
 *      external runs and as a placeholder before logs print a URL.
 *   3. A grey "stopped" hint when we have a port but nothing is running.
 *   4. A gentle italic note when there's nothing actionable.
 */
export function AccessUrls({
  urls,
  port,
  runState,
  desiredPort,
  allocatedPort,
}: Props) {
  const portMismatch =
    desiredPort != null && allocatedPort != null && desiredPort !== allocatedPort;
  const isRunning =
    runState === "running" || runState === "running-external" || runState === "starting";

  const predicted = port != null ? `http://localhost:${port}` : null;
  const showPredicted = predicted != null && !urls.some((u) => u.startsWith(predicted));

  return (
    <div>
      {portMismatch && (
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--c-warn)",
            borderLeft: "2px solid var(--c-warn)",
            paddingLeft: 10,
            marginBottom: 10,
          }}
        >
          原端口 {desiredPort} 被占，已自动换到 <strong>{allocatedPort}</strong>{" "}
          (PORT env)
        </div>
      )}

      {urls.length > 0 && (
        <div className="url-list">
          {urls.map((u) => (
            <UrlRow key={u} url={u} verified />
          ))}
        </div>
      )}

      {showPredicted && isRunning && (
        <div className="url-list">
          <UrlRow url={predicted!} note="基于配置端口" />
        </div>
      )}

      {showPredicted && !isRunning && (
        <div className="panel-hint">
          未运行 · 启动后可访问 <span className="mono">{predicted}</span>
        </div>
      )}

      {urls.length === 0 && predicted == null && (
        <div className="muted-italic">
          没有探测到端口。运行后如打印 <span className="mono">http://localhost:NNNN</span>{" "}
          会自动列出。
        </div>
      )}
    </div>
  );
}

function UrlRow({
  url,
  verified,
  note,
}: {
  url: string;
  verified?: boolean;
  note?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="url-item mono"
      style={{ display: "flex", alignItems: "center", gap: 8 }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: verified ? "var(--c-ok)" : "transparent",
          border: verified ? "none" : "1px solid var(--ink-3)",
          boxShadow: verified ? "0 0 6px var(--c-ok)" : "none",
          flex: "0 0 auto",
        }}
      />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{url}</span>
      {note && <span style={{ fontSize: 10, color: "var(--ink-2)" }}>{note}</span>}
    </a>
  );
}

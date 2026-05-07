import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import type { LogLine, RunningInfo } from "../types";

type Level = "all" | "info" | "warn" | "error";

interface Props {
  projectId: string;
  /** Render as the right-side floating devtools panel (with close button). */
  floating?: boolean;
  /** Required when floating — closes the panel. */
  onClose?: () => void;
}

const MAX_RENDERED = 800;

/**
 * Devtools-style live log stream. Subscribes to /ws/projects/:id/logs,
 * replays the buffer, then tails. Filter input narrows by substring;
 * level chips narrow by stream (stdout=info, stderr=warn).
 *
 * In floating mode the panel anchors to the top-right and overlays the page;
 * embedded mode is fixed-height inside a tab body.
 */
export function LogsConsole({ projectId, floating = false, onClose }: Props) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const [level, setLevel] = useState<Level>("all");
  const wsRef = useRef<WebSocket | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    setLines([]);
    const ws = api.openLogStream(projectId);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };
    ws.onerror = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as
          | { type: "log"; line: LogLine }
          | { type: "state"; info: RunningInfo }
          | { type: "url"; url: string };
        if (msg.type === "log") {
          if (pausedRef.current) return;
          setLines((prev) => {
            const next = [...prev, msg.line];
            return next.length > MAX_RENDERED ? next.slice(-MAX_RENDERED) : next;
          });
        } else if (msg.type === "state" || msg.type === "url") {
          qc.invalidateQueries({ queryKey: ["projects", projectId] });
        }
      } catch {
        /* malformed frame — ignore */
      }
    };
    return () => {
      ws.close();
    };
  }, [projectId, qc]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return lines.filter((l) => {
      // stdout → info; stderr → warn (we don't have a real level field).
      const lvl: Level = l.stream === "stderr" ? "warn" : "info";
      if (level !== "all" && level !== lvl) return false;
      if (q && !l.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lines, filter, level]);

  useEffect(() => {
    if (paused) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered.length, paused]);

  const wrapperCls = floating ? "logs-console is-floating" : "logs-console is-embedded";

  return (
    <div className={wrapperCls}>
      <div className="logs-head">
        <div className="logs-title mono">
          <span className={`logs-dot ${connected ? "" : "is-off"}`} aria-hidden />
          LOGS · {projectId}
        </div>
        <input
          className="logs-filter mono"
          placeholder="filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="logs-levels">
          {(["all", "info", "warn", "error"] as const).map((lvl) => (
            <button
              key={lvl}
              className={`logs-level mono ${level === lvl ? "is-active" : ""}`}
              onClick={() => setLevel(lvl)}
            >
              {lvl}
            </button>
          ))}
        </div>
        <div className="logs-spacer" />
        <button
          className="logs-icon mono"
          title={paused ? "继续" : "暂停"}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶" : "⏸"}
        </button>
        <button className="logs-icon mono" title="清空" onClick={() => setLines([])}>
          ⌫
        </button>
        {floating && (
          <button className="logs-icon mono" onClick={onClose} title="关闭">
            ×
          </button>
        )}
      </div>
      <div className="logs-body" ref={scrollerRef}>
        {filtered.length === 0 ? (
          <div className="log-line">
            <span className="log-t mono">—</span>
            <span className="log-lvl mono is-info">···</span>
            <span className="log-line-body mono">
              {lines.length === 0 ? "等待输出 ..." : "（无匹配）"}
            </span>
          </div>
        ) : (
          filtered.map((l) => {
            const lvl: Exclude<Level, "all"> = l.stream === "stderr" ? "warn" : "info";
            const t = formatLogTime(l.ts);
            return (
              <div key={l.seq} className={`log-line is-${lvl}`}>
                <span className="log-t mono">{t}</span>
                <span className={`log-lvl mono is-${lvl}`}>{lvl.toUpperCase()}</span>
                <span className="log-line-body mono">{l.text}</span>
              </div>
            );
          })
        )}
        {connected && !paused && (
          <div className="log-line">
            <span className="log-t mono">—</span>
            <span className="log-lvl mono is-info">···</span>
            <span className="log-line-body mono">
              <span className="log-cursor">▌</span>
            </span>
          </div>
        )}
      </div>
      <div className="logs-foot mono">
        {filtered.length} / {lines.length} 行 · ring buffer 2000
      </div>
    </div>
  );
}

function formatLogTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

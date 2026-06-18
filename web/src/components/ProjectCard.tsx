import { useNavigate } from "react-router-dom";
import type { Project, RunningInfo, RunState } from "../types";
import { StatusDot, StatusBadge } from "./StatusBadge";
import { IconBtn, IconPlay, IconStop, IconPlayHollow, IconCode, IconFolder } from "./IconBtn";
import { useStartProject, useStopProject, useStartTree } from "../hooks/useRunner";
import * as api from "../api";
import { useMutation } from "@tanstack/react-query";
import { formatRelative, projectKindGlyph, projectKindLabel } from "../lib/format";

interface Props {
  project: Project;
  runState: RunState;
  running?: RunningInfo | null;
  childCount?: number;
  conflictPeerIds?: string[];
}

/**
 * One row in the main project list. Seven columns:
 *   rail · identity · stack/tags · port · status · time/branch · actions
 */
export function ProjectRow({
  project,
  runState,
  running = null,
  childCount = 0,
  conflictPeerIds = [],
}: Props) {
  const nav = useNavigate();
  const start = useStartProject(project.id);
  const stop = useStopProject(project.id);
  const startTree = useStartTree(project.id);
  const openVS = useMutation({ mutationFn: () => api.openVSCode(project.id) });
  const openFolder = useMutation({ mutationFn: () => api.openFolder(project.id) });

  const port = project.port ?? project.portDetected;
  const inConflict = conflictPeerIds.length > 0;
  const isRunning =
    runState === "running" || runState === "running-external" || runState === "starting";
  const accessUrl = pickAccessUrl(running, port, runState);
  const isManaged = running != null && running.state !== "exited";
  const hasCommand = !!(project.startCommand || project.startCommandDetected);
  // A pure parent container (no own command, but has runnable subprojects):
  // the row's run button launches the whole subtree via start-tree.
  const isContainer = !hasCommand && childCount > 0;
  const detailHref = `/project/${encodeURIComponent(project.id)}`;
  const cls = [
    "row",
    project.archived ? "is-archived" : "",
    inConflict ? "is-conflict" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={cls}
      role="button"
      tabIndex={0}
      onClick={() => nav(detailHref)}
      onKeyDown={(e) => {
        if (e.key === "Enter") nav(detailHref);
      }}
    >
      <div className="row-rail">
        <StatusDot state={runState} size={12} />
      </div>

      <div className="row-id">
        <div className="row-name-line">
          <span className="row-kind mono" title={projectKindLabel(project.kind)}>
            {projectKindGlyph(project.kind)}
          </span>
          <span className="row-name">{project.name}</span>
          {childCount > 0 && (
            <span className="row-children-pill mono">+{childCount}</span>
          )}
        </div>
        <div className="row-desc">
          {project.description ?? project.descriptionAuto ?? (
            <span className="muted-italic">— 无描述</span>
          )}
        </div>
      </div>

      <div className="row-meta">
        <div className="meta-line">
          <span className="meta-kind mono">{projectKindLabel(project.kind)}</span>
          {project.frameworks.slice(0, 2).map((f) => (
            <span key={f} className="meta-fw mono">{f}</span>
          ))}
        </div>
        {project.tags.length > 0 && (
          <div className="meta-tags">
            {project.tags.map((t) => (
              <span key={t} className="tag mono">#{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="row-port">
        {port != null ? (
          <>
            <div className={`port-num mono ${inConflict ? "is-conflict" : ""}`}>:{port}</div>
            {accessUrl ? (
              <a
                href={accessUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="port-link mono"
              >
                localhost ↗
              </a>
            ) : (
              <div className="port-link mono is-dim">localhost</div>
            )}
            {inConflict && (
              <div
                className="conflict-flag mono"
                title={`冲突: ${conflictPeerIds.join(", ")}`}
              >
                ⚠ ×{conflictPeerIds.length + 1}
              </div>
            )}
          </>
        ) : (
          <div className="port-link mono is-dim">—</div>
        )}
      </div>

      <div className="row-status">
        <StatusBadge state={runState} />
        {isManaged && running && running.state === "running" && (
          <>
            <div className="row-uptime mono">PID {running.pid}</div>
          </>
        )}
      </div>

      <div className="row-time mono">
        {formatRelative(project.lastModified)}
        {project.gitBranch && <div className="row-branch mono">⎇ {project.gitBranch}</div>}
      </div>

      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        {hasCommand ? (
          isManaged ? (
            <IconBtn
              title="停止"
              danger
              onClick={() => stop.mutate()}
              disabled={stop.isPending}
            >
              {IconStop}
            </IconBtn>
          ) : (
            <IconBtn
              title={isRunning ? "外部进程占用 — 启动将自动换端口" : "启动"}
              accent
              onClick={() => start.mutate()}
              disabled={start.isPending}
            >
              {IconPlay}
            </IconBtn>
          )
        ) : isContainer ? (
          <IconBtn
            title={`启动 ${childCount} 个子项目`}
            accent
            onClick={() => startTree.mutate()}
            disabled={startTree.isPending}
          >
            {IconPlay}
          </IconBtn>
        ) : (
          <IconBtn title="未配置启动命令" disabled>
            {IconPlayHollow}
          </IconBtn>
        )}
        <IconBtn title="VS Code 打开" onClick={() => openVS.mutate()}>
          {IconCode}
        </IconBtn>
        <IconBtn title="资源管理器" onClick={() => openFolder.mutate()}>
          {IconFolder}
        </IconBtn>
      </div>
    </div>
  );
}

// Back-compat alias — the old name is still imported by tests and a few callers.
export const ProjectCard = ProjectRow;

/** Verified-from-logs URL when we have one; fall back to localhost:<port> when running. */
function pickAccessUrl(
  running: RunningInfo | null,
  port: number | null | undefined,
  runState: RunState,
): string | null {
  const urls = running?.urls ?? [];
  if (urls.length > 0) return urls[0]!;
  const isRunning =
    runState === "running" || runState === "running-external" || runState === "starting";
  if (isRunning && port != null) return `http://localhost:${port}`;
  return null;
}

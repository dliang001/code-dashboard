import { useState } from "react";
import { Link } from "react-router-dom";
import type { Project, RunState } from "../types";
import { StatusBadge } from "./StatusBadge";
import { formatPort, formatRelative, projectEmoji } from "../lib/format";

interface Props {
  project: Project;
  runState: RunState;
  /** When project is a parent, list of its children (already filtered). Empty for leaves. */
  children?: Project[];
  /** runStates keyed by id, for child cards' badges */
  childRunStates?: Record<string, RunState>;
  /** True if this project's port is shared with another project */
  isInConflict?: boolean;
  /** ids of other projects sharing the same port */
  conflictPeerIds?: string[];
}

export function ProjectCard({
  project,
  runState,
  children = [],
  childRunStates = {},
  isInConflict = false,
  conflictPeerIds = [],
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const description = project.description ?? project.descriptionAuto ?? "";
  const dim = project.archived ? "opacity-60" : "";
  const detailHref = `/project/${encodeURIComponent(project.id)}`;
  const port = project.port ?? project.portDetected;
  const hasChildren = children.length > 0;
  const conflictBorder = isInConflict ? "border-red-300 ring-1 ring-red-200" : "border-gray-200";

  return (
    <div className={`bg-white border ${conflictBorder} rounded-lg overflow-hidden ${dim}`}>
      <div className="p-3.5">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <Link to={detailHref} className="flex items-center gap-2 min-w-0 flex-1 hover:underline">
            <span className="text-base flex-shrink-0">{projectEmoji(project.kind)}</span>
            <span className="font-medium text-sm truncate">{project.name}</span>
          </Link>
          <StatusBadge state={runState} />
        </div>

        <p className="text-xs text-gray-600 leading-snug line-clamp-2 min-h-[2.25rem]">
          {description || <span className="italic text-gray-400">无描述</span>}
        </p>

        {(project.frameworks.length > 0 || project.tags.length > 0) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {project.frameworks.map((f) => (
              <span key={`fw-${f}`} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">{f}</span>
            ))}
            {project.tags.map((t) => (
              <span key={`tag-${t}`} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{t}</span>
            ))}
          </div>
        )}

        {isInConflict && conflictPeerIds.length > 0 && (
          <div className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            ⚠ 端口 :{port} 与 {conflictPeerIds.join("、")} 冲突
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
          <span className={isInConflict ? "text-red-700 font-medium" : ""}>{formatPort(port)}</span>
          <span>{formatRelative(project.lastModified)}</span>
        </div>

        {hasChildren && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 w-full text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200 rounded py-1 transition"
            aria-expanded={expanded}
          >
            {expanded ? "▴ 收起" : "▾"} {children.length} 个子项目
          </button>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="border-t border-gray-200 bg-gray-50 px-3 py-3">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {children.map((c) => (
              <ChildCard
                key={c.id}
                project={c}
                runState={childRunStates[c.id] ?? "idle"}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChildCard({ project, runState }: { project: Project; runState: RunState }) {
  const description = project.description ?? project.descriptionAuto ?? "";
  const port = project.port ?? project.portDetected;
  const detailHref = `/project/${encodeURIComponent(project.id)}`;
  return (
    <Link to={detailHref} className="block bg-white border border-gray-200 rounded p-2 hover:border-gray-300 hover:shadow-sm transition">
      <div className="flex items-center justify-between mb-1 gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs">{projectEmoji(project.kind)}</span>
          <span className="font-medium text-xs truncate">{project.name}</span>
        </div>
        <StatusBadge state={runState} />
      </div>
      {description && (
        <p className="text-[11px] text-gray-600 line-clamp-1">{description}</p>
      )}
      <div className="text-[10px] text-gray-500 mt-0.5">{formatPort(port)}</div>
    </Link>
  );
}

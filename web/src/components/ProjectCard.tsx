import { Link } from "react-router-dom";
import type { Project } from "../types";
import { StatusBadge } from "./StatusBadge";
import { formatPort, formatRelative, projectEmoji } from "../lib/format";

interface Props {
  project: Project;
}

export function ProjectCard({ project }: Props) {
  const description = project.description ?? project.descriptionAuto ?? "";
  const dim = project.archived ? "opacity-60" : "";
  const detailHref = `/project/${encodeURIComponent(project.id)}`;
  const port = project.port ?? project.portDetected;

  return (
    <Link
      to={detailHref}
      className={`block bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm hover:border-gray-300 transition ${dim}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base flex-shrink-0">{projectEmoji(project.kind)}</span>
          <span className="font-medium text-sm truncate">{project.name}</span>
        </div>
        <StatusBadge state="unknown" />
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

      <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
        <span>{formatPort(port)}</span>
        <span>{formatRelative(project.lastModified)}</span>
      </div>
    </Link>
  );
}

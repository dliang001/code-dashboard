import type { PortConflict } from "../types";

interface Props {
  conflicts: PortConflict[];
}

export function ConflictBanner({ conflicts }: Props) {
  if (conflicts.length === 0) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="px-5 py-2 text-xs text-amber-900">
        <span className="font-medium">⚠ {conflicts.length} 处端口冲突：</span>
        <span className="ml-2">
          {conflicts.slice(0, 3).map((c) => (
            <span key={c.port} className="mr-3">
              :{c.port} (× {c.projectIds.length})
            </span>
          ))}
          {conflicts.length > 3 && <span className="text-amber-700">+{conflicts.length - 3} 更多</span>}
        </span>
      </div>
    </div>
  );
}

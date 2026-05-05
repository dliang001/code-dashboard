import type { RunState } from "../types";

interface Props {
  state: RunState | "unknown";
}

const LABELS: Record<RunState | "unknown", string> = {
  idle: "○ 已停止",
  starting: "○ 启动中…",
  running: "● 运行中",
  "running-external": "● 运行中（外）",
  stopping: "○ 停止中",
  error: "✕ 错误",
  unknown: "○ 未知",
};

const STYLES: Record<RunState | "unknown", string> = {
  running: "bg-green-100 text-green-700 border-green-200",
  "running-external": "bg-green-50 text-green-600 border-green-100",
  starting: "bg-yellow-50 text-yellow-700 border-yellow-200",
  stopping: "bg-yellow-50 text-yellow-700 border-yellow-200",
  error: "bg-red-100 text-red-700 border-red-200",
  idle: "bg-gray-100 text-gray-600 border-gray-200",
  unknown: "bg-gray-50 text-gray-500 border-gray-200",
};

export function StatusBadge({ state }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full border ${STYLES[state]}`}>
      {LABELS[state]}
    </span>
  );
}

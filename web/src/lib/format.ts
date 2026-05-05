import type { ProjectKind } from "../types";

export function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "刚刚";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  return `${Math.floor(months / 12)} 年前`;
}

export function formatPort(port: number | null): string {
  if (port == null) return "—";
  return `:${port}`;
}

export function projectEmoji(kind: ProjectKind): string {
  switch (kind) {
    case "node": return "🟢";
    case "python": return "🐍";
    case "docker": return "🐳";
    case "rust": return "🦀";
    case "go": return "🐹";
    case "self-runnable-parent":
    case "parent-container": return "📂";
    default: return "📦";
  }
}

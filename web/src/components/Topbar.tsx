import { Link } from "react-router-dom";
import { useRescan } from "../hooks/useProjects";

export function Topbar() {
  const rescan = useRescan();
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="px-5 py-3 flex items-center gap-3">
        <Link to="/" className="font-semibold text-base">
          📁 Code Projects Dashboard
        </Link>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => rescan.mutate()}
          disabled={rescan.isPending}
          className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          {rescan.isPending ? "扫描中…" : "⟳ 重新扫描"}
        </button>
      </div>
    </header>
  );
}

import { useProjects } from "../hooks/useProjects";
import { ProjectCard } from "../components/ProjectCard";
import { EmptyState } from "../components/EmptyState";

export default function Grid() {
  const { data, isLoading, error } = useProjects();

  if (isLoading) {
    return <main className="p-5"><p className="text-gray-500">加载中…</p></main>;
  }
  if (error) {
    return <main className="p-5"><p className="text-red-600">加载失败：{(error as Error).message}</p></main>;
  }
  const projects = data?.projects ?? [];
  if (projects.length === 0) {
    return <main className="p-5"><EmptyState title="还没有扫描到项目" body="点右上角『重新扫描』开始" /></main>;
  }

  return (
    <main className="p-5">
      <p className="text-sm text-gray-500 mb-3">{projects.length} 个项目</p>
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </main>
  );
}

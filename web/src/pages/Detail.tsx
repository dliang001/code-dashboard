import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useProject } from "../hooks/useProjects";
import { Section } from "../components/Section";
import { OpenButtons } from "../components/OpenButtons";
import { StatusBadge } from "../components/StatusBadge";
import { formatPort, formatRelative, projectEmoji } from "../lib/format";

type Tab = "overview" | "subprojects" | "readme";

export default function Detail() {
  const params = useParams<{ id: string; "*": string }>();
  const splat = params["*"] ?? "";
  const id = splat ? `${params.id}/${splat}` : (params.id ?? "");
  const { data, isLoading, error } = useProject(id);
  const [tab, setTab] = useState<Tab>("overview");

  if (isLoading) return <main className="p-5"><p className="text-gray-500">加载中…</p></main>;
  if (error) return <main className="p-5"><p className="text-red-600">加载失败：{(error as Error).message}</p></main>;
  if (!data) return <main className="p-5"><p className="text-gray-500">未找到项目</p></main>;

  const proj = data.project;
  const port = proj.port ?? proj.portDetected;
  const startCmd = proj.startCommand ?? proj.startCommandDetected;
  const description = proj.description ?? proj.descriptionAuto ?? "";

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
            <Link to="/" className="hover:text-gray-700">←返回</Link>
            <span>·</span>
            <span className="font-mono">{proj.absPath}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-2xl">{projectEmoji(proj.kind)}</span>
              <div className="min-w-0">
                <div className="font-semibold text-base truncate">{proj.name}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <StatusBadge state="unknown" />
                  <span>·</span>
                  <span>{proj.kind}</span>
                  {proj.children.length > 0 && (
                    <>
                      <span>·</span>
                      <span>{proj.children.length} 子项目</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <OpenButtons projectId={proj.id} />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 flex gap-1 text-sm">
          <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>概览</TabBtn>
          {proj.children.length > 0 && <TabBtn active={tab === "subprojects"} onClick={() => setTab("subprojects")}>子项目 {proj.children.length}</TabBtn>}
          <TabBtn active={tab === "readme"} onClick={() => setTab("readme")}>README</TabBtn>
        </div>
      </div>

      {/* Body */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3 p-5">
          {/* Left column */}
          <div className="space-y-3">
            <Section label="描述">
              <p className="text-sm text-gray-700 leading-relaxed">{description || <em className="text-gray-400">未填写描述</em>}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {proj.frameworks.map((f) => <Tag key={f}>{f}</Tag>)}
                {proj.tags.map((t) => <Tag key={t} variant="user">{t}</Tag>)}
              </div>
            </Section>
            <Section label="日志">
              <p className="text-xs text-gray-500 italic">实时日志将在 Plan 2 上线（启停子进程后捕获 stdout/stderr）。</p>
            </Section>
          </div>
          {/* Right column */}
          <div className="space-y-3">
            <Section label="启动命令">
              <code className="block bg-gray-50 px-2 py-1.5 rounded text-xs font-mono">{startCmd ?? "—"}</code>
            </Section>
            <Section label="运行状态">
              <p className="text-xs text-gray-500 italic">端口探测和 PID 跟踪在 Plan 2 上线。</p>
            </Section>
            <Section label="基本信息">
              <dl className="text-xs space-y-1.5 text-gray-600">
                <Row k="语言" v={proj.language ?? "—"} />
                <Row k="端口" v={formatPort(port)} />
                <Row k="Git 分支" v={proj.gitBranch ?? "—"} />
                <Row k="最近修改" v={formatRelative(proj.lastModified)} />
                <Row k="父项目" v={proj.parent ?? "—"} />
              </dl>
            </Section>
          </div>
        </div>
      )}

      {tab === "subprojects" && proj.children.length > 0 && (
        <div className="p-5">
          <Section label="子项目">
            <ul className="text-sm divide-y divide-gray-100">
              {proj.children.map((c) => (
                <li key={c} className="py-1.5">
                  <Link to={`/project/${encodeURIComponent(c)}`} className="text-blue-600 hover:underline">{c}</Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {tab === "readme" && (
        <div className="p-5">
          <Section label="README">
            {proj.descriptionAuto ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{proj.descriptionAuto}</p>
            ) : (
              <p className="text-sm italic text-gray-500">未检测到 README 第一段。完整 README 渲染留 Plan 2 polish。</p>
            )}
          </Section>
        </div>
      )}
    </>
  );
}

function TabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  const cls = active ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700";
  return (
    <button type="button" onClick={onClick} className={`px-3 py-2 border-b-2 ${cls}`}>{children}</button>
  );
}

function Tag({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "user" }) {
  const cls = variant === "user" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-700";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${cls}`}>{children}</span>;
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt>{k}</dt><dd className="font-mono text-gray-700">{v}</dd></div>;
}

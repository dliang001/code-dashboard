import { useParams, Link, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useProject, useProjects, usePatchProject } from "../hooks/useProjects";
import { useStartTree, useStopTree } from "../hooks/useRunner";
import { Section } from "../components/Section";
import { OpenButtons } from "../components/OpenButtons";
import { StatusDot, StatusBadge, statusMeta } from "../components/StatusBadge";
import { IconBtn, IconPlay, IconStop } from "../components/IconBtn";
import { EditableText } from "../components/EditableText";
import { TagInput } from "../components/TagInput";
import { LogsConsole } from "../components/LogsConsole";
import { RunControls } from "../components/RunControls";
import { AccessUrls } from "../components/AccessUrls";
import { useStartProject, useStopProject } from "../hooks/useRunner";
import { formatRelative, projectKindGlyph, projectKindLabel } from "../lib/format";
import { collectDescendants } from "../lib/filter";
import type { Project, RunningInfo, RunState } from "../types";

type Tab = "overview" | "subprojects" | "logs" | "readme";

interface Props {
  onOpenLogs?: (id: string) => void;
}

export default function Detail({ onOpenLogs }: Props) {
  const params = useParams<{ id: string; "*": string }>();
  const splat = params["*"] ?? "";
  const id = splat ? `${params.id}/${splat}` : params.id ?? "";
  const { data, isLoading, error } = useProject(id);
  const list = useProjects();
  const patch = usePatchProject(id);
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab: Tab =
    requestedTab === "subprojects" || requestedTab === "logs" || requestedTab === "readme"
      ? requestedTab
      : "overview";
  const [tab, setTab] = useState<Tab>(initialTab);

  if (isLoading) return <Shell><p style={{ color: "var(--ink-2)" }}>加载中…</p></Shell>;
  if (error) return <Shell><p style={{ color: "var(--c-err)" }}>加载失败：{(error as Error).message}</p></Shell>;
  if (!data) return <Shell><p style={{ color: "var(--ink-2)" }}>未找到项目</p></Shell>;

  const proj = data.project;
  const port = proj.port ?? proj.portDetected;
  const hasCommand =
    (proj.startCommand ?? proj.startCommandDetected ?? "").trim() !== "";
  const allProjects = list.data?.projects ?? [];
  const runStates = list.data?.runStates ?? {};
  const runningMap = list.data?.running ?? {};
  const childProjects = collectDescendants(allProjects, proj.id);
  const isParent = childProjects.length > 0;
  const isRunning =
    data.runState === "running" ||
    data.runState === "running-external" ||
    data.runState === "starting";
  const accessUrl = pickAccessUrl(data.running, port, data.runState);
  const isManaged = data.running != null && data.running.state !== "exited";

  return (
    <div className="detail">
      {/* Sticky breadcrumb / actions */}
      <div className="detail-bar">
        <Link to="/" className="back-btn mono">
          <span aria-hidden>←</span> 返回列表
        </Link>
        <div className="breadcrumb mono">
          <span className="bc-faint">{list.data?.scanRoot ?? ""}</span>
          <span className="bc-sep">/</span>
          <span>{proj.path}</span>
        </div>
        <div className="bar-spacer" />
        <OpenButtons projectId={proj.id} />
      </div>

      {/* Hero */}
      <div className="detail-hero">
        <div className="hero-left">
          <div className="hero-kind mono">
            <span className="hero-glyph" aria-hidden>{projectKindGlyph(proj.kind)}</span>
            <span>{projectKindLabel(proj.kind)}</span>
            {proj.language && <span className="hero-lang">· {proj.language}</span>}
            {proj.frameworks.map((f) => (
              <span key={f} className="hero-fw">· {f}</span>
            ))}
          </div>
          <h1 className="hero-name">{proj.name}</h1>
          <p className="hero-desc">
            {proj.description ?? proj.descriptionAuto ?? (
              <span className="muted-italic">无描述。点击编辑添加项目说明。</span>
            )}
          </p>
          <TagInput tags={proj.tags} onChange={(tags) => patch.mutate({ tags })} />
        </div>

        <div className="hero-right">
          <div className="status-card">
            <div className="sc-head mono">
              <StatusDot state={data.runState} size={12} />
              <span style={{ color: statusMeta(data.runState).dotVar }}>
                {statusMeta(data.runState).label}
              </span>
            </div>
            <div className="sc-grid">
              <SCCell label="PORT" value={port != null ? `:${port}` : "—"} />
              <SCCell label="PID" value={data.running?.pid ?? "—"} />
              <SCCell
                label="UPTIME"
                value={data.running ? formatUptime(Date.now() - data.running.startedAt) : "—"}
              />
              <SCCell label="⎇ BRANCH" value={proj.gitBranch ?? "—"} />
            </div>
            <StatusCardActions
              projectId={proj.id}
              hasCommand={hasCommand}
              isManaged={isManaged}
              accessUrl={accessUrl}
              onOpenLogs={() => onOpenLogs?.(proj.id)}
            />
            {isParent && (
              <ParentTreeControls projectId={proj.id} childCount={childProjects.length} />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <TabBtn id="overview" tab={tab} setTab={setTab}>概览</TabBtn>
        {isParent && (
          <TabBtn id="subprojects" tab={tab} setTab={setTab}>
            子项目 <span className="mono" style={{ marginLeft: 6, color: "var(--ink-2)" }}>{childProjects.length}</span>
          </TabBtn>
        )}
        <TabBtn id="logs" tab={tab} setTab={setTab}>日志</TabBtn>
        <TabBtn id="readme" tab={tab} setTab={setTab}>README</TabBtn>
      </div>

      {/* Tab body */}
      <div className="tab-body">
        {tab === "overview" && (
          <OverviewTab
            proj={proj}
            data={data}
            port={port}
            isRunning={isRunning}
            hasCommand={hasCommand}
            onPatchDescription={(v) =>
              patch.mutate({ description: v.trim() === "" ? null : v })
            }
            onPatchStartCommand={(v) =>
              patch.mutate({ startCommand: v.trim() === "" ? null : v })
            }
            onPatchPort={(v) => patch.mutate({ port: v })}
            onPatchArchived={(b) => patch.mutate({ archived: b })}
            onOpenLogs={() => onOpenLogs?.(proj.id)}
          />
        )}
        {tab === "subprojects" && (
          <SubprojectsTab
            rootId={proj.id}
            children={childProjects}
            runStates={runStates}
            runningMap={runningMap}
          />
        )}
        {tab === "logs" && <LogsConsole projectId={proj.id} />}
        {tab === "readme" && (
          <div className="readme-body">
            {proj.descriptionAuto ? (
              <pre className="readme-pre">{proj.descriptionAuto}</pre>
            ) : (
              <p className="muted-italic">未检测到 README 第一段。完整 README 渲染留给后续。</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="detail">{children}</div>;
}

function relPathFrom(rootId: string, childId: string): string {
  const prefix = `${rootId}/`;
  return childId.startsWith(prefix) ? childId.slice(prefix.length) : childId;
}

function TabBtn({
  id,
  tab,
  setTab,
  children,
}: {
  id: Tab;
  tab: Tab;
  setTab: (t: Tab) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`tab-btn ${tab === id ? "is-active" : ""}`}
      onClick={() => setTab(id)}
    >
      {children}
    </button>
  );
}

function SCCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="sc-cell-label mono">{label}</div>
      <div className="sc-cell-value mono">{value}</div>
    </div>
  );
}

interface OverviewProps {
  proj: Project;
  data: { runState: RunState; running: RunningInfo | null; conflictPeers: string[] };
  port: number | null;
  isRunning: boolean;
  hasCommand: boolean;
  onPatchDescription: (v: string) => void;
  onPatchStartCommand: (v: string) => void;
  onPatchPort: (v: number | null) => void;
  onPatchArchived: (b: boolean) => void;
  onOpenLogs: () => void;
}

function OverviewTab({
  proj,
  data,
  port,
  hasCommand,
  onPatchDescription,
  onPatchStartCommand,
  onPatchPort,
  onPatchArchived,
  onOpenLogs,
}: OverviewProps) {
  return (
    <div className="overview-grid">
      <Section label="启动命令">
        <EditableText
          value={proj.startCommand ?? proj.startCommandDetected ?? ""}
          placeholder="未配置启动命令"
          multiline={false}
          onSave={onPatchStartCommand}
        />
        {proj.startCommandDetected && (
          <div className="panel-hint mono">检测到: {proj.startCommandDetected}</div>
        )}
      </Section>

      <Section label="访问地址">
        <AccessUrls
          urls={data.running?.urls ?? []}
          port={port}
          runState={data.runState}
          desiredPort={data.running?.desiredPort ?? null}
          allocatedPort={data.running?.allocatedPort ?? null}
          detectedUrls={proj.detectedUrls ?? []}
        />
      </Section>

      <Section label="默认端口">
        <PortEditor
          configuredPort={proj.port}
          detectedPort={proj.portDetected}
          effectivePort={port}
          conflictPeers={data.conflictPeers}
          onSave={onPatchPort}
        />
      </Section>

      <Section label="运行控制">
        <RunControls
          projectId={proj.id}
          hasCommand={hasCommand}
          runState={data.runState}
          running={data.running}
          onOpenLogs={onOpenLogs}
        />
      </Section>

      <Section label="基本信息">
        <dl className="kv-grid">
          <KV k="路径" v={proj.absPath} />
          <KV k="语言" v={proj.language ?? "—"} />
          <KV k="框架" v={proj.frameworks.join(", ") || "—"} />
          <KV k="Git 分支" v={proj.gitBranch ?? "—"} />
          <KV k="最近修改" v={formatRelative(proj.lastModified)} mono={false} />
          <KV k="父项目" v={proj.parent ?? "—"} />
        </dl>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 14,
            fontSize: 12,
            color: "var(--ink-1)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={proj.archived}
            onChange={(e) => onPatchArchived(e.target.checked)}
            style={{ accentColor: "var(--c-accent)" }}
          />
          归档此项目（默认隐藏在主列表）
        </label>
      </Section>

      <Section label="描述" className="overview-full">
        <EditableText
          value={proj.description ?? proj.descriptionAuto ?? ""}
          placeholder="点击编辑补充描述"
          onSave={onPatchDescription}
        />
      </Section>

      {data.conflictPeers.length > 0 && (
        <Section label="端口冲突" tone="warn">
          <div className="conflict-headline mono">
            ⚠ 端口 :{port} 被以下项目共用
          </div>
          <ul className="conflict-list mono">
            {data.conflictPeers.map((cid) => (
              <li key={cid}>· {cid}</li>
            ))}
          </ul>
          <div className="panel-hint">
            同时启动会让其中一个失败。建议改端口或归档其中一个。
          </div>
        </Section>
      )}
    </div>
  );
}

function KV({ k, v, mono = true }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="kv">
      <dt>{k}</dt>
      <dd className={mono ? "mono" : ""}>{v}</dd>
    </div>
  );
}

function PortEditor({
  configuredPort,
  detectedPort,
  effectivePort,
  conflictPeers,
  onSave,
}: {
  configuredPort: number | null;
  detectedPort: number | null;
  effectivePort: number | null;
  conflictPeers: string[];
  onSave: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(
    String(configuredPort ?? effectivePort ?? ""),
  );
  const hasOverride = configuredPort != null;
  const parsed = Number(draft.trim());
  const invalid = draft.trim() !== "" && (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535);

  if (!editing) {
    return (
      <div className="port-editor">
        <div className="port-editor-main mono">
          {effectivePort != null ? `:${effectivePort}` : "—"}
        </div>
        <div className="panel-hint">
          {hasOverride
            ? `用户指定端口。自动检测值: ${detectedPort != null ? `:${detectedPort}` : "无"}`
            : detectedPort != null
              ? "使用自动检测端口。"
              : "未检测到端口。可以手动指定启动端口。"}
        </div>
        {conflictPeers.length > 0 && (
          <div className="panel-hint" style={{ color: "var(--c-warn)" }}>
            当前端口与 {conflictPeers.length} 个项目冲突，建议改为未占用端口。
          </div>
        )}
        <div className="sc-actions" style={{ paddingTop: 10, borderTop: 0 }}>
          <button
            type="button"
            className="run-btn is-ghost"
            onClick={() => {
              setDraft(String(configuredPort ?? effectivePort ?? ""));
              setEditing(true);
            }}
          >
            修改端口
          </button>
          {hasOverride && (
            <button type="button" className="run-btn is-ghost" onClick={() => onSave(null)}>
              恢复自动检测
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="port-editor">
      <input
        className="editable-input mono"
        type="number"
        min={1}
        max={65535}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
        placeholder={detectedPort != null ? String(detectedPort) : "3000"}
      />
      <div className="panel-hint">
        这个值会作为项目的默认端口，用于访问地址、冲突检测和启动时的 PORT 环境变量。
      </div>
      {invalid && (
        <div className="panel-hint" style={{ color: "var(--c-err)" }}>
          请输入 1 到 65535 之间的整数。
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          className="run-btn is-open"
          disabled={invalid}
          onClick={() => {
            const text = draft.trim();
            onSave(text === "" ? null : Number(text));
            setEditing(false);
          }}
        >
          保存
        </button>
        <button type="button" className="run-btn is-ghost" onClick={() => setEditing(false)}>
          取消
        </button>
      </div>
    </div>
  );
}

function SubprojectsTab({
  rootId,
  children,
  runStates,
  runningMap,
}: {
  rootId: string;
  children: Project[];
  runStates: Record<string, RunState>;
  runningMap: Record<string, RunningInfo>;
}) {
  return (
    <div className="sub-list">
      <div className="sub-head mono">
        <div></div>
        <div>NAME · DESCRIPTION</div>
        <div>STACK</div>
        <div>PORT</div>
        <div>STATE</div>
        <div>RUN</div>
      </div>
      {children.map((c) => (
        <SubRow
          key={c.id}
          project={c}
          rootId={rootId}
          runState={runStates[c.id] ?? "idle"}
          running={runningMap[c.id] ?? null}
        />
      ))}
    </div>
  );
}

function SubRow({
  project,
  rootId,
  runState,
  running,
}: {
  project: Project;
  rootId: string;
  runState: RunState;
  running: RunningInfo | null;
}) {
  const port = project.port ?? project.portDetected;
  const isManaged = running != null && running.state !== "exited";
  const start = useStartProject(project.id);
  const stop = useStopProject(project.id);
  const hasCmd = !!(project.startCommand || project.startCommandDetected);
  const detail = `/project/${encodeURIComponent(project.id)}`;
  return (
    <Link
      to={detail}
      className="sub-row"
      style={{ display: "grid", textDecoration: "none" }}
    >
      <StatusDot state={runState} size={9} />
      <div>
        <div className="sub-name">
          {project.name}
          {project.id !== `${rootId}/${project.name}` && (
            <span className="sub-path mono"> · {relPathFrom(rootId, project.id)}</span>
          )}
        </div>
        <div className="sub-desc">
          {project.description ?? project.descriptionAuto ?? (
            <span className="muted-italic">—</span>
          )}
        </div>
      </div>
      <div className="mono sub-stack">
        {project.frameworks.join(" · ") || project.language || "—"}
      </div>
      <div className="mono">{port != null ? `:${port}` : "—"}</div>
      <div>
        <StatusBadge state={runState} />
      </div>
      <div className="sub-actions" onClick={(e) => e.stopPropagation()}>
        {!isManaged && hasCmd && (
          <IconBtn title="启动" accent onClick={() => start.mutate()}>
            {IconPlay}
          </IconBtn>
        )}
        {isManaged && (
          <IconBtn title="停止" danger onClick={() => stop.mutate()}>
            {IconStop}
          </IconBtn>
        )}
      </div>
    </Link>
  );
}

function ParentTreeControls({
  projectId,
  childCount,
}: {
  projectId: string;
  childCount: number;
}) {
  const startAll = useStartTree(projectId);
  const stopAll = useStopTree(projectId);
  const busy = startAll.isPending || stopAll.isPending;
  return (
    <div className="sc-tree">
      <div className="sc-tree-label mono">父项目操作</div>
      <div className="sc-tree-actions">
        <button
          className="run-btn is-start sm"
          disabled={busy}
          onClick={() => startAll.mutate()}
        >
          ▶ 全启 ({childCount})
        </button>
        <button
          className="run-btn is-stop sm"
          disabled={busy}
          onClick={() => stopAll.mutate()}
        >
          ■ 全停
        </button>
      </div>
    </div>
  );
}

/* ── helpers ───────────────────────────────────────────── */

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

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function StatusCardActions({
  projectId,
  hasCommand,
  isManaged,
  accessUrl,
  onOpenLogs,
}: {
  projectId: string;
  hasCommand: boolean;
  isManaged: boolean;
  accessUrl: string | null;
  onOpenLogs: () => void;
}) {
  const start = useStartProject(projectId);
  const stop = useStopProject(projectId);
  const busy = start.isPending || stop.isPending;
  return (
    <div className="sc-actions">
      {!isManaged && (
        <button
          className="run-btn is-start"
          disabled={!hasCommand || busy}
          onClick={() => start.mutate()}
        >
          <svg viewBox="0 0 14 14" width="9" height="9" aria-hidden>
            <polygon points="3,2 12,7 3,12" fill="currentColor" />
          </svg>
          启动
        </button>
      )}
      {isManaged && (
        <button className="run-btn is-stop" disabled={busy} onClick={() => stop.mutate()}>
          <svg viewBox="0 0 14 14" width="9" height="9" aria-hidden>
            <rect x="3" y="3" width="8" height="8" fill="currentColor" />
          </svg>
          停止
        </button>
      )}
      {accessUrl && (
        <a
          className="run-btn is-open"
          href={accessUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          打开 ↗
        </a>
      )}
      <button className="run-btn is-ghost" onClick={onOpenLogs}>
        查看日志
      </button>
    </div>
  );
}

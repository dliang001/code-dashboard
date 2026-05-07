import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProjects, useRescan } from "../hooks/useProjects";
import { SettingsPopover } from "./SettingsPopover";
import { AdminMenu } from "./AdminMenu";
import type { AppSettings } from "../hooks/useAppSettings";

interface Props {
  settings: AppSettings;
  setSetting: <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => void;
  onOpenLogs: (id?: string) => void;
}

interface Totals {
  all: number;
  running: number;
  conflicts: number;
  archived: number;
}

function clockNow(): string {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function Topbar({ settings, setSetting, onOpenLogs }: Props) {
  const rescan = useRescan();
  const list = useProjects();
  const [time, setTime] = useState(clockNow);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(clockNow()), 1000);
    return () => clearInterval(t);
  }, []);

  const totals = computeTotals(list.data);
  const scanRoot = list.data?.scanRoot ?? "";

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.25" />
                <circle cx="12" cy="12" r="3.2" fill="currentColor" />
                <line x1="12" y1="1.5" x2="12" y2="5.2" stroke="currentColor" strokeWidth="1.25" />
                <line x1="12" y1="18.8" x2="12" y2="22.5" stroke="currentColor" strokeWidth="1.25" />
                <line x1="1.5" y1="12" x2="5.2" y2="12" stroke="currentColor" strokeWidth="1.25" />
                <line x1="18.8" y1="12" x2="22.5" y2="12" stroke="currentColor" strokeWidth="1.25" />
              </svg>
            </span>
            <div className="brand-text">
              <div className="brand-title">项目驾驶舱</div>
              <div className="brand-sub mono">CODE.DASH · {scanRoot || "—"}</div>
            </div>
          </Link>
        </div>

        <div className="topbar-stats">
          <Stat label="项目"   value={totals.all} />
          <Stat label="运行中" value={totals.running}    accent={totals.running > 0 ? "ok" : "mute"} />
          <Stat label="冲突"   value={totals.conflicts}  accent={totals.conflicts > 0 ? "warn" : "mute"} />
          <Stat label="归档"   value={totals.archived} />
        </div>

        <div className="topbar-right">
          <span className="clock mono">{time}</span>
          <button className="ghost-btn" onClick={() => onOpenLogs()} title="日志面板">
            <span className="mono">LOGS</span>
          </button>
          <button
            className="ghost-btn"
            onClick={() => rescan.mutate()}
            disabled={rescan.isPending}
            title="重新扫描工作目录"
          >
            <span className="mono">{rescan.isPending ? "SCANNING" : "RESCAN"}</span>
          </button>
          <AdminMenu />
          <button
            className="ghost-btn"
            onClick={() => setTweaksOpen((v) => !v)}
            title="显示设置"
          >
            <span className="mono">TWEAKS</span>
          </button>
        </div>
      </header>

      {tweaksOpen && (
        <SettingsPopover
          settings={settings}
          setSetting={setSetting}
          onClose={() => setTweaksOpen(false)}
        />
      )}
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "ok" | "warn" | "mute";
}) {
  return (
    <div className={`stat ${accent ? `is-${accent}` : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value mono">{value}</div>
    </div>
  );
}

function computeTotals(data: ReturnType<typeof useProjects>["data"]): Totals {
  if (!data) return { all: 0, running: 0, conflicts: 0, archived: 0 };
  const tops = data.projects.filter((p) => p.parent === null);
  let running = 0;
  for (const p of data.projects) {
    const s = data.runStates[p.id];
    if (s === "running" || s === "running-external" || s === "starting") running++;
  }
  return {
    all: tops.length,
    running,
    conflicts: data.conflicts.length,
    archived: tops.filter((p) => p.archived).length,
  };
}

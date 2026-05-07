import { useEffect, useRef } from "react";
import type { AppSettings, Density, NavStyle, Theme } from "../hooks/useAppSettings";

interface Props {
  settings: AppSettings;
  setSetting: <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => void;
  onClose: () => void;
}

export function SettingsPopover({ settings, setSetting, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside-click. Defer the listener install one tick so the click
  // that opened the popover doesn't itself dismiss it.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const id = setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [onClose]);

  return (
    <div className="settings-pop" ref={ref}>
      <div className="settings-pop-head mono">
        <span>TWEAKS · 显示设置</span>
        <button className="settings-pop-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>
      <div className="settings-pop-body">
        <Segment<Theme>
          label="主题"
          value={settings.theme}
          onChange={(v) => setSetting("theme", v)}
          options={[["dark", "深色"], ["light", "浅色"]]}
        />
        <Segment<Density>
          label="信息密度"
          value={settings.density}
          onChange={(v) => setSetting("density", v)}
          options={[["compact", "紧凑"], ["cozy", "适中"], ["airy", "宽松"]]}
        />
        <Segment<NavStyle>
          label="导航位置"
          value={settings.navStyle}
          onChange={(v) => setSetting("navStyle", v)}
          options={[["topbar", "顶栏"], ["sidebar", "侧栏"]]}
        />
        <div className="sp-row">
          <span className="sp-label mono">网格背景</span>
          <button
            className="sp-toggle"
            onClick={() => setSetting("showGrid", !settings.showGrid)}
            aria-pressed={settings.showGrid}
          >
            <span>{settings.showGrid ? "已开启" : "已关闭"}</span>
            <span className={`sp-switch ${settings.showGrid ? "is-on" : ""}`} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function Segment<V extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: ReadonlyArray<readonly [V, string]>;
}) {
  return (
    <div className="sp-row">
      <span className="sp-label mono">{label}</span>
      <div className="sp-segmented">
        {options.map(([v, lbl]) => (
          <button
            key={v}
            className={`sp-seg ${value === v ? "is-active" : ""}`}
            onClick={() => onChange(v)}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";

export type Theme = "dark" | "light";
export type Density = "compact" | "cozy" | "airy";
export type NavStyle = "topbar" | "sidebar";

export interface AppSettings {
  theme: Theme;
  density: Density;
  navStyle: NavStyle;
  showGrid: boolean;
}

const KEY = "code-dash:settings";

const DEFAULTS: AppSettings = {
  theme: "dark",
  density: "cozy",
  navStyle: "topbar",
  showGrid: true,
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Persistent, document-attribute-driven app settings.
 * Theme/density/nav are surfaced as `data-*` on <html> so styles.css can
 * switch the entire palette without React having to re-render anything.
 */
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => load());

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", settings.theme);
    root.setAttribute("data-density", settings.density);
    root.setAttribute("data-nav", settings.navStyle);
    root.style.setProperty(
      "--grid-alpha",
      settings.showGrid ? (settings.theme === "dark" ? "0.05" : "0.06") : "0",
    );
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* localStorage may be unavailable in some sandboxes — ignore. */
    }
  }, [settings]);

  const set = useCallback(<K extends keyof AppSettings>(k: K, v: AppSettings[K]) => {
    setSettings((s) => ({ ...s, [k]: v }));
  }, []);

  return { settings, set };
}

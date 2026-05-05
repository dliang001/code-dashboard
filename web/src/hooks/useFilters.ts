import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";
import type { SortKey } from "../lib/filter";

export interface FilterUiState {
  search: string;
  language: string; // "all" | concrete
  showArchived: boolean;
  sort: SortKey;
  grouped: boolean;
}

const DEFAULTS: FilterUiState = {
  search: "",
  language: "all",
  showArchived: false,
  sort: "lastModified",
  grouped: false,
};

export function useFilters(): [FilterUiState, (patch: Partial<FilterUiState>) => void] {
  const [params, setParams] = useSearchParams();
  const state: FilterUiState = {
    search: params.get("q") ?? DEFAULTS.search,
    language: params.get("lang") ?? DEFAULTS.language,
    showArchived: params.get("archived") === "1",
    sort: ((params.get("sort") as SortKey | null) ?? DEFAULTS.sort),
    grouped: params.get("group") === "1",
  };

  const update = useCallback((patch: Partial<FilterUiState>) => {
    const next = new URLSearchParams(params);
    if (patch.search !== undefined) {
      patch.search ? next.set("q", patch.search) : next.delete("q");
    }
    if (patch.language !== undefined) {
      patch.language === "all" ? next.delete("lang") : next.set("lang", patch.language);
    }
    if (patch.showArchived !== undefined) {
      patch.showArchived ? next.set("archived", "1") : next.delete("archived");
    }
    if (patch.sort !== undefined) {
      patch.sort === DEFAULTS.sort ? next.delete("sort") : next.set("sort", patch.sort);
    }
    if (patch.grouped !== undefined) {
      patch.grouped ? next.set("group", "1") : next.delete("group");
    }
    setParams(next, { replace: true });
  }, [params, setParams]);

  return [state, update];
}

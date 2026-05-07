import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";
import type { SortKey } from "../lib/filter";

export type StatusFilter = "all" | "running" | "idle" | "error";

export interface FilterUiState {
  search: string;
  language: string;
  status: StatusFilter;
  showArchived: boolean;
  sort: SortKey;
}

const DEFAULTS: FilterUiState = {
  search: "",
  language: "all",
  status: "all",
  showArchived: false,
  sort: "lastModified",
};

export function useFilters(): [FilterUiState, (patch: Partial<FilterUiState>) => void] {
  const [params, setParams] = useSearchParams();
  const state: FilterUiState = {
    search: params.get("q") ?? DEFAULTS.search,
    language: params.get("lang") ?? DEFAULTS.language,
    status: ((params.get("st") as StatusFilter | null) ?? DEFAULTS.status),
    showArchived: params.get("archived") === "1",
    sort: ((params.get("sort") as SortKey | null) ?? DEFAULTS.sort),
  };

  const update = useCallback(
    (patch: Partial<FilterUiState>) => {
      const next = new URLSearchParams(params);
      if (patch.search !== undefined) {
        patch.search ? next.set("q", patch.search) : next.delete("q");
      }
      if (patch.language !== undefined) {
        patch.language === "all" ? next.delete("lang") : next.set("lang", patch.language);
      }
      if (patch.status !== undefined) {
        patch.status === "all" ? next.delete("st") : next.set("st", patch.status);
      }
      if (patch.showArchived !== undefined) {
        patch.showArchived ? next.set("archived", "1") : next.delete("archived");
      }
      if (patch.sort !== undefined) {
        patch.sort === DEFAULTS.sort ? next.delete("sort") : next.set("sort", patch.sort);
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  return [state, update];
}

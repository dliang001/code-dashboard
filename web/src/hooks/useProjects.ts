import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import type { PatchPayload } from "../types";

const KEY = "projects";

export function useProjects() {
  return useQuery({
    queryKey: [KEY],
    queryFn: api.listProjects,
    staleTime: 5_000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: [KEY, id],
    queryFn: () => api.getProject(id),
    staleTime: 5_000,
  });
}

export function usePatchProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PatchPayload) => api.patchProject(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useRescan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.rescan,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

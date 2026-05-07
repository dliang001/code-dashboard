import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api";

const KEY = "projects";

export function useStartProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.startProject(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useStopProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.stopProject(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useStartTree(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.startTree(id),
    onSettled: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useStopTree(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.stopTree(id),
    onSettled: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

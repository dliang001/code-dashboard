import { useMutation } from "@tanstack/react-query";
import * as api from "../api";

interface Props {
  projectId: string;
}

export function OpenButtons({ projectId }: Props) {
  const folderM = useMutation({ mutationFn: () => api.openFolder(projectId) });
  const codeM = useMutation({ mutationFn: () => api.openVSCode(projectId) });
  const termM = useMutation({ mutationFn: () => api.openTerminal(projectId) });

  return (
    <div className="flex gap-1.5 text-xs">
      <Btn onClick={() => folderM.mutate()} pending={folderM.isPending} error={folderM.error}>📂 打开目录</Btn>
      <Btn onClick={() => codeM.mutate()} pending={codeM.isPending} error={codeM.error}>💻 在 VSCode 打开</Btn>
      <Btn onClick={() => termM.mutate()} pending={termM.isPending} error={termM.error}>⌨ 新终端</Btn>
    </div>
  );
}

function Btn({ children, onClick, pending, error }: { children: React.ReactNode; onClick: () => void; pending: boolean; error: unknown }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`px-2.5 py-1 border rounded ${error ? "border-red-300 bg-red-50 text-red-700" : "border-gray-300 hover:bg-gray-50"} disabled:opacity-50`}
      title={error ? String(error) : undefined}
    >
      {children}
    </button>
  );
}

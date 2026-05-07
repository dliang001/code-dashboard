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
    <>
      <button
        type="button"
        className="ghost-btn"
        onClick={() => folderM.mutate()}
        disabled={folderM.isPending}
        title={folderM.error ? String(folderM.error) : "在资源管理器中打开"}
      >
        <span className="mono">EXPLORER</span>
      </button>
      <button
        type="button"
        className="ghost-btn"
        onClick={() => codeM.mutate()}
        disabled={codeM.isPending}
        title={codeM.error ? String(codeM.error) : "在 VS Code 中打开"}
      >
        <span className="mono">VS CODE</span>
      </button>
      <button
        type="button"
        className="ghost-btn"
        onClick={() => termM.mutate()}
        disabled={termM.isPending}
        title={termM.error ? String(termM.error) : "新终端"}
      >
        <span className="mono">TERMINAL</span>
      </button>
    </>
  );
}

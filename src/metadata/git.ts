import { simpleGit, CheckRepoActions } from "simple-git";

export interface GitInfo {
  branch: string | null;
  lastCommitISO: string | null;
}

export async function getGitInfo(dir: string): Promise<GitInfo> {
  try {
    const git = simpleGit(dir);
    // Treat a directory as a git repo only when it is itself the repo root.
    // Without this, projects nested inside a parent repo would inherit the
    // parent's branch/commit info — wrong for a per-project dashboard.
    const isRepoRoot = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
    if (!isRepoRoot) return { branch: null, lastCommitISO: null };
    const branchSummary = await git.branch();
    const log = await git.log({ maxCount: 1 });
    return {
      branch: branchSummary.current ?? null,
      lastCommitISO: log.latest?.date ?? null,
    };
  } catch {
    return { branch: null, lastCommitISO: null };
  }
}

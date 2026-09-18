// The verdict a Lab run acts on: is the Core it is about to load behind the
// Core commit this repository's own work was written against?
//
// Separated from the git reads so the decision is testable without a checkout,
// and because the message is the point. This one failure was misread three
// times, so it names the commit count, the branch, and the command that fixes
// it rather than saying "stale".

/**
 * @param {{ root: string, detached: boolean, behind: number, head: string | null, target: string }} core
 * @returns {{ stale: boolean, behind: number, message: string | null }}
 */
export function coreCommitStaleness(core) {
  // A Core on a branch is somebody's working checkout -- the main Core, or a
  // Core-paired task's own -- and where it sits is that task's business. Only
  // the detached Core that task worktrees share is nobody's, and it is the only
  // one that goes stale without anyone deciding to leave it behind.
  if (!core.detached || core.behind <= 0) return { stale: false, behind: 0, message: null };
  return {
    stale: true,
    behind: core.behind,
    message: `The FluxIQ Core this run would load, ${core.root}, is detached ${core.behind} commit(s) behind ${core.target} (at ${core.head?.slice(0, 7) ?? "an unknown commit"}). That Core is shared by every task worktree beside it and is not moved by anything but an explicit sync, so it still holds whatever commit it was given when the first of those worktrees was opened. This repository's \`dev\` moved forward with Core's, so the run would ask that older Core for behaviour it does not have -- which surfaces as a Core process exiting 1 and the run reporting "environment.missing", not as anything naming Core's commit. Bring it up with: pnpm task sync-core.`
  };
}

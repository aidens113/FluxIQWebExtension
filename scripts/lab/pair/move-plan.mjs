// What moving one side of the pair involves, decided from its state before
// anything changes.
//
// An install is needed when the lockfile at the target commit is not the one
// last installed there; a Core build when Core's packages were last built at a
// different commit, or are missing, or a rebuild was asked for. Both are read
// from markers the pair writes only after the step succeeded (`markers.mjs`),
// so a move interrupted halfway is completed by simply running it again.

/**
 * @param {{
 *   side: "ext" | "core", root: string, head: string, target: string, dirtyLines: string[],
 *   targetLock: string, installedLock: string | null,
 *   buildable: boolean, builtCommit: string | null, distPresent: boolean, forceBuild: boolean
 * }} state
 */
export function planSideMove(state) {
  const refusal = state.dirtyLines.length === 0
    ? null
    : `The ${state.side} worktree ${state.root} has ${state.dirtyLines.length} uncommitted or untracked change(s) (${state.dirtyLines.slice(0, 3).map((line) => line.trim()).join("; ")}). The pair is never edited: commit, stash or remove them first.`;
  return {
    side: state.side,
    root: state.root,
    from: state.head,
    to: state.target,
    targetLock: state.targetLock,
    refusal,
    checkout: state.target !== state.head,
    install: state.installedLock !== state.targetLock,
    build: state.buildable && (state.forceBuild || state.builtCommit !== state.target || !state.distPresent),
  };
}

// Whether the Core a task validates against contains Core's `dev`.
//
// `scripts/check/core-build.mjs` proves Core's build matches the Core source
// that is checked out; nothing proved that source was current. On 2026-10-07
// the shared Core beside the flat t352 worktree sat at `e0664f17` while Core's
// `dev` was at `1b9f15f7`, and the extension suite reported two false failures
// because that Core predated t350's wording change. The same staleness can as
// easily produce a false pass, and a task would then merge on it. So finish
// (and start, after it moves the shared Core) asks this question before any
// gate runs, and refuses with both commits and the command that fixes it.
//
// Which Core is asked about is the one the work tree's `domain/package.json`
// actually links (`core-sibling.mjs`), because that is what its build imports.
// Three shapes, three fixes:
//
// - the detached shared Core of flat worktrees: `pnpm task sync-core`, run in
//   that worktree;
// - a Core-paired task's own Core branch: merge Core's `dev` into that branch
//   there, because the paired side has to be validated against current Core
//   too, and its merge into Core's `dev` is Core's own business;
// - any other branch (the main Core beside the main checkout): bring that
//   checkout up to Core's `dev` by hand.
//
// Nothing is checked out or merged here: the answer is a refusal message, and
// acting on it is the person's or agent's decision.

import { gitAnsweredNo, resolveCoreSibling, runGit } from "../worktree/index.mjs";

/**
 * @param {{ workRoot: string, coreRepositoryRoot?: string, coreIntegrationBranch?: string }} input
 * @returns {Promise<null | { root: string, head: string, target: string, integrationBranch: string, branch: string | null, behind: number, refusal: string | null }>}
 *   null when there is no Core to ask about (none named, or none beside the work tree)
 */
export async function checkCoreCurrent({ workRoot, coreRepositoryRoot, coreIntegrationBranch = "dev" }) {
  if (!coreRepositoryRoot) return null;
  // Verified against the named Core repository: a Core beside the tree that
  // belongs to some other clone is refused there, with its own message.
  const sibling = await resolveCoreSibling(workRoot, { coreRepositoryRoot });
  if (!sibling.present) return null;

  const target = (await runGit(coreRepositoryRoot, ["rev-parse", "--verify", "--quiet", `${coreIntegrationBranch}^{commit}`]).catch((error) => {
    throw new Error(`Core (${coreRepositoryRoot}) has no ${JSON.stringify(coreIntegrationBranch)} to measure ${sibling.root} against.`, { cause: error });
  })).trim();
  const head = (await runGit(sibling.root, ["rev-parse", "--verify", "HEAD"])).trim();
  const branch = (await runGit(sibling.root, ["symbolic-ref", "--quiet", "--short", "HEAD"]).catch((error) => {
    // Exits non-zero exactly when HEAD is on no branch; git not running at all
    // is not that answer.
    if (gitAnsweredNo(error)) return "";
    throw error;
  })).trim() || null;
  const behind = Number((await runGit(sibling.root, ["rev-list", "--count", `${head}..${target}`])).trim());

  const result = { root: sibling.root, head, target, integrationBranch: coreIntegrationBranch, branch, behind, refusal: null };
  if (behind === 0) return result;
  return { ...result, refusal: refusalFor({ ...result, workRoot }) };
}

function refusalFor({ root, head, target, integrationBranch, branch, behind, workRoot }) {
  const where = branch === null ? `detached at ${short(head)}` : `on ${JSON.stringify(branch)} at ${short(head)}`;
  const opening = `The Core ${workRoot} builds against, ${root}, is ${where}, ${behind} commit(s) behind Core's ${integrationBranch} (${short(target)}).`;
  const consequence = "Anything validated against it can fail or pass for the wrong reason, so nothing was merged or changed.";
  if (branch === null) {
    return `${opening} ${consequence} Bring the shared Core up with: pnpm task sync-core (run in ${workRoot}), then run this again.`;
  }
  if (branch.startsWith("task/")) {
    return `${opening} ${consequence} This task's own Core branch must contain Core's ${integrationBranch}: git -C "${root}" merge ${integrationBranch}, re-run the Core-side checks there, then run this again.`;
  }
  return `${opening} ${consequence} That Core is a working checkout on a branch, so it is not moved from here: bring it up to Core's ${integrationBranch} (git -C "${root}" merge ${integrationBranch}, or check out ${integrationBranch} there), then run this again.`;
}

function short(commit) {
  return commit.slice(0, 8);
}

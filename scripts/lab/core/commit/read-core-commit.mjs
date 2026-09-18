// Where the Core a run will load actually sits: detached or on a branch, and
// how far behind the branch this repository's work is written against.
//
// Read with git rather than from any recorded pairing, because nothing records
// one: the Core beside a worktree is a position, not a setting
// (`scripts/worktree/core-sibling.mjs`), and what it holds is whatever was
// checked out there last.
//
// Three of these questions are asked by running a command that exits non-zero
// for an answer we accept -- a directory that is no checkout, a HEAD on no
// branch, a branch this repository does not have -- so `gitAnsweredNo`
// separates git saying no from git not running, and only the first becomes
// "no verdict". A caller that gets a thrown error says the check could not run;
// it does not get a clean result it cannot tell from a real one.

import { gitAnsweredNo, runGit } from "../../../worktree/index.mjs";

/**
 * @param {string} root the Core checkout a run will load
 * @param {string} [target] the branch it is measured against
 * @returns {Promise<{ root: string, detached: boolean, behind: number, head: string | null, target: string } | null>}
 */
export async function readCoreCommit(root, target = "dev") {
  const head = await answer(runGit(root, ["rev-parse", "--verify", "HEAD"]));
  if (head === null) return null;
  const behind = await answer(runGit(root, ["rev-list", "--count", `${head}..${target}`]));
  if (behind === null) return null;
  const branch = await answer(runGit(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]));
  return { root, detached: branch === null, behind: Number(behind), head, target };
}

/** Git's "no" becomes null; git failing to run at all stays an error. */
function answer(running) {
  return running.catch((error) => {
    if (gitAnsweredNo(error)) return null;
    throw error;
  });
}

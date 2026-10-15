// Recording a task id as spent, the moment it is allocated.
//
// The record is a local ref at the commit the task starts from, under
// `refs/fluxiq/task-ids/` (`task-id.mjs` says why a ref and not a counter).
// It is created only if it does not exist yet, so two starts racing for one
// number cannot both record it: the second is refused here, before it has
// made a branch or a worktree. Nothing in the task lifecycle deletes it --
// abandon and prune remove branches and directories, never this ref -- which
// is the whole point: an abandoned id stays spent.

import { runGit } from "../worktree/index.mjs";
import { TASK_ID_REF_PREFIX } from "./task-id-ref-prefix.mjs";

/**
 * @param {string} root the repository the id was allocated against
 * @param {string} id
 * @param {string} startPoint the revision the task branches from
 * @returns {Promise<{ ref: string, commit: string }>}
 */
export async function recordTaskId(root, id, startPoint) {
  const ref = `${TASK_ID_REF_PREFIX}${id}`;
  const commit = (await runGit(root, ["rev-parse", "--verify", `${startPoint}^{commit}`])).trim();
  try {
    // An empty old value makes git refuse when the ref already exists.
    await runGit(root, ["update-ref", "-m", `task ${id} allocated`, ref, commit, ""]);
  } catch (cause) {
    throw new Error(`Task ${id} was claimed in ${root} by another start at the same moment (${ref} already exists). Nothing was created; run the start again for a new id.`, { cause });
  }
  return { ref, commit };
}

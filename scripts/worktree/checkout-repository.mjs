// Which repository a directory belongs to, as one absolute path -- and proof
// that the directory is the top of that checkout rather than somewhere inside
// it.
//
// The two halves have to be asked together, because `git rev-parse` walks up
// the directory tree. An ordinary directory answers quite happily for whatever
// checkout encloses it: in a fixture under the system temporary directory that
// turned out to be a repository in the user's home folder, and a path one
// level wrong inside a worktree answers for that worktree. Asking only for
// `--git-common-dir` therefore makes a plain directory look like a worktree of
// whatever it sits in, which is what would let a build link a Core nobody
// asked for, or let a delete take a directory out of a worktree somebody is
// using.
//
// Every worktree of one repository reports the same `--git-common-dir`, and a
// different checkout reports a different one, so comparing it is what tells
// "a worktree of the Core I mean" from "a Core somebody left beside it".

import { realpath } from "node:fs/promises";
import { runGit } from "./git-command.mjs";
import { samePath } from "./path-identity.mjs";

/** @param {string} root @returns {Promise<string>} the shared git directory of the repository `root` is the top of */
export async function checkoutRepository(root) {
  const top = await runGit(root, ["rev-parse", "--show-toplevel"]);
  if (!samePath(await realpath(top), await realpath(root))) {
    throw new Error(`${root} is not the top of a git checkout: it is a directory inside ${top}`);
  }
  return runGit(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
}

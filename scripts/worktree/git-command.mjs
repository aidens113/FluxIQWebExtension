// Running git against one worktree. Output is returned with only its trailing
// newline removed: a porcelain status line can begin with a space.

import { execFile } from "node:child_process";

/** @param {string} root @param {string[]} args @returns {Promise<string>} */
export function runGit(root, args) {
  return new Promise((resolve, reject) => {
    execFile("git", ["-C", root, ...args], { windowsHide: true, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`git ${args.join(" ")} in ${root} failed: ${(stderr || error.message).trim()}`, { cause: error }));
      else resolve(stdout.replace(/\r?\n$/u, ""));
    });
  });
}

/**
 * Whether a `runGit` rejection is git answering "no" rather than git failing to
 * run at all.
 *
 * Several questions here are asked by running a command that exits non-zero for
 * the answer we want: `symbolic-ref HEAD` on a detached checkout, `rev-parse`
 * on a revision that does not exist, anything at all in a directory that is no
 * checkout. Reading every rejection as that answer would also read a machine
 * with no git on its PATH as "the Core is on no branch and behind nothing",
 * which is the one mistake that matters: a check that cannot run must not
 * report a clean result.
 *
 * `execFile` separates the two. A process that ran and exited non-zero gives a
 * numeric `code`; one that could not be spawned gives a string errno (ENOENT,
 * EACCES), and a killed one gives a `signal` and no code. Only the first is an
 * answer.
 */
export function gitAnsweredNo(error) {
  return typeof error?.cause?.code === "number" && error.cause.code !== 0;
}

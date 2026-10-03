// Which uncommitted changes a run's checkout held, by path and status letter.
//
// A run's manifest records each repository's commit and whether it was dirty,
// and a debug could not tell from that whether a fix still being written was
// in the run (`debugs/run-muqk713g-d08ad3dc.md`, "Instrumentation gaps").
// This names the changed paths with git's two status letters -- never a
// file's content and never a diff -- bounded so a tree with thousands of
// untracked files cannot grow the manifest without limit.

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** The most changed paths one repository record lists. */
export const REPOSITORY_CHANGES_MAX = 200;

/** One uncommitted change: git's index and worktree letters (`" M"`, `"??"`, `"R "`), the path, and for a rename the path it had. */
export type RepositoryChange = { status: string; path: string; from?: string };

export type RepositoryChanges = { changes: RepositoryChange[]; changesOmitted?: number };

/** A checkout's uncommitted changes, from `git status --porcelain=v1 -z`. */
export async function repositoryChanges(root: string): Promise<RepositoryChanges> {
  const safeDirectory = `safe.directory=${path.resolve(root).replaceAll("\\", "/")}`;
  const { stdout } = await execFileAsync("git", ["-c", safeDirectory, "status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  return parsePorcelainChanges(stdout);
}

/** Parses `--porcelain=v1 -z` output: `XY path\0`, and for a rename or copy `XY path\0origPath\0`. */
export function parsePorcelainChanges(stdout: string): RepositoryChanges {
  const fields = stdout.split("\0");
  const changes: RepositoryChange[] = [];
  let total = 0;
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index] ?? "";
    if (field.length < 4) continue;
    const status = field.slice(0, 2);
    const change: RepositoryChange = { status, path: field.slice(3) };
    if (status.includes("R") || status.includes("C")) {
      const from = fields[index + 1];
      index += 1;
      if (from) change.from = from;
    }
    total += 1;
    if (changes.length < REPOSITORY_CHANGES_MAX) changes.push(change);
  }
  return total > changes.length ? { changes, changesOmitted: total - changes.length } : { changes };
}

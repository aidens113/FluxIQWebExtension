import assert from "node:assert/strict";
import test from "node:test";

import { parseTaskBranch, taskBranchName } from "../branch-name.mjs";

test("a task branch is its id and its slug", () => {
  assert.equal(taskBranchName("t042", "flow-editor-cleanup"), "task/t042-flow-editor-cleanup");
});

test("a slug that would nest a ref or escape a directory is refused", () => {
  // The slug reaches both a git ref and a filesystem path, so each of these
  // would fail later and further away: inside "git worktree add", or as a
  // directory created outside the disposable base.
  for (const slug of ["with/slash", "..", "../escape", "with space", "Upper", "trailing-", "-leading", "double--hyphen", ""]) {
    assert.throws(() => taskBranchName("t001", slug), /not a usable task slug/u, `"${slug}" should be refused`);
  }
});

test("a slug of lower-case words joined by single hyphens is accepted", () => {
  for (const slug of ["a", "recorder", "flow-editor-cleanup", "fix-2-frames"]) {
    assert.equal(taskBranchName("t001", slug), `task/t001-${slug}`);
  }
});

test("a branch reads back as its id and slug, and a non-task branch does not", () => {
  assert.deepEqual(parseTaskBranch("task/t042-flow-editor-cleanup"), { id: "t042", slug: "flow-editor-cleanup" });
  assert.equal(parseTaskBranch("dev"), null);
  assert.equal(parseTaskBranch("week1-core-production-build"), null);
});

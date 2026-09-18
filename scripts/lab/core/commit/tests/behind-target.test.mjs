import assert from "node:assert/strict";
import test from "node:test";
import { coreCommitStaleness } from "../behind-target.mjs";
import { readCoreCommit } from "../read-core-commit.mjs";

const at = (over) => ({ root: "F:/fxwork/!FluxIQ", detached: true, behind: 0, head: "cf176feea66b225c4f8bed1910ca3882cd445c9e", target: "dev", ...over });

test("a detached Core behind its target is refused, and the message names the count and the fix", () => {
  const verdict = coreCommitStaleness(at({ behind: 11 }));
  assert.equal(verdict.stale, true);
  assert.equal(verdict.behind, 11);
  assert.match(verdict.message, /detached 11 commit\(s\) behind dev \(at cf176fe\)/u);
  assert.match(verdict.message, /pnpm task sync-core/u);
  // The message has to name the symptom, because the symptom is what someone
  // searches for: three runs were written off as a worktree fault instead.
  assert.match(verdict.message, /environment\.missing/u);
});

test("a Core on a branch is somebody's checkout and is never judged", () => {
  assert.equal(coreCommitStaleness(at({ detached: false, behind: 11 })).stale, false);
});

test("a Core level with its target, or ahead of it, is fine", () => {
  assert.equal(coreCommitStaleness(at({ behind: 0 })).stale, false);
  assert.equal(coreCommitStaleness(at({ behind: -1 })).stale, false);
});

test("a directory that is no checkout yields no verdict rather than blocking a run", async () => {
  assert.equal(await readCoreCommit("C:/no-such-core-anywhere", "dev"), null);
});

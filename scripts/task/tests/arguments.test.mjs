import assert from "node:assert/strict";
import test from "node:test";

import { parseTaskArguments } from "../arguments.mjs";

test("a command and its slug are read", () => {
  const parsed = parseTaskArguments(["start", "flow-editor-cleanup"]);
  assert.equal(parsed.command, "start");
  assert.deepEqual(parsed.positional, ["flow-editor-cleanup"]);
});

test("flags are read, and an unknown flag is refused rather than ignored", () => {
  const parsed = parseTaskArguments(["start", "x", "--worktree", "--core"]);
  assert.equal(parsed.flags.worktree, true);
  assert.equal(parsed.flags.core, true);

  // A silently dropped --worktree would put the task's edits in the shared
  // checkout the flag existed to avoid, so a typo must stop the command.
  assert.throws(() => parseTaskArguments(["start", "x", "--worktre"]), /Unknown flag --worktre/u);
});

test("a value flag takes its value, and refuses to swallow the next flag", () => {
  const parsed = parseTaskArguments(["start", "x", "--base", "F:/elsewhere", "--worktree"]);
  assert.equal(parsed.values.base, "F:/elsewhere");
  assert.equal(parsed.flags.worktree, true);

  assert.throws(() => parseTaskArguments(["start", "x", "--base", "--worktree"]), /--base needs a value/u);
  assert.throws(() => parseTaskArguments(["start", "x", "--base"]), /--base needs a value/u);
});

test("no command at all is refused", () => {
  assert.throws(() => parseTaskArguments([]), /Name a command/u);
});

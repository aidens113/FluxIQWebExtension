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
  assert.throws(() => parseTaskArguments(["start", "x", "--worktre"]), /Unknown option --worktre/u);
});

test("a real flag aimed at the wrong command is refused, and says where it belongs", () => {
  // The worse half of the same defect: the flag exists and is spelled right, so
  // accepting and ignoring it leaves the caller believing it asked for
  // something and the command believing it was never asked. `finish --worktree`
  // parsed cleanly and did nothing before this.
  assert.throws(() => parseTaskArguments(["finish", "t042", "--worktree"]), /not an option of "finish".*belongs to "start"/u);
  assert.throws(() => parseTaskArguments(["start", "x", "--force"]), /not an option of "start".*belongs to "abandon"/u);
  assert.throws(() => parseTaskArguments(["list", "--days", "3"]), /not an option of "list".*belongs to "prune"/u);
});

test("a command nothing knows is refused by the parser, not by the dispatcher", () => {
  // Both used to decide this, from two lists that could disagree about what
  // `pnpm task` accepts.
  assert.throws(() => parseTaskArguments(["stat"]), /Unknown command "stat"/u);
});

test("a command that takes no options says so", () => {
  assert.throws(() => parseTaskArguments(["list", "--verbose"]), /"list" takes no options/u);
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

test("sync-core takes a revision and may be told to move under running processes, and nothing else", () => {
  const parsed = parseTaskArguments(["sync-core", "--to", "main", "--allow-running", "--dry-run"]);
  assert.equal(parsed.command, "sync-core");
  assert.equal(parsed.values.to, "main");
  assert.equal(parsed.flags["allow-running"], true);
  assert.equal(parsed.flags["dry-run"], true);
  assert.throws(() => parseTaskArguments(["sync-core", "--worktree"]), /not an option of "sync-core".*belongs to "start"/u);
});

test("start may be told to move the shared Core under running processes", () => {
  assert.equal(parseTaskArguments(["start", "x", "--worktree", "--allow-running"]).flags["allow-running"], true);
});

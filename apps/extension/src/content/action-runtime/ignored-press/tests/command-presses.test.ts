// T1 coverage of the count that keeps one command to one extra press across the
// in-page recovery's attempts (`command-presses.ts`, t476). The row that
// matters is the second: a command noted once has spent its extra press, so
// `pressAgain` refuses a third. Make the count per attempt instead of per
// command and that row goes red.

import assert from "node:assert/strict";
import test from "node:test";
import { extraPressesMade, noteExtraPress } from "../command-presses";
import { pressAgain } from "../press-again";

test("a command starts with no extra press made", () => {
  assert.equal(extraPressesMade({ commandId: "c-1" }), 0);
});

test("a command that made its extra press on one attempt is not pressed again on the next", () => {
  const command = { commandId: "c-2" };
  noteExtraPress(command);
  assert.equal(extraPressesMade(command), 1);
  assert.equal(pressAgain([], extraPressesMade(command)), false);
});

test("the count belongs to the command object: another command, even with the same id, starts from none", () => {
  const command = { commandId: "c-3" };
  noteExtraPress(command);
  assert.equal(extraPressesMade({ commandId: "c-3" }), 0);
});

// The humanness a command runs at (`../command-humanness.ts`): nothing at all at
// level 0 or with no level, so each verb takes today's path; above 0, a
// generator seeded by the command id, so the step log's id reproduces every
// choice.

import assert from "node:assert/strict";
import test from "node:test";
import { commandHumanness } from "../command-humanness";

function draws(random: () => number, count: number): number[] {
  return Array.from({ length: count }, () => random());
}

test("a command at level 0, or naming none, has no humanness to read", () => {
  assert.equal(commandHumanness({ commandId: "c-1" }), undefined);
  assert.equal(commandHumanness({ commandId: "c-1", humanness: 0 }), undefined);
  assert.equal(commandHumanness({ commandId: "c-1", humanness: undefined }), undefined);
  assert.equal(commandHumanness({ commandId: "c-1", humanness: -20 }), undefined, "a level below 0 is read as 0");
  assert.equal(commandHumanness({ commandId: "c-1", humanness: Number.NaN }), undefined, "an unreadable level is read as 0");
});

test("a command above 0 carries its level, its share of full humanness, and a generator", () => {
  const human = commandHumanness({ commandId: "c-1", humanness: 80 });
  assert.ok(human);
  assert.equal(human.level, 80);
  assert.equal(human.share, 0.8);
  const values = draws(human.random, 50);
  assert.ok(values.every((value) => value >= 0 && value < 1));
  assert.equal(commandHumanness({ commandId: "c-1", humanness: 250 })?.level, 100, "a level above 100 is read as 100");
});

test("the same command id gives the same sequence of choices, and another id another", () => {
  const first = commandHumanness({ commandId: "cmd-42", humanness: 60 });
  const again = commandHumanness({ commandId: "cmd-42", humanness: 60 });
  const other = commandHumanness({ commandId: "cmd-43", humanness: 60 });
  assert.ok(first && again && other);
  const sequence = draws(first.random, 20);
  assert.deepEqual(draws(again.random, 20), sequence);
  assert.notDeepEqual(draws(other.random, 20), sequence);
});

import assert from "node:assert/strict";
import test from "node:test";
import { dynamicListScenario as scenario } from "../scenario.js";

const context = { runToken: "dynamic-list-unit-token", seed: 102 };

/** Every row the page renders, as `[data-entity-id, label]`, in document order. */
function renderedRows(html: string): Array<[string, string]> {
  return [...html.matchAll(/<li data-testid="list-item" data-entity-id="([^"]+)"><span>([^<]*)<\/span>/gu)].map(([, id, label]) => [String(id), String(label)]);
}

test("add then reverse keeps every row's identity with its label: the first row ends last under the same id", () => {
  const seeded = scenario.createState(102);
  const original = seeded.items.map(({ id, label }) => [id, label]);
  const added = scenario.mutate(seeded, "add", { label: "Fourth" });
  assert.deepEqual(added.items.at(-1), { id: `item-${seeded.nextId}`, label: "Fourth" }, "the new row takes a fresh id");
  assert.equal(new Set(added.items.map(({ id }) => id)).size, 4, "no id is reused");

  const reversed = scenario.mutate(added, "reverse", {});
  assert.equal(reversed.items[0]?.label, "Fourth");
  assert.deepEqual(reversed.items.at(-1), seeded.items[0], "the original first row is last, with its own id and label");
  assert.deepEqual(reversed.items.map(({ id, label }) => [id, label]).reverse().slice(0, 3), original);
  assert.deepEqual(seeded, scenario.createState(102), "mutate must not modify its input");
});

test("the rendered list carries each row's id beside its label, in state order, and counts the rows", () => {
  const state = scenario.mutate(scenario.mutate(scenario.createState(102), "add", { label: "Fourth" }), "reverse", {});
  const html = scenario.render(state, context);
  assert.deepEqual(renderedRows(html), state.items.map(({ id, label }) => [id, label]));
  assert.match(html, /<p data-testid="item-count" aria-live="polite">4 items<\/p>/u);
  assert.match(scenario.render(scenario.createState(102), context), /data-testid="item-count" aria-live="polite">3 items</u);
});

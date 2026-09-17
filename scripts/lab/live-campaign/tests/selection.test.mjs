import assert from "node:assert/strict";
import test from "node:test";
import { selectTasks } from "../index.mjs";
import { CATALOG, REPAIRS } from "./tasks.mjs";

test("selection: ids keep their order, kinds keep catalog order, and a live run must choose", () => {
  const base = { taskIds: [], kinds: [], all: false, dryRun: false };
  assert.deepEqual(selectTasks(CATALOG, { ...base, taskIds: ["catalog-pages", "form-goal"] }).map(({ id }) => id), ["catalog-pages", "form-goal"]);
  assert.deepEqual(selectTasks(CATALOG, { ...base, kinds: ["extract"] }).map(({ id }) => id), ["table-read", "table-read-reordered"]);
  assert.deepEqual(selectTasks(CATALOG, { ...base, all: true, limit: 2 }).map(({ id }) => id), ["form-goal", "table-read"]);
  assert.equal(selectTasks(CATALOG, { ...base, dryRun: true }).length, CATALOG.length);
  assert.throws(() => selectTasks(CATALOG, base), /needs a selection/u);
  assert.throws(() => selectTasks(CATALOG, { ...base, taskIds: ["nope"] }), /Unknown task id nope/u);
  assert.throws(() => selectTasks(CATALOG, { ...base, kinds: ["navigate"] }), /matches no task/u);
  const both = [...CATALOG, ...REPAIRS];
  assert.deepEqual(selectTasks(both, { ...base, kinds: ["repair"] }).map(({ id }) => id), ["drift-repair", "drift-refuse", "secrets-refuse"]);
  assert.deepEqual(selectTasks(both, { ...base, kinds: ["form", "repair"], limit: 2 }).map(({ id }) => id), ["form-goal", "drift-repair"]);
  assert.equal(selectTasks(both, { ...base, all: true }).length, 7);
});

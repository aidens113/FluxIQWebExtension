import assert from "node:assert/strict";
import test from "node:test";
import { selectTasks } from "../index.mjs";
import { CATALOG, REALISTIC_CATALOG, REALISTIC_REPAIRS } from "./tasks.mjs";

test("selection: ids keep their order, kinds keep catalog order, and a live run must choose", () => {
  const base = { taskIds: [], kinds: [], all: false, dryRun: false };
  assert.deepEqual(selectTasks(REALISTIC_CATALOG, { ...base, taskIds: ["catalog-pages", "form-goal"] }).map(({ id }) => id), ["catalog-pages", "form-goal"]);
  assert.deepEqual(selectTasks(REALISTIC_CATALOG, { ...base, kinds: ["extract"] }).map(({ id }) => id), ["table-read", "table-read-reordered"]);
  assert.deepEqual(selectTasks(REALISTIC_CATALOG, { ...base, all: true, limit: 2 }).map(({ id }) => id), ["form-goal", "table-read"]);
  assert.equal(selectTasks(REALISTIC_CATALOG, { ...base, dryRun: true }).length, REALISTIC_CATALOG.length);
  assert.throws(() => selectTasks(REALISTIC_CATALOG, base), /needs a selection/u);
  assert.throws(() => selectTasks(REALISTIC_CATALOG, { ...base, taskIds: ["nope"] }), /Unknown task id nope/u);
  assert.throws(() => selectTasks(REALISTIC_CATALOG, { ...base, kinds: ["navigate"] }), /matches no task/u);
  const both = [...REALISTIC_CATALOG, ...REALISTIC_REPAIRS];
  assert.deepEqual(selectTasks(both, { ...base, kinds: ["repair"] }).map(({ id }) => id), ["drift-repair", "drift-refuse", "secrets-refuse"]);
  assert.deepEqual(selectTasks(both, { ...base, kinds: ["form", "repair"], limit: 2 }).map(({ id }) => id), ["form-goal", "drift-repair"]);
  assert.equal(selectTasks(both, { ...base, all: true }).length, 7);
});

test("selection: a task named on a scenario outside the ten realistic ones is refused; --kind, --all and a dry run choose only realistic tasks", () => {
  const base = { taskIds: [], kinds: [], all: false, dryRun: false };
  // CATALOG's tasks are on basic fixture scenarios (instruction-only-form, data-table, product-catalog).
  const mixed = [...CATALOG.map((task) => ({ ...task, id: `outside-${task.id}` })), ...REALISTIC_CATALOG];
  assert.throws(() => selectTasks(mixed, { ...base, taskIds: ["outside-form-goal"] }), /lab:campaign task outside-form-goal refused instruction-only-form: every Lab or browser test run, live or provider-free, uses only the ten realistic scenarios \(user rule, 2026-09-29\): everything-store, crossborder-marketplace, bigbox-retail, job-board, local-classifieds, auction-marketplace, photo-social, social-network-feed, company-website, professional-network\./u);
  assert.throws(() => selectTasks(mixed, { ...base, taskIds: ["form-goal", "outside-catalog-pages"], dryRun: true }), /outside-catalog-pages refused product-catalog/u);
  assert.deepEqual(selectTasks(mixed, { ...base, all: true }).map(({ id }) => id), REALISTIC_CATALOG.map(({ id }) => id));
  assert.deepEqual(selectTasks(mixed, { ...base, dryRun: true }).map(({ id }) => id), REALISTIC_CATALOG.map(({ id }) => id));
  assert.deepEqual(selectTasks(mixed, { ...base, kinds: ["extract"] }).map(({ id }) => id), ["table-read", "table-read-reordered"]);
  assert.throws(() => selectTasks(CATALOG, { ...base, all: true }), /matches no task/u);
});

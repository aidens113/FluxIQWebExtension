import assert from "node:assert/strict";
import test from "node:test";
import type { ScenarioDemonstration } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../../failure.js";
import { selectDemonstration } from "../select-demonstration.js";

const base = { steps: [], detours: [], description: "I show a thing." } as const;
const catalog: ScenarioDemonstration[] = [
  { ...base, id: "site-task-demo", scenarioId: "site", taskId: "site-task" },
  { ...base, id: "site-task-conflict", scenarioId: "site", taskId: "site-task", conflictsWithInstruction: true },
];
const request = { id: "site-task-demo", scenarioId: "site", taskId: "site-task", probe: false };
const refused = (input: typeof request, pattern: RegExp) => assert.throws(() => selectDemonstration(catalog, input), (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid" && pattern.test(error.message));

test("selects the demonstration written for this scenario and task", () => {
  assert.equal(selectDemonstration(catalog, request).id, "site-task-demo");
});

test("refuses an unknown id, another scenario's, and another task's demonstration", () => {
  refused({ ...request, id: "nope" }, /is not in the catalog/u);
  refused({ ...request, scenarioId: "other" }, /belongs to scenario site, not other/u);
  refused({ ...request, taskId: "other-task" }, /was written for task site-task, not --instruction-task other-task/u);
});

test("a conflicting demonstration runs only as a probe", () => {
  refused({ ...request, id: "site-task-conflict" }, /--demonstration-probe/u);
  assert.equal(selectDemonstration(catalog, { ...request, id: "site-task-conflict", probe: true }).conflictsWithInstruction, true);
});

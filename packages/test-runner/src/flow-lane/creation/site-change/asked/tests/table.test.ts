import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isRealisticScenario } from "../../../../../realistic-scenarios/index.js";
import { loadLiveInstructionTasks } from "../../../instruction-catalog.js";
import { ASKED_CHANGES, askedChangeOf } from "../index.js";

const scenarioLabDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "..", "..", "..", "apps", "scenario-lab", "dist");
const catalogBuilt = await access(path.join(scenarioLabDist, "scenarios", "live-instructions.js")).then(() => true, () => false);

test("every realistic task is in the table, and the table names no task the catalog does not hold", { skip: catalogBuilt ? false : "the Scenario Lab is not built" }, async () => {
  const realistic = (await loadLiveInstructionTasks(scenarioLabDist)).filter((task) => isRealisticScenario(task.scenarioId)).map((task) => task.id);
  assert.deepEqual(realistic.filter((id) => askedChangeOf(id) === undefined), [], "a task with no row would never have its acts judged");
  assert.deepEqual(Object.keys(ASKED_CHANGES).filter((id) => !realistic.includes(id)), []);
});

test("an act says what it is, moves something, and shares no name with another act of its task", () => {
  for (const [taskId, asked] of Object.entries(ASKED_CHANGES)) {
    const seen = new Set<string>();
    for (const act of asked.acts) {
      assert.ok(act.name.length > 0, `${taskId} has an unnamed act`);
      assert.ok(Object.keys(act.change).length > 0, `${taskId}: ${act.name} moves nothing`);
      for (const name of Object.keys(act.change)) {
        assert.ok(!seen.has(name), `${taskId} moves ${name} in two acts`);
        seen.add(name);
      }
    }
    assert.deepEqual(new Set(Object.keys(asked.change)), seen, `${taskId}'s whole change is its acts'`);
  }
});

test("a task the table does not hold is undefined, and is not read as asking for nothing", () => {
  assert.equal(askedChangeOf("no-such-task"), undefined);
  assert.equal(askedChangeOf("constructor"), undefined);
  assert.deepEqual(askedChangeOf("everything-store-first-page-plus-earbuds")?.acts, []);
});

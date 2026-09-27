import assert from "node:assert/strict";
import test from "node:test";
import { openScenarioStart } from "../open-scenario-start.js";

function fakePage() {
  const visited: string[] = [];
  let reloads = 0;
  return { visited, get reloads() { return reloads; }, goto: async (url: string) => { visited.push(url); return null; }, reload: async () => { reloads += 1; return null; } };
}

test("the fixture is reached by its declared entry point, by address", async () => {
  const page = fakePage();
  await openScenarioStart(page, "http://127.0.0.1:4173", { startPath: "/scenarios/auth-gate/" });
  assert.deepEqual(page.visited, ["http://127.0.0.1:4173/scenarios/auth-gate/"]);
});

/**
 * The defect this module exists for. A reload re-presents wherever the page
 * happens to be, and `auth-gate` records its way to `/account`, whose armed
 * response is a 302 -- so an armed Flow run began on a rendering the workflow
 * never starts from, and its page facts were judged against the wrong page.
 */
test("the page the run happens to be on is never re-presented instead", async () => {
  const page = fakePage();
  await openScenarioStart(page, "http://127.0.0.1:4173", { startPath: "/scenarios/auth-gate/" });
  assert.equal(page.reloads, 0);
});

test("every load of the same fixture goes to the same address, whatever the run did in between", async () => {
  const page = fakePage();
  const scenario = { startPath: "/scenarios/multi-tab/" };
  await openScenarioStart(page, "http://127.0.0.1:4173", scenario);
  await openScenarioStart(page, "http://127.0.0.1:4173", scenario);
  assert.deepEqual(new Set(page.visited), new Set(["http://127.0.0.1:4173/scenarios/multi-tab/"]));
  assert.equal(page.visited.length, 2, "the load happens again rather than being skipped as already there");
});

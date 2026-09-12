import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { assertExpectedFacts, type ScenarioFactProbe } from "../scenario-assertions.js";
import { openScenarioStart } from "../run-scenario.js";

const root = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const runScenarioSource = () => readFile(path.join(root, "packages", "test-runner", "src", "run-scenario.ts"), "utf8");

function probe(overrides: Partial<ScenarioFactProbe> = {}): ScenarioFactProbe {
  return {
    text: async subject => ({ result: "Submitted replayed", missing: null }[subject] ?? "Confirmed"),
    visible: async subject => subject === "shown",
    exists: async subject => subject !== "removed",
    enabled: async subject => subject !== "disabled",
    path: async () => "/scenarios/navigation/history",
    iframeCount: async () => 2,
    labelCount: async label => label === "Email" ? 2 : 0,
    ...overrides,
  };
}

test("asserts every predicate used by the scenario corpus", async () => {
  await assertExpectedFacts([
    { id: "text", subject: "result", predicate: "text", value: "Submitted replayed" },
    { id: "contains", subject: "result", predicate: "contains", value: "replayed" },
    { id: "visible", subject: "shown", predicate: "visible", value: true },
    { id: "exists", subject: "removed", predicate: "exists", value: false },
    { id: "enabled", subject: "disabled", predicate: "enabled", value: false },
    { id: "path", subject: "document", predicate: "path", value: "/scenarios/navigation/history" },
    { id: "frames", subject: "document", predicate: "iframe-count", value: 2 },
    { id: "labels", subject: "document", predicate: "label-count:Email", value: 2 },
  ], probe());
});

test("fails closed for mismatches, unknown predicates, and invalid expected value types", async () => {
  await assert.rejects(() => assertExpectedFacts([{ id: "wrong", subject: "result", predicate: "contains", value: "absent" }], probe()), /Scenario fact failed: wrong/);
  await assert.rejects(() => assertExpectedFacts([{ id: "unknown", subject: "result", predicate: "future-predicate", value: true }], probe()), /Unsupported scenario fact predicate/);
  await assert.rejects(() => assertExpectedFacts([{ id: "typed", subject: "shown", predicate: "visible", value: "true" }], probe()), /requires a boolean/);
});

test("a candidate page with missing state cannot be selected as successful", async () => {
  await assert.rejects(() => assertExpectedFacts([{ id: "required", subject: "missing", predicate: "text", value: "Ready" }], probe()), /Scenario fact failed/);
  await assert.rejects(() => assertExpectedFacts([{ id: "required", subject: "missing", predicate: "contains", value: "Ready" }], probe()), /Scenario fact failed/);
});

/**
 * The runner's page-fact call sites, pinned at the source, because the defect
 * they guard against was invisible to `assertExpectedFacts` itself. The
 * function cannot know which rendering it is looking at; the guarantee that
 * each lane checks the right one lives entirely in *where* the runner calls it
 * and *which* set it passes. The Flow lane used to arm its variant, reload,
 * and run the Flow without ever checking the rendering it had just armed --
 * every unit here stayed green throughout, so only a check of the call sites
 * catches it. `scenarioPageFactSchedule` is tested in test-contracts; this
 * proves the runner takes both sets from it and from nothing else.
 */
test("the runner checks page facts only from the schedule, and the armed set only once armed", async () => {
  const source = await runScenarioSource();
  const calls = [...source.matchAll(/assertExpectedFacts\(([^,]+),/gu)].map((match) => ({ argument: (match[1] ?? "").trim(), index: match.index }));
  const pageFactCalls = calls.filter((call) => call.argument.includes("pageFacts"));
  assert.deepEqual(pageFactCalls.map((call) => call.argument), ["pageFacts.atLoad", "pageFacts.afterArm"]);
  // Nothing reaches around the schedule into a resolved workflow's merged
  // facts, which say nothing about which rendering they describe.
  assert.deepEqual(calls.filter((call) => /expected\.pageFacts/u.test(call.argument)), []);
  const [atLoad, afterArm] = pageFactCalls;
  assert.ok(atLoad && afterArm);
  // One schedule, built once, from the contract that owns the phase rule.
  assert.equal(source.match(/scenarioPageFactSchedule\(/gu)?.length, 1);
  assert.match(source, /const pageFacts = scenarioPageFactSchedule\(scenario, workflowSelection\(options\), armingOf\(options, workflow\)\);/u);

  const arms = [...source.matchAll(/armScenarioVariant\(/gu)].map((match) => match.index);
  const [beforeLoad, afterRecording] = arms;
  assert.equal(arms.length, 2, "one arm before the first load (existing and clone), one after the recording (the Flow lane)");
  assert.ok(beforeLoad !== undefined && afterRecording !== undefined);
  const armedLoad = source.indexOf("await openScenarioStart(page, activeTopology.scenarioOrigin, scenario);");
  assert.ok(armedLoad > 0, "the Flow lane loads the armed rendering through openScenarioStart");
  // The at-load check sits after the pre-load arm, so on existing and clone it
  // judges the armed rendering, and before the Flow lane's arm, so there it
  // judges the unarmed one the recording was made against.
  assert.ok(beforeLoad < atLoad.index && atLoad.index < afterRecording, "the at-load check runs between the two arming points");
  // The armed check sits after the Flow lane's arm and the load that follows
  // it, so it sees the rendering the Flow is about to run against and not the
  // recorded one.
  assert.ok(afterRecording < armedLoad && armedLoad < afterArm.index, "the armed check runs after the Flow lane arms and loads the armed page");
});

/**
 * Where the Flow lane's post-arm load *goes*, which is a separate defect from
 * when it happens. It was `page.reload()` -- wherever the recording had left
 * the page -- so a fixture whose recording navigates was armed, reloaded onto
 * its last page, checked for the page facts of its first, and then handed a
 * Flow that replays the recording from the beginning. `auth-gate` records its
 * way to `/scenarios/auth-gate/account`, whose armed response is a 302 to
 * `/?expired=1`, so its armed Flow run began on a page the workflow never
 * starts from. Two halves, because neither sees it alone: the destination is
 * `openScenarioStart`'s, and the choice to use it at all is the call site's.
 */
test("the Flow lane's post-arm load lands on the scenario's startPath, not wherever the recording ended", async () => {
  const visited: string[] = [];
  let reloads = 0;
  const page = { goto: async (url: string) => { visited.push(url); return null; }, reload: async () => { reloads += 1; return null; } };
  await openScenarioStart(page, "http://127.0.0.1:4173", { startPath: "/scenarios/auth-gate/" });
  assert.deepEqual(visited, ["http://127.0.0.1:4173/scenarios/auth-gate/"]);
  assert.equal(reloads, 0, "the armed page is reached by address, never by reloading whatever page is open");

  const source = await runScenarioSource();
  const loads = [...source.matchAll(/await openScenarioStart\(/gu)].map((match) => match.index);
  assert.equal(loads.length, 2, "the recording lane's load and the Flow lane's armed load, and no other way of opening the fixture");
  assert.equal(/await page\.reload\(/u.test(source), false, "nothing in the runner re-presents the page it happens to be on");
  const [firstLoad, armedLoad] = loads;
  assert.ok(firstLoad !== undefined && armedLoad !== undefined);
  const [, flowLaneArm] = [...source.matchAll(/armScenarioVariant\(/gu)].map((match) => match.index);
  assert.ok(flowLaneArm !== undefined);
  assert.ok(firstLoad < flowLaneArm && flowLaneArm < armedLoad, "the armed load follows the Flow lane's arm, so it presents the armed rendering");
});

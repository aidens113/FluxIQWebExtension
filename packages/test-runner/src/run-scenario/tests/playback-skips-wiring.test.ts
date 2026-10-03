import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

/**
 * Running `runScenario` needs the whole Lab, so the wiring of a run detail's
 * skipped attempts into the playback step log is checked at the call site, as
 * `run-evaluation/tests/runner-wiring.test.ts` checks the evaluator's. The
 * writer's own behaviour with those skips is `lab-runs/tests/write-playback-steps.test.ts`;
 * the parse that puts `skipped` on an action is `flow-lane/tests/skipped-attempt.test.ts`.
 */
const runnerSource = () => readFile(path.resolve(import.meta.dirname, "..", "..", "..", "src", "run-scenario.ts"), "utf8");

test("each Flow run's skipped attempts are collected as its evidence arrives, with the node and Core's epoch-ms span", async () => {
  const source = await runnerSource();
  assert.match(source, /const playbackSkips: PlaybackSkippedStep\[\] = \[\];/u, "one list for the run");
  assert.match(source, /playbackSkips\.push\(\.\.\.evidence\.run\.actions\.flatMap\(action => action\.skipped \? \[\{ nodeId: action\.nodeId, \.\.\.action\.skipped \}\] : \[\]\)\);/u, "collected beside the actions, from the run detail's own attempts");
});

test("the playback step log is handed the run's skips, so a skipped step is written as skipped, never failed", async () => {
  const source = await runnerSource();
  const call = source.slice(source.indexOf("await writePlaybackSteps({"), source.indexOf("})", source.indexOf("await writePlaybackSteps({")));
  assert.ok(call.length > 0, "the playback is written");
  assert.match(call, /skippedSteps: playbackSkips/u);
  assert.equal(source.match(/writePlaybackSteps\(/gu)?.length, 1, "one call");
});

test("each Flow run's state routing consultations reach the playback step log beside its skips", async () => {
  const source = await runnerSource();
  assert.match(source, /const playbackRoutings: PlaybackStateRoutingStep\[\] = \[\];/u, "one list for the run");
  assert.match(source, /playbackRoutings\.push\(\.\.\.evidence\.run\.actions\.flatMap\(action => action\.stateRouting \? \[\{ nodeId: action\.nodeId, \.\.\.action\.stateRouting \}\] : \[\]\)\);/u, "collected beside the actions, from the run detail's own attempts");
  const call = source.slice(source.indexOf("await writePlaybackSteps({"), source.indexOf("})", source.indexOf("await writePlaybackSteps({")));
  assert.match(call, /stateRoutingSteps: playbackRoutings/u);
});

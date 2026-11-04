// The engine replays added up in both arms: a false pass is counted on the Flow's own live
// verdict, a wrong reference is said apart and never counted away, and what did not run is
// counted as not run, never as a verdict.

import assert from "node:assert/strict";
import test from "node:test";
import { engineTable, summariseEngine } from "../summary.js";
import type { EngineArmResult, EngineBuildResult } from "../replay.js";

const arm = (over: Partial<EngineArmResult> & Pick<EngineArmResult, "arm">): EngineArmResult => ({
  skipped: null, verdict: "inconclusive", refusal: null, scope: "segment", origins: ["recorded", "pure_computation"], liveEpisodeId: null, execution: "failed", trialCode: null,
  recorded: 10, answered: 3, computed: 0, gaps: {}, firstGap: null, stopped: null, stepGaps: [], assertions: [], deliveredEvents: 3, withheldDeliveries: 0, bookkeepingCommands: 0, feedbackSteps: 1, oracle: null, storedRows: 0, wallMs: 1, ...over,
});

const build = (over: Partial<EngineBuildResult>): EngineBuildResult => ({ runId: "run-a", task: "t", labVerdict: "passed", oracleVerdict: null, liveVerdict: "yes", referenceVerdict: "yes", notRun: null, arms: [], ...over });

test("counts a pass on a Flow judged no as a false pass, and one on a judged yes reference as a wrong reference too", () => {
  const summary = summariseEngine([
    build({ liveVerdict: "no", referenceVerdict: "yes", arms: [arm({ arm: "previous_flow", verdict: "pass", oracle: "failed" })] }),
    build({ liveVerdict: "execution_failed", referenceVerdict: "no", arms: [arm({ arm: "previous_flow", verdict: "pass" })] }),
    build({ liveVerdict: "yes", arms: [arm({ arm: "previous_flow", verdict: "pass", oracle: "passed" })] }),
  ]);
  assert.equal(summary.arms.previous_flow.pass, 3);
  assert.equal(summary.arms.previous_flow.falsePasses, 2);
  assert.equal(summary.arms.previous_flow.wrongReference, 1);
  assert.equal(summary.arms.previous_flow.passOnYes, 1);
  assert.equal(summary.arms.previous_flow.passOracleFailed, 1);
  assert.equal(summary.arms.previous_flow.passOracleSame, 1);
});

test("counts a fail on a Flow judged yes as a false failure, and adds up gaps by reason", () => {
  const summary = summariseEngine([build({ arms: [arm({ arm: "exploration", verdict: "fail" }), arm({ arm: "previous_flow", gaps: { other_row: 1, after_unrecorded_act: 4 } })] })]);
  assert.equal(summary.arms.exploration.falseFailures, 1);
  assert.deepEqual(summary.arms.previous_flow.gaps, { other_row: 1, after_unrecorded_act: 4 });
  assert.equal(summary.arms.previous_flow.inconclusive, 1);
});

test("counts a build not run, a refusal and a missing source apart from any verdict", () => {
  const summary = summariseEngine([
    build({ notRun: "session:The store holds no exploration trace naming its build" }),
    build({ notRun: "legacy_build_has_no_rebuild_seam" }),
    build({ arms: [arm({ arm: "exploration", verdict: null, refusal: "incomplete_capture" }), arm({ arm: "previous_flow", verdict: null, skipped: "no_previous_flow" })] }),
  ]);
  assert.deepEqual(summary.notRun, { session: 1, legacy_build_has_no_rebuild_seam: 1 });
  assert.equal(summary.arms.exploration.refused, 1);
  assert.equal(summary.arms.previous_flow.skipped, 1);
  assert.equal(summary.arms.exploration.ran + summary.arms.previous_flow.ran, 0);
});

test("the table names runs, codes and counts, and holds what it is given and no more", () => {
  const table = engineTable(summariseEngine([build({ arms: [arm({ arm: "exploration", stepGaps: [{ step: 4, code: "other_row", actionType: "web.dom.click", wentOn: false }] })] })]), [build({ arms: [arm({ arm: "exploration", stepGaps: [{ step: 4, code: "other_row", actionType: "web.dom.click", wentOn: false }] })] })]);
  assert.match(table, /4: other_row \(dom\.click\)/u);
});

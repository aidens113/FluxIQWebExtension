// The run's spend as Core's Flow purse recorded it: mapped, never rebuilt.

import assert from "node:assert/strict";
import test from "node:test";
import { liveLlmRunSpend } from "../flow-spend.js";
import { flowPurse } from "./flow-purse.js";

const CEILING = 0.25;

test("an itemised purse gives the run's calls, total and every phase that spent, judged once against the ceiling", () => {
  const spend = liveLlmRunSpend(flowPurse({ chat: [1, 0.00119988], build: [27, 0.203830792], read: [1, 0.0004], judge: [2, 0.0073] }), CEILING);
  assert.equal(spend.source, "flow_purse");
  assert.equal(spend.calls, 31);
  assert.equal(spend.totalEstimatedCostUsd, 0.212730672);
  assert.equal(spend.builds, 1);
  assert.deepEqual(spend.phases, {
    build: { calls: 27, estimatedCostUsd: 0.203830792 },
    read: { calls: 1, estimatedCostUsd: 0.0004 },
    judge: { calls: 2, estimatedCostUsd: 0.0073 },
    runtime: null,
    reauthor: null,
    chat: { calls: 1, estimatedCostUsd: 0.00119988 },
  });
  assert.deepEqual(spend.perBuild, {
    ceilingUsd: CEILING,
    builds: [{ phase: "flow", attempt: null, estimatedCostUsd: 0.212730672, overCeiling: false }],
    parts: [
      { phase: "build", attempt: null, estimatedCostUsd: 0.203830792 },
      { phase: "read", attempt: null, estimatedCostUsd: 0.0004 },
      { phase: "judge", attempt: null, estimatedCostUsd: 0.0073 },
      { phase: "chat", attempt: null, estimatedCostUsd: 0.00119988 },
    ],
    maxBuildCostUsd: 0.212730672,
    overCeiling: 0,
  });
});

// `run-mv4912r9-53b05a51`: $0.1203 against $0.10 is one Flow over its ceiling, however the parts split it.
test("a Flow over the ceiling is over it once, and spend the record held before itemising is listed as unattributed", () => {
  const over = liveLlmRunSpend(flowPurse({ build: [40, 0.07], reauthor: [30, 0.0503] }), 0.1);
  assert.deepEqual([over.perBuild.overCeiling, over.perBuild.maxBuildCostUsd, over.perBuild.builds[0]?.overCeiling], [1, 0.1203, true]);
  const older = liveLlmRunSpend(flowPurse({ build: [3, 0.01] }, { spentUsd: 0.015 }), CEILING);
  assert.equal(older.totalEstimatedCostUsd, 0.015);
  assert.deepEqual(older.perBuild.parts.at(-1), { phase: "unattributed", attempt: null, estimatedCostUsd: 0.005 });
});

test("a Flow Core says spent nothing lists no Flow, and an unknown figure is unknown, never zero", () => {
  const nothing = liveLlmRunSpend(flowPurse({}), CEILING);
  assert.deepEqual([nothing.calls, nothing.totalEstimatedCostUsd, nothing.perBuild.builds, nothing.perBuild.maxBuildCostUsd], [0, 0, [], 0]);

  const unitemised = liveLlmRunSpend({ ...flowPurse({}), spentUsd: 0.3, calls: null, byPhase: null }, CEILING);
  assert.deepEqual([unitemised.source, unitemised.calls, unitemised.totalEstimatedCostUsd, unitemised.perBuild.overCeiling, unitemised.perBuild.parts], ["flow_purse_unitemised", null, 0.3, 1, []]);

  for (const why of ["no_record", "flow_unknown", "unreadable"] as const) {
    const unknown = liveLlmRunSpend(null, CEILING, why);
    assert.deepEqual([unknown.source, unknown.calls, unknown.totalEstimatedCostUsd, unknown.builds], [why, null, null, null]);
    assert.deepEqual(unknown.perBuild, { ceilingUsd: CEILING, builds: [{ phase: "flow", attempt: null, estimatedCostUsd: null, overCeiling: false }], parts: [], maxBuildCostUsd: null, overCeiling: 0 });
  }
  assert.deepEqual(liveLlmRunSpend(null, CEILING, "not_settled").perBuild.builds, [], "nothing has settled, so there is no Flow to report yet");
});

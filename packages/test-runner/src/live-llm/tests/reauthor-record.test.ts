// What a run's re-author spent, from Core's record of the run.

import assert from "node:assert/strict";
import test from "node:test";
import { readLiveLlmReauthor } from "../reauthor-record.js";

const scope = { projectId: "project-1", runId: "run-1" };

test("a run with no re-author record reads as absent, and an unreadable detail says so", async () => {
  const absent = await readLiveLlmReauthor({ automationStudioCall: async () => ({ runDetail: { metadata: {} } }) }, scope);
  assert.deepEqual(absent, { source: "absent", attempts: [], calls: 0, uncountedAttempts: 0, totalEstimatedCostUsd: 0 });
  const unreadable = await readLiveLlmReauthor({ automationStudioCall: async () => { throw new Error("gone"); } }, scope);
  assert.equal(unreadable.source, "unreadable");
  assert.equal(unreadable.totalEstimatedCostUsd, 0);
});

test("an attempt with no adaptation and no loop is costed but uncounted, and nothing but counts and ids is kept", async () => {
  const record = await readLiveLlmReauthor({
    automationStudioCall: async (endpoint) => {
      assert.equal(endpoint, "get-flow-run-detail", "no adaptation to read, so none is read");
      return { runDetail: { summary: { flowId: "flow-1" }, metadata: { resultReauthor: { attempts: [{ attempt: 1, routed: true, code: "flow_bootstrap.provider_timeout", reason: "The page said: private text", accounting: { estimatedCostUsd: 0.01, inputTokens: 5_000, outputTokens: 100 } }] } } } };
    },
  }, scope);
  assert.deepEqual(record, {
    source: "run-detail",
    attempts: [{ attempt: 1, adaptationId: null, calls: null, callsFrom: "not_recorded", inputTokens: 5_000, outputTokens: 100, estimatedCostUsd: 0.01 }],
    calls: 0,
    uncountedAttempts: 1,
    totalEstimatedCostUsd: 0.01,
  });
  assert.equal(JSON.stringify(record).includes("private text"), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ExistingRunDetail, ExistingRunLlmAccounting } from "../../../index.js";
import { providerFreeReplayFailures } from "../index.js";

const zero: ExistingRunLlmAccounting = { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, budgetBreaches: 0, pendingCalls: 0 };

test("absence of usage and intervention rows cannot establish zero provider calls", () => {
  assert.equal(providerFreeReplayFailures({}, 0).length, 1);
  assert.equal(providerFreeReplayFailures({ interventions: [], providerCalls: [] }, 0).length, 1);
  assert.ok(providerFreeReplayFailures({ llmAccounting: {} as ExistingRunLlmAccounting }, 0).length > 0);
});

test("explicit zero public counts or a complete zero ledger establish measured provider-free execution", () => {
  assert.deepEqual(providerFreeReplayFailures({ providerCallCount: 0 }, 0), []);
  assert.deepEqual(providerFreeReplayFailures({ llmAccounting: zero, llmGate: { invoked: false } }, 0), []);
  assert.deepEqual(providerFreeReplayFailures({ providerCallCount: 0, llmAccounting: zero, providerCalls: [], providerCallsOmitted: 0, interventions: [] }, 0), []);
});

test("contradictory counts, pending charges and spend cannot be hidden by a zero aggregate", () => {
  assert.ok(providerFreeReplayFailures({ providerCallCount: 1, llmAccounting: zero }, 0).length > 0);
  for (const field of Object.keys(zero) as Array<keyof ExistingRunLlmAccounting>) {
    assert.ok(providerFreeReplayFailures({ providerCallCount: 0, llmAccounting: { ...zero, [field]: 1 } }, 0).length > 0, field);
  }
});

test("actual provider records, omissions, interventions, gate invocation and recovery refuse", () => {
  const contradictions: Partial<ExistingRunDetail>[] = [
    { providerCalls: [{} as NonNullable<ExistingRunDetail["providerCalls"]>[number]] },
    { providerCallsOmitted: 1 }, { interventions: [{} as NonNullable<ExistingRunDetail["interventions"]>[number]] },
    { llmGate: { invoked: true } },
  ];
  for (const contradiction of contradictions) assert.ok(providerFreeReplayFailures({ providerCallCount: 0, ...contradiction }, 0).length > 0);
  assert.ok(providerFreeReplayFailures({ providerCallCount: 0 }, 1).length > 0);
});

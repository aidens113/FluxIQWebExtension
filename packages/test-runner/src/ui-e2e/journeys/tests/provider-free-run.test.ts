// A run started under No LLM intervention must show no model activity at all.

import assert from "node:assert/strict";
import test from "node:test";
import type { ExistingRunDetail } from "../../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../../failure.js";
import { assertProviderFreeRun } from "../provider-free-run.js";

const detail = (extra: Partial<ExistingRunDetail> = {}): ExistingRunDetail => ({
  summary: { runId: "run.one", projectId: "project.one", flowId: "flow.one", status: "succeeded", routeDecisionCount: 1, subflowEntryCount: 1, actionAttemptCount: 1, updatedAt: 1 },
  routeDecisions: [], subflows: [], actionAttempts: [], interventions: [], adaptationIds: [], changeProposalIds: [], ...extra,
});

test("a run with no provider call, intervention, adaptation or change proposal passes with all counts zero", () => {
  assert.deepEqual(assertProviderFreeRun(detail()), { providerCalls: 0, accountedCalls: 0, interventions: 0, adaptations: 0, changeProposals: 0 });
});

test("any recorded model activity fails the run as run.model_activity", () => {
  for (const extra of [
    { providerCallCount: 1 },
    { llmAccounting: { calls: 1, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, budgetBreaches: 0, pendingCalls: 0 } },
    { interventions: [{ interventionId: "i.one", kind: "diagnosis" as const }] },
    { adaptationIds: ["adaptation.one"] },
    { changeProposalIds: ["proposal.one"] },
  ]) {
    assert.throws(() => assertProviderFreeRun(detail(extra)), (error: unknown) => error instanceof RunnerFailure && error.details?.reasonCode === "run.model_activity");
  }
});

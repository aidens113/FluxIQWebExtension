// What a failed save or a failed generation is allowed to keep. The sanitizers
// in the `demo-llm-create-ui` module turn a provider or Core error response
// into a fixed set of bounded facts, and every row here is either a shape that
// must survive that narrowing or a payload that must not: a prompt, a raw
// response, a selector, an unlisted reason code, an out-of-bounds token count.
//
// The evidence-step allowlist is the reason this file is worth reading twice.
// Both of its lists -- the tool ids and the result codes -- were once hand-kept
// copies of the domain's, and both had silently drifted from it. They are
// derived from `@fluxiq-web-extension/domain/node` now, and the last two rows
// are the pair that keeps them that way: the first proves the sanitizer agrees
// with the domain today, the second proves it cannot stop agreeing. Neither is
// sufficient alone.

import assert from "node:assert/strict";
import test from "node:test";
import { readSanitizedGenerationFailure, readSanitizedSettingsSaveFailure } from "../index.js";
import { readCreateUiSource } from "./module-source.js";
import { WEB_LLM_ACTION_RESULT_CODE, WEB_LLM_EVIDENCE_RESULT_CODES, WEB_LLM_EVIDENCE_TOOL_IDS, WEB_LLM_INSPECT_TOOL_ID } from "@fluxiq-web-extension/domain/node";


test("settings save failures retain only bounded stable diagnostics", async () => {
  const response = (status: number, body: string) => ({ status: () => status, headers: () => ({}), text: async () => body });
  const tokenFailure = await readSanitizedSettingsSaveFailure(response(400, JSON.stringify({ error: "LLM input and output limits exceed the total-token limit." })));
  assert.equal(tokenFailure.code, "settings-save.token-total");
  assert.equal(tokenFailure.parsed, true);
  assert.equal(tokenFailure.responseBytes <= 4096, true);
  assert.deepEqual({ both: tokenFailure.revisionBothParsed, relation: tokenFailure.revisionRelation, delta: tokenFailure.revisionAbsoluteDelta }, { both: false, relation: "unknown", delta: null });
  assert.equal((await readSanitizedSettingsSaveFailure(response(403, JSON.stringify({ error: "Security PIN rejected" })))).code, "settings-save.authorization");
  const conflict = await readSanitizedSettingsSaveFailure(response(409, JSON.stringify({ error: "FLOW_SAVE_CONFLICT: expected 1700000000000, current 1700000000007" })));
  assert.deepEqual(conflict, { status: 409, code: "settings-save.conflict", responseBytes: conflict.responseBytes, parsed: true, revisionBothParsed: true, revisionRelation: "expected_lt", revisionAbsoluteDelta: 7 });
  const reverseConflict = await readSanitizedSettingsSaveFailure(response(409, JSON.stringify({ error: "FLOW_SAVE_CONFLICT expected 9000000000000, current 1" })));
  assert.equal(reverseConflict.revisionRelation, "expected_gt");
  assert.equal(reverseConflict.revisionAbsoluteDelta, 1_000_000);
  const equalConflict = await readSanitizedSettingsSaveFailure(response(409, JSON.stringify({ error: "FLOW_SAVE_CONFLICT expected 42, current 42" })));
  assert.equal(equalConflict.revisionRelation, "expected_eq");
  assert.equal(equalConflict.revisionAbsoluteDelta, 0);
  const unknown = await readSanitizedSettingsSaveFailure(response(400, JSON.stringify({ error: "sensitive-opaque-value" })));
  assert.equal(unknown.code, "settings-save.http-400");
  assert.equal(JSON.stringify(unknown).includes("sensitive-opaque-value"), false);
  assert.deepEqual({ both: unknown.revisionBothParsed, relation: unknown.revisionRelation, delta: unknown.revisionAbsoluteDelta }, { both: false, relation: "unknown", delta: null });
  const malformedConflict = await readSanitizedSettingsSaveFailure(response(409, JSON.stringify({ error: "FLOW_SAVE_CONFLICT expected secret, current hidden" })));
  assert.equal(JSON.stringify(malformedConflict).includes("secret"), false);
  assert.deepEqual({ both: malformedConflict.revisionBothParsed, relation: malformedConflict.revisionRelation, delta: malformedConflict.revisionAbsoluteDelta }, { both: false, relation: "unknown", delta: null });
  const unreadable = await readSanitizedSettingsSaveFailure({ status: () => 503, headers: () => ({}), text: async () => { throw new Error("credential-shaped-sensitive-value"); } });
  assert.equal(JSON.stringify(unreadable).includes("credential-shaped-sensitive-value"), false);
  assert.equal(unreadable.revisionBothParsed, false);
  const oversized = await readSanitizedSettingsSaveFailure(response(500, "x".repeat(5000)));
  assert.deepEqual(oversized, { status: 500, code: "settings-save.http-500", responseBytes: 5000, parsed: false, revisionBothParsed: false, revisionRelation: "unknown", revisionAbsoluteDelta: null });
});
test("generation failures retain only Core-validated bounded diagnostics", async () => {
  const response = (status: number, body: string) => ({ status: () => status, headers: () => ({}), text: async () => body });
  const diagnostic = {
    code: "flow_bootstrap.provider_response_malformed",
    stage: "provider_output_validation",
    retryable: false,
    providerInvocation: "attempted",
    providerResponse: "received",
    accounting: {
      requestId: "request.one",
      estimatedInputTokens: 1200,
      provider: "deepseek",
      model: "deepseek-chat",
      providerStatus: 400,
      inputTokens: 900,
      outputTokens: 100,
      totalTokens: 1000,
      estimatedCostUsd: 0.001,
    },
  };
  const readiness = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.invalid_input).",
    payload: { diagnostic: {
      code: "flow_bootstrap.invalid_input",
      stage: "pre_provider_validation",
      retryable: false,
      providerInvocation: "not_attempted",
      providerResponse: "not_received",
    } },
  })));
  assert.deepEqual(readiness, {
    status: 400,
    code: "generation.pre-provider-validation",
    reasonCode: "flow_bootstrap.invalid_input",
    responseBytes: readiness.responseBytes,
    parsed: true,
    providerCallKnown: true,
    providerCallCount: 0,
    accountingKnown: true,
    accountingAvailable: false,
  });

  const known = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.provider_response_malformed).",
    payload: { diagnostic },
  })));
  assert.deepEqual(known, {
    status: 400,
    code: "generation.provider-output-validation",
    reasonCode: "flow_bootstrap.provider_response_malformed",
    responseBytes: known.responseBytes,
    parsed: true,
    providerCallKnown: true,
    providerCallCount: 1,
    accountingKnown: true,
    accountingAvailable: true,
    estimatedInputTokens: 1200,
    inputTokens: 900,
    outputTokens: 100,
    totalTokens: 1000,
  });

  const truncated = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.provider_output_truncated).",
    payload: { diagnostic: {
      ...diagnostic,
      code: "flow_bootstrap.provider_output_truncated",
    } },
  })));
  assert.deepEqual(truncated, {
    status: 400,
    code: "generation.provider-output-validation",
    reasonCode: "flow_bootstrap.provider_output_truncated",
    responseBytes: truncated.responseBytes,
    parsed: true,
    providerCallKnown: true,
    providerCallCount: 1,
    accountingKnown: true,
    accountingAvailable: true,
    estimatedInputTokens: 1200,
    inputTokens: 900,
    outputTokens: 100,
    totalTokens: 1000,
  });
  const paddingTruncated = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.provider_output_padding_truncated).",
    payload: { diagnostic: {
      ...diagnostic,
      code: "flow_bootstrap.provider_output_padding_truncated",
    } },
  })));
  assert.equal(paddingTruncated.code, "generation.provider-output-validation");
  assert.equal(paddingTruncated.reasonCode, "flow_bootstrap.provider_output_padding_truncated");
  assert.equal(paddingTruncated.parsed, true);
  assert.equal(paddingTruncated.providerCallCount, 1);
  assert.equal(paddingTruncated.estimatedInputTokens, 1200);
  assert.equal(paddingTruncated.inputTokens, 900);
  assert.equal(paddingTruncated.outputTokens, 100);
  assert.equal(paddingTruncated.totalTokens, 1000);

  const liveProviderRequestShape = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.provider_http_error).",
    payload: { diagnostic: {
      ...diagnostic,
      code: "flow_bootstrap.provider_http_error",
      stage: "provider_request",
      providerResponse: "received",
    } },
  })));
  assert.deepEqual(liveProviderRequestShape, {
    status: 400,
    code: "generation.provider-request",
    reasonCode: "flow_bootstrap.provider_http_error",
    responseBytes: liveProviderRequestShape.responseBytes,
    parsed: true,
    providerCallKnown: true,
    providerCallCount: 1,
    accountingKnown: true,
    accountingAvailable: true,
    estimatedInputTokens: 1200,
    inputTokens: 900,
    outputTokens: 100,
    totalTokens: 1000,
  });
  assert.equal(JSON.stringify(liveProviderRequestShape).includes("flow_bootstrap.provider_http_error"), true);
  const evidenceToolFailure = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.evidence_tool_failed).",
    payload: { diagnostic: {
      code: "flow_bootstrap.evidence_tool_failed",
      stage: "provider_output_validation",
      retryable: false,
      providerInvocation: "attempted",
      providerResponse: "received",
      evidenceLoop: { iterationCount: 2, decisionCount: 1, toolCallCount: 1, evidenceBytes: 1450, steps: [{ toolId: "web.inspect_current_page", effectApplied: false, resultCode: "web.inspect.succeeded" }] },
    } },
  })));
  assert.deepEqual(evidenceToolFailure.evidenceLoop, { iterationCount: 2, decisionCount: 1, toolCallCount: 1, evidenceBytes: 1450 });
  assert.deepEqual(evidenceToolFailure.evidenceSteps, [{ toolId: "web.inspect_current_page", effectApplied: false, resultCode: "web.inspect.succeeded" }]);
  assert.equal(JSON.stringify(evidenceToolFailure).includes("selector"), false);
  const unsafeEvidenceStep = await readSanitizedGenerationFailure(response(200, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.evidence_tool_failed).",
    payload: { diagnostic: {
      code: "flow_bootstrap.evidence_tool_failed", stage: "provider_output_validation", retryable: false,
      providerInvocation: "attempted", providerResponse: "received",
      evidenceLoop: { iterationCount: 2, decisionCount: 1, toolCallCount: 1, evidenceBytes: 1450, steps: [{ toolId: "web.inspect_current_page", input: { selector: "private-selector" } }] },
    } },
  })));
  assert.equal(unsafeEvidenceStep.parsed, false);
  assert.equal(JSON.stringify(unsafeEvidenceStep).includes("private-selector"), false);
  const preProviderDiagnostic = {
    code: "flow_bootstrap.pre_provider_validation_failed",
    stage: "pre_provider_validation",
    retryable: false,
    providerInvocation: "not_attempted",
    providerResponse: "not_received",
  };
  const preProvider = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.pre_provider_validation_failed).",
    payload: { diagnostic: preProviderDiagnostic },
  })));
  assert.equal(preProvider.code, "generation.pre-provider-validation");
  assert.equal(preProvider.providerCallKnown, true);
  assert.equal(preProvider.providerCallCount, 0);
  assert.equal(preProvider.accountingKnown, true);
  assert.equal(preProvider.accountingAvailable, false);
  assert.equal(preProvider.reasonCode, "flow_bootstrap.pre_provider_validation_failed");

  const stableReason = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.active_instructions_required).",
    payload: { diagnostic: { ...preProviderDiagnostic, code: "flow_bootstrap.active_instructions_required" } },
  })));
  assert.equal(stableReason.code, "generation.pre-provider-validation");
  assert.equal(stableReason.reasonCode, "flow_bootstrap.active_instructions_required");

  const arbitraryCode = "flow_bootstrap.private_value";
  const unknownReason = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: `Flow Bootstrap generation failed (${arbitraryCode}).`,
    payload: { diagnostic: { ...preProviderDiagnostic, code: arbitraryCode } },
  })));
  assert.equal(unknownReason.parsed, false);
  assert.equal(unknownReason.code, "generation.http-400");
  assert.equal(unknownReason.reasonCode, null);
  assert.equal(JSON.stringify(unknownReason).includes(arbitraryCode), false);

  const wrongStageCode = "flow_bootstrap.provider_resolution_invalid";
  const wrongStage = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: `Flow Bootstrap generation failed (${wrongStageCode}).`,
    payload: { diagnostic: { ...preProviderDiagnostic, code: wrongStageCode } },
  })));
  assert.equal(wrongStage.parsed, false);
  assert.equal(wrongStage.code, "generation.http-400");
  assert.equal(wrongStage.reasonCode, null);
  assert.equal(JSON.stringify(wrongStage).includes(wrongStageCode), false);
  for (const unsafe of [
    { ok: false, error: "Flow Bootstrap generation failed (flow_bootstrap.provider_response_malformed).", payload: { diagnostic: { ...diagnostic, rawResponse: "private-response-value" } } },
    { ok: false, error: "private-prompt-value", payload: { diagnostic } },
    { ok: false, error: "Flow Bootstrap generation failed (flow_bootstrap.provider_response_malformed).", payload: { diagnostic }, rawPrompt: "private-prompt-value" },
    { ok: false, error: "Flow Bootstrap generation failed (flow_bootstrap.provider_response_malformed).", payload: { diagnostic: { ...diagnostic, accounting: { ...diagnostic.accounting, totalTokens: 50001 } } } },
  ]) {
    const rejected = await readSanitizedGenerationFailure(response(400, JSON.stringify(unsafe)));
    assert.equal(rejected.code, "generation.http-400");
    assert.equal(rejected.parsed, false);
    assert.equal(rejected.providerCallKnown, false);
    assert.equal(rejected.providerCallCount, 0);
    assert.equal(rejected.accountingKnown, false);
    assert.equal(JSON.stringify(rejected).includes("private"), false);
  }

  const unreadable = await readSanitizedGenerationFailure({ status: () => 503, headers: () => ({}), text: async () => { throw new Error("credential-shaped-sensitive-value"); } });
  assert.equal(unreadable.code, "generation.http-503");
  assert.equal(unreadable.parsed, false);
  assert.equal(JSON.stringify(unreadable).includes("credential-shaped-sensitive-value"), false);
  const oversized = await readSanitizedGenerationFailure(response(500, "x".repeat(5000)));
  assert.deepEqual(oversized, {
    status: 500,
    code: "generation.http-500",
    reasonCode: null,
    responseBytes: 5000,
    parsed: false,
    providerCallKnown: false,
    providerCallCount: 0,
    accountingKnown: false,
    accountingAvailable: false,
  });
});

// The web-automation half of the evidence-loop vocabulary comes from the
// domain itself now. `@fluxiq-web-extension/domain/node` is the built package
// entry: `domain/scripts/rewrite-dist-specifiers.mjs` gives its emitted
// specifiers the explicit extensions that plain Node ESM and this package's
// `nodenext` typecheck both require, which is what the restatement that used
// to stand here was standing in for (`reports/w3-runner-alignment.md`).
// Importing it at all is the first assertion: if the package stops being
// consumable outside a bundler, this file fails to load.

test("the evidence-step sanitizer admits exactly the tools and result codes the domain produces", async () => {
  const response = (body: string) => ({ status: () => 400, headers: () => ({}), text: async () => body });
  const failure = (steps: unknown) => response(JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.evidence_tool_failed).",
    payload: { diagnostic: {
      code: "flow_bootstrap.evidence_tool_failed", stage: "provider_output_validation", retryable: false,
      providerInvocation: "attempted", providerResponse: "received",
      evidenceLoop: { iterationCount: 2, decisionCount: 1, toolCallCount: 1, evidenceBytes: 1450, steps },
    } },
  }));
  const admitted = [
    ...WEB_LLM_EVIDENCE_TOOL_IDS.map(toolId => ({ toolId, effectApplied: true, resultCode: WEB_LLM_ACTION_RESULT_CODE })),
    ...WEB_LLM_EVIDENCE_RESULT_CODES.map(resultCode => ({ toolId: WEB_LLM_INSPECT_TOOL_ID, effectApplied: false, resultCode })),
  ];
  const kept = await readSanitizedGenerationFailure(failure(admitted));
  assert.equal(kept.parsed, true);
  assert.deepEqual(kept.evidenceSteps, admitted);
  // Core's own tests name `web.click_safe`, `web.fill_safe` and `web.select_safe`; no host in this
  // repository offers them, and a well-formed but unlisted result code is not evidence either.
  const dropped = [
    { toolId: "web.click_safe", effectApplied: false, resultCode: "web.action.succeeded" },
    { toolId: "web.fill_safe", effectApplied: false, resultCode: "web.action.succeeded" },
    { toolId: "web.select_safe", effectApplied: false, resultCode: "web.action.succeeded" },
    { toolId: "web.inspect_current_page", effectApplied: false, resultCode: "action.recoverable" },
    { toolId: "web.reveal_safe", effectApplied: false, resultCode: "web.action.rejected.private-reason" },
  ];
  const refused = await readSanitizedGenerationFailure(failure(dropped));
  assert.equal(refused.parsed, true);
  assert.deepEqual(refused.evidenceSteps, []);
});

// The test above proves the sanitizer agrees with the domain today; this one
// proves it cannot stop agreeing. A hand-kept copy that happens to be correct
// would pass the first test and fail this one, which is the whole point: the
// two copies that stood here drifted precisely because nothing forbade them.
test("the sanitizer's allowlist is derived from the domain package, not restated beside it", async () => {
  const source = await readCreateUiSource();
  assert.match(source, /import \{[^}]*WEB_LLM_EVIDENCE_RESULT_CODES[^}]*WEB_LLM_EVIDENCE_TOOL_IDS[^}]*\} from "@fluxiq-web-extension\/domain\/node";/u);
  // Every "..." and '...' literal in the module. A backticked mention inside a comment is prose, not a restatement.
  const quoted = new Set([...source.matchAll(/"([^"\n]*)"|'([^'\n]*)'/gu)].map(match => match[1] ?? match[2]));
  assert.deepEqual([...WEB_LLM_EVIDENCE_TOOL_IDS, ...WEB_LLM_EVIDENCE_RESULT_CODES].filter(value => quoted.has(value)), []);
});

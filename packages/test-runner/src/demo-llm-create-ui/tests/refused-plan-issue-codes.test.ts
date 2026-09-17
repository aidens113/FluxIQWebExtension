// Why Core refused a completed plan, as the sanitizer keeps it. Core sends
// issue codes -- identifiers, but a list of strings Core accepts in any case
// and with colons -- so the sanitizer keeps a code only when it is a lower-case
// dotted identifier from a vocabulary built of literals, and short enough for
// the evidence recorder to name. The rest are counted, never shown.

import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_PLAN_PARAMETER_ISSUE_CODES } from "fluxiq/automation-studio";
import { WEB_PLAN_HANDLE_ISSUE_CODES } from "@fluxiq-web-extension/domain/node";
import { readSanitizedGenerationFailure } from "../index.js";

test("a refused plan keeps only the issue codes its producers spell as literals", async () => {
  const response = (body: unknown) => ({ status: () => 400, headers: () => ({}), text: async () => JSON.stringify(body) });
  const refusal = (code: string, issueCodes: unknown) => response({
    ok: false,
    error: `Flow Bootstrap generation failed (${code}).`,
    payload: { diagnostic: {
      code, stage: "provider_output_validation", retryable: false,
      providerInvocation: "attempted", providerResponse: "received",
      accounting: { requestId: "request.one", estimatedInputTokens: 1200, totalTokens: 1000 },
      evidenceLoop: { iterationCount: 3, decisionCount: 3, toolCallCount: 1, evidenceBytes: 900 },
      issueCodes,
    } },
  });
  const listed = [
    "bootstrap.unknown_definition",
    "record_output.missing_records_path",
    "record_schema.encrypt_unavailable",
    "web.extract_list.no_fields",
    WEB_PLAN_HANDLE_ISSUE_CODES[2],
    AUTOMATION_STUDIO_PLAN_PARAMETER_ISSUE_CODES.notIssued,
  ];
  const unlisted = [
    "web.page.ada_lovelace",
    "Bootstrap.Private_Value",
    "bootstrap.private:value",
    `bootstrap.${"p".repeat(60)}`,
  ];

  const invalidPlan = await readSanitizedGenerationFailure(refusal("flow_bootstrap.evidence_completion_plan_invalid", [...listed, ...unlisted]));

  assert.equal(invalidPlan.parsed, true);
  assert.equal(invalidPlan.reasonCode, "flow_bootstrap.evidence_completion_plan_invalid");
  assert.deepEqual(invalidPlan.issueCodes, listed);
  assert.equal(invalidPlan.issueCodesWithheld, unlisted.length);
  for (const leaked of ["ada_lovelace", "private", "Private", "ppp"]) assert.equal(JSON.stringify(invalidPlan).includes(leaked), false, leaked);

  const stalled = await readSanitizedGenerationFailure(refusal("flow_bootstrap.evidence_unusable_decision", ["web.extract_list.unknown_key"]));
  assert.equal(stalled.reasonCode, "flow_bootstrap.evidence_unusable_decision");
  assert.deepEqual(stalled.issueCodes, ["web.extract_list.unknown_key"]);
  assert.equal(stalled.issueCodesWithheld, 0);

  // Core refuses a list that holds a message rather than codes, and so does the sanitizer.
  const message = await readSanitizedGenerationFailure(refusal("flow_bootstrap.evidence_completion_plan_invalid", ["the private value Ada was refused"]));
  assert.equal(message.parsed, false);
  assert.equal("issueCodes" in message, false);
  assert.equal(JSON.stringify(message).includes("private"), false);

  const unparsedEvidence = await readSanitizedGenerationFailure(refusal("flow_bootstrap.evidence_completion_plan_invalid", undefined));
  assert.equal(unparsedEvidence.parsed, true);
  assert.equal("issueCodes" in unparsedEvidence, false);
  assert.equal("issueCodesWithheld" in unparsedEvidence, false);
});

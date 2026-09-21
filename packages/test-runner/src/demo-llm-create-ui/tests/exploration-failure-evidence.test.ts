// What a failed exploration writes into the run's evidence, recorded through
// the real recorder, which throws on a fact or name it would not keep. A plan
// refusal names each admitted issue code and counts the rest; an exploration
// that gathered more evidence than the recorder can count still reports why it
// failed instead of failing to report it.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Page } from "@playwright/test";
import {
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_INSPECT_RESULT_CODE,
  WEB_LLM_INSPECT_TOOL_ID,
  webLlmToolRejectionResultCode,
} from "@fluxiq-web-extension/domain/node";
import { BrowserEvidenceRecorder } from "../../browser-evidence.js";
import { readSanitizedGenerationFailure, recordExplorationGenerationFailure } from "../index.js";

async function recordedEvents(diagnostic: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-exploration-failure-"));
  const page = { isClosed: () => false } as unknown as Page;
  try {
    const recorder = new BrowserEvidenceRecorder({ workspaceDirectory: root, scenarioId: "exploration-failure", pages: { panel: page, extension: page, scenario: page } });
    await recorder.start();
    const failure = await readSanitizedGenerationFailure({
      status: () => 400,
      headers: () => ({}),
      text: async () => JSON.stringify({ ok: false, error: `Flow Bootstrap generation failed (${String(diagnostic.code)}).`, payload: { diagnostic } }),
    });
    assert.equal(failure.parsed, true);
    await recordExplorationGenerationFailure(recorder, failure);
    return await readFile(path.join(await recorder.finalize("failed"), "events.ndjson"), "utf8");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const refusal = {
  code: "flow_bootstrap.evidence_completion_plan_invalid",
  stage: "provider_output_validation",
  retryable: false,
  providerInvocation: "attempted",
  providerResponse: "received",
  accounting: { requestId: "request.one", estimatedInputTokens: 1200, totalTokens: 1000 },
};

test("a refused plan's admitted issue codes are each recorded, and the rest only counted", async () => {
  const events = await recordedEvents({
    ...refusal,
    evidenceLoop: { iterationCount: 3, decisionCount: 3, toolCallCount: 1, evidenceBytes: 900, steps: [{ toolId: WEB_LLM_INSPECT_TOOL_ID, effectApplied: false, resultCode: WEB_LLM_INSPECT_RESULT_CODE }] },
    issueCodes: ["bootstrap.unknown_definition", "web.extract_list.no_fields", "web.page.ada_lovelace"],
  });

  assert.match(events, /"stage":"exploration-plan-issue","errorCode":"bootstrap\.unknown_definition","facts":\{"sequence":1\}/u);
  assert.match(events, /"stage":"exploration-plan-issue","errorCode":"web\.extract_list\.no_fields","facts":\{"sequence":2\}/u);
  assert.match(events, /"errorCode":"plan-issue\.withheld","facts":\{"withheldCount":1\}/u);
  assert.match(events, /"stage":"exploration-tool-result"/u);
  assert.match(events, /"stage":"exploration-generation-rejected","errorCode":"flow_bootstrap\.evidence_completion_plan_invalid"/u);
  assert.match(events, /"evidenceBytes":900/u);
  assert.doesNotMatch(events, /ada_lovelace/u);
});

test("an exploration past the recorder's largest count still records why it failed", async () => {
  // Core bounds an exploration's evidence at 1,048,576 bytes; the recorder's facts stop at 1,000,000.
  const atBound = await recordedEvents({ ...refusal, evidenceLoop: { iterationCount: 64, decisionCount: 65, toolCallCount: 64, evidenceBytes: 1_000_000 } });
  assert.match(atBound, /"evidenceBytes":1000000/u);

  const past = await recordedEvents({ ...refusal, evidenceLoop: { iterationCount: 64, decisionCount: 65, toolCallCount: 64, evidenceBytes: 1_048_576 } });
  assert.match(past, /"stage":"exploration-generation-rejected","errorCode":"flow_bootstrap\.evidence_completion_plan_invalid"/u);
  assert.match(past, /"evidenceBytesOverMillion":true/u);
  assert.doesNotMatch(past, /"evidenceBytes":/u);
});

test("a long tool and result pair retains the result category without masking the failure", async () => {
  const resultCode = webLlmToolRejectionResultCode("no_repeating_structure");
  assert.ok(`${WEB_LLM_DETECT_STRUCTURE_TOOL_ID}.${resultCode}`.length > 64);
  const events = await recordedEvents({
    ...refusal,
    evidenceLoop: {
      iterationCount: 2,
      decisionCount: 2,
      toolCallCount: 2,
      evidenceBytes: 1200,
      steps: [
        { toolId: WEB_LLM_INSPECT_TOOL_ID, effectApplied: false, resultCode: WEB_LLM_INSPECT_RESULT_CODE },
        { toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, effectApplied: false, resultCode },
      ],
    },
  });

  assert.match(events, new RegExp(`"stage":"exploration-tool-result","errorCode":"${resultCode.replaceAll(".", "\\.")}","facts":\\{"sequence":2`, "u"));
  assert.match(events, /"stage":"exploration-generation-rejected","errorCode":"flow_bootstrap\.evidence_completion_plan_invalid"/u);
  assert.doesNotMatch(events, /Evidence diagnostic identity is invalid/u);
});

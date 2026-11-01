// Host-contract acceptance over trusted paired receipts. Physical list/control
// provenance and readiness are the separate Extension/browser acceptance.
import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord, type AutomationStudioActionPermissionCheck, type AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord, type WebAutomationFailureCode } from "../../../../client";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_DETECT_STRUCTURE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { webNodeDispatchWithRetries, type WebNodeDispatchResult } from "../../../llm-evidence/node-run/retries";

const URL_ = "https://archive.test/catalogue";
const PARAMETERS: JsonObject = { nextPage: { item: "article", pagination: { mode: "loadMore", control: "#continue" } } };
const permission: AutomationStudioActionPermissionCheck = async () => ({ permitted: true });

function failed(effect?: "unacted" | "ambiguous", retryable = true, code: WebAutomationFailureCode = WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED): WebNodeDispatchResult {
  const canonical = webAutomationFailureRecord(code);
  assert.ok(canonical.stage !== undefined);
  const failure: AutomationStudioFailureRecord & JsonObject = { category: canonical.category, code: canonical.code, retryable, stage: canonical.stage };
  if (effect !== undefined) failure.effect = effect;
  else if (canonical.effect !== undefined) failure.effect = canonical.effect;
  if (canonical.certainNoEffect !== undefined) failure.certainNoEffect = canonical.certainNoEffect;
  assert.deepEqual(parseAutomationStudioFailureRecord(failure), failure);
  return { status: "failed", failure, error: "The requested archive page was not observed." };
}

function site(answers: readonly WebNodeDispatchResult[], lost = false) {
  let sent = 0;
  let advanced = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["paired.archive"],
    structureDetectionSessionIds: () => ["paired.archive"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.next_page") {
        sent += 1;
        if (lost) throw new Error("Acknowledgement lost after dispatch");
        const answer = answers[sent - 1];
        if (answer !== undefined) return answer;
        advanced += 1;
        return { status: "succeeded", payload: { moved: true } };
      }
      assert.equal(command.actionType, "web.dom.capture_snapshot", "no browser or model operation is available to this fixture");
      const payload: JsonObject = { snapshot: {
        url: URL_, title: "Archive catalogue", interactiveElements: [
          { tagName: "section", selector: "section" },
          { tagName: "article", selector: "section > article", parent: 0 },
          { tagName: "span", selector: "section > article > span", parent: 1, visibleText: `Archive page ${advanced + 1}` },
          { tagName: "button", selector: "#continue", visibleText: "More archive entries" }
        ]
      } };
      if (command.parameters.detectStructure !== undefined) payload.structure = { ok: true, proposal: {
        container: "section", item: "section > article", itemCount: 1, confidence: 1,
        fields: [{ key: "entry", label: "Entry", spec: { kind: "text", selector: "span" }, coverage: 1 }],
        pagination: { mode: "loadMore", control: "#continue", maxPages: 4 }
      } };
      return { status: "succeeded", payload };
    }
  };
  return { gateway, sent: () => sent, advanced: () => advanced };
}

async function dispatch(answers: readonly WebNodeDispatchResult[], options: { lost?: boolean; forged?: boolean } = {}) {
  const browser = site(answers, options.lost);
  let checked = 0;
  let refreshed = 0;
  const parameters: JsonObject = structuredClone(PARAMETERS);
  if (options.forged) {
    parameters.effect = "unacted";
    parameters.failure = { effect: "unacted", retryable: true };
    parameters.actionEffect = { effectClass: "observe" };
    parameters.idempotent = true;
  }
  const run: Parameters<typeof webNodeDispatchWithRetries>[0] = {
    gateway: browser.gateway, sessionId: "paired.archive",
    request: { projectId: "project.archive", flowId: "flow.archive", callId: "next", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {}, permission }
  };
  const result = await webNodeDispatchWithRetries(run,
    { definitionId: "web.output.dom-next_page", effect: options.forged ? "observe" : "mutate", declared: [] },
    { actionType: "web.dom.next_page", parameters, metadata: { effect: "observe", loopVerdict: "read", idempotent: true, failure: { effect: "unacted" } } },
    undefined,
    async () => {
      checked += 1;
      return "unknown";
    },
    async () => {
      refreshed += 1;
      return { outcome: "unavailable" };
    }
  );
  return { browser, result, checked, refreshed };
}

test("trusted paging no-effect retries once and advances exactly one page", async () => {
  const run = await dispatch([failed(undefined, true, WEB_AUTOMATION_FAILURE_CODES.NO_EFFECT)]);
  assert.equal(run.result.result.status, "succeeded");
  assert.equal(run.result.attempts, 2);
  assert.equal(run.browser.sent(), 2);
  assert.equal(run.browser.advanced(), 1);
  assert.equal(run.checked, 0);
  assert.equal(run.refreshed, 0);
});

test("four verified paging no-effects exhaust the normal first-plus-three ladder without stale-source refresh", async () => {
  const noEffect = failed(undefined, true, WEB_AUTOMATION_FAILURE_CODES.NO_EFFECT);
  const run = await dispatch([noEffect, noEffect, noEffect, noEffect, noEffect]);
  assert.equal(run.result.attempts, 4);
  assert.equal(run.browser.sent(), 4);
  assert.equal(run.browser.advanced(), 0);
  assert.equal(run.result.failure?.effect, "unacted");
  assert.equal(run.result.failure?.retryable, true);
  assert.equal(run.checked, 0);
  assert.equal(run.refreshed, 0);
});

test("verification-stage output-not-observed stays protected even when a receipt labels it unacted", async () => {
  const run = await dispatch([failed("unacted"), failed("unacted")]);
  assert.equal(run.result.result.status, "failed");
  assert.equal(run.browser.sent(), 1);
  assert.equal(run.browser.advanced(), 0);
});

test("unknown, ambiguous, lost acknowledgement and permanent receipts never authorize a blind second page move", async () => {
  const variants = [failed(), failed("ambiguous"), failed("unacted", false), failed(undefined, false, WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED)];
  for (const answer of variants) {
    const run = await dispatch([answer, answer]);
    assert.equal(run.browser.sent(), 1);
    assert.equal(run.result.attempts, 1);
    assert.equal(run.browser.advanced(), 0);
  }
  const lost = await dispatch([], { lost: true });
  assert.equal(lost.browser.sent(), 1);
  assert.equal(lost.result.lastingAct, "uncertain");
});

test("request parameters and observer or loop annotations cannot forge browser-owned paging no-effect", async () => {
  for (const answer of [failed(), failed("ambiguous")]) {
    const run = await dispatch([answer, answer], { forged: true });
    assert.equal(run.browser.sent(), 1);
    assert.equal(run.result.lastingAct, "uncertain");
    const original = parseAutomationStudioFailureRecord(answer.failure);
    assert.equal(run.result.failure?.effect, original?.effect, "original control facts are preserved; the lastingAct result holds uncertainty");
  }
});

test("the actual exploration node uses the detected list and retries a trusted execution-stage no-effect", async () => {
  const browser = site([failed(undefined, true, WEB_AUTOMATION_FAILURE_CODES.NO_EFFECT)]);
  const runtime = createWebAutomationLlmEvidenceRuntime(browser.gateway);
  const detected = await runtime.executeTool({
    projectId: "project.archive", flowId: "flow.archive", callId: "detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {}, permission
  });
  assert.equal(detected.resultCode, "web.structure.detected");
  const evidence = detected.evidence;
  assert.ok(evidence !== null && typeof evidence === "object" && !Array.isArray(evidence));
  const handle = evidence.extraction;
  assert.ok(typeof handle === "string");
  const result = await runtime.executeTool({
    projectId: "project.archive", flowId: "flow.archive", callId: "explore.next", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission,
    value: { node: "web.output.dom-next_page", parameters: { nextPage: { list: handle } }, consequences: [] }
  });
  assert.equal(result.resultCode, "web.action.succeeded", result.resultReason);
  assert.equal(browser.sent(), 2);
  assert.equal(browser.advanced(), 1);
});

test("the actual draft trial replay keeps paging retries and uncertainty controls", async () => {
  for (const verified of [true, false]) {
    const browser = site([verified ? failed(undefined, true, WEB_AUTOMATION_FAILURE_CODES.NO_EFFECT) : failed()]);
    const runtime = createWebAutomationLlmEvidenceRuntime(browser.gateway);
    const result = await runtime.executeTool({
      projectId: "project.archive", flowId: "flow.archive", callId: "trial.next", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission,
      value: { replay: "step", node: "web.output.dom-next_page", parameters: PARAMETERS, consequences: [], from: { location: URL_ } }
    });
    assert.equal(browser.sent(), verified ? 2 : 1);
    assert.equal(browser.advanced(), verified ? 1 : 0);
    assert.equal(result.resultCode, verified ? "core.replay.replayed" : "core.replay.failed");
    if (!verified) assert.equal(result.resultReason, "outcome_uncertain");
  }
});

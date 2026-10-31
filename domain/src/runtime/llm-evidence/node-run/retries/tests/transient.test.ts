import assert from "node:assert/strict";
import test from "node:test";
import { runAutomationStudioLlmEvidenceLoop, type AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { WEB_AUTOMATION_FAILURE_CODES as C, webAutomationFailureRecord } from "../../../../failure";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";
import { toolExecution } from "../../../capture";
import { RecoverableToolRejection } from "../../../tool-rejection";
import { webNodeDispatchWithRetries, type WebNodeDispatchResult } from "..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const PAGE: JsonObject = { url: "https://fixture.test/work", title: "Work", interactiveElements: [{ tagName: "button", selector: "#save", visibleText: "Save" }] };
const PRIVATE = "private_failure_comparison";
const DIGEST = "a".repeat(64);
const ORIGINAL: AutomationStudioFailureRecord = {
  category: "action_failed", code: C.RATE_LIMITED, retryable: true,
  stage: "execution", effect: "unacted", expected: PRIVATE, actual: PRIVATE, evidenceDigest: DIGEST
};

function source(answers: readonly WebNodeDispatchResult[], thrown = false) {
  let sent = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_session, command) => {
      if (command.actionType !== "web.dom.click") return { status: "succeeded", payload: { snapshot: PAGE } };
      const answer = answers[Math.min(sent, answers.length - 1)]!;
      sent += 1;
      if (thrown) throw Object.assign(new Error("private thrown detail"), { failure: answer.failure });
      return answer;
    }
  };
  return { gateway, sent: () => sent };
}

test("actual exploration and replay return projected temporary controls before Core parsing, without changing effect/evidence", async () => {
  for (const replay of [false, true]) {
    for (const thrown of [false, true]) {
      const site = source([{ status: "failed", failure: ORIGINAL }], thrown);
      const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
      const request = { ...PROJECT, toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: async () => ({ permitted: true as const }) };
      let parameters: JsonObject = { selector: "#save" };
      if (!replay) {
        const looked = await runtime.executeTool({ ...request, callId: "look", value: { node: "web.output.dom-capture_snapshot", parameters: {} } });
        parameters = { target: { handle: shownHandle(looked.evidence, "Save") } };
      }
      const value: JsonObject = { node: "web.output.dom-click", parameters, consequences: [] };
      if (replay) value.replay = "step";
      const result = await runtime.executeTool({ ...request, callId: "save", value });
      assert.equal(site.sent(), 4);
      assert.equal(result.effectApplied, false);
      assert.ok(result.evidence);
      assert.deepEqual(result.failure, { category: "action_failed", code: C.RATE_LIMITED, retryable: true, stage: "execution", effect: "unacted", transient: true });
      assert.doesNotMatch(JSON.stringify(result.failure), new RegExp(`${PRIVATE}|${DIGEST}`, "u"));
      let decisions = 0;
      const loop = await runAutomationStudioLlmEvidenceLoop({
        tools: [{ toolId: "host.action", description: "Execute host action", inputSchema: { type: "object" }, effect: "mutate" }],
        draft: false, minToolCalls: 1,
        decide: async () => ++decisions === 1
          ? { kind: "tool_call", callId: "host.call", toolId: "host.action", input: {} }
          : { kind: "complete", result: { finished: true } },
        executeTool: async () => result,
        unusableDecisions: { stalled: () => new Error("stalled") }
      });
      assert.equal(loop.ok, true);
      assert.equal(loop.accounting.toolCalls, 1);
      assert.equal(loop.trace.some((entry) => entry.resultCode?.startsWith("llm_evidence_loop.tool_result_invalid")), false);
    }
  }
  assert.equal(ORIGINAL.transient, undefined);
  assert.equal(ORIGINAL.actual, PRIVATE);
});

test("a successful later call has no stale failure; malformed optional control never erases actual facts", () => {
  for (const applied of [false, true]) {
    const evidence = { actual: "existing evidence remains" };
    const result = toolExecution(evidence, applied, "tool.result", undefined, undefined, undefined, { ...ORIGINAL, transient: false });
    assert.equal(result.failure, undefined);
    assert.equal(result.effectApplied, applied);
    assert.equal(result.evidence, evidence);
  }
  assert.equal(toolExecution({}, true, "tool.succeeded").failure, undefined);
  const carried = new RecoverableToolRejection("page_unreadable", undefined, undefined, undefined, ORIGINAL);
  assert.doesNotMatch(JSON.stringify(carried.failure), new RegExp(`${PRIVATE}|${DIGEST}`, "u"));
  assert.equal(carried.failure?.effect, "unacted");
});

test("an earlier ambiguous state attempt cannot be hidden by selected temporary unacted evidence", async () => {
  const ambiguous: AutomationStudioFailureRecord = {
    category: "action_failed", code: C.TRANSPORT_TRANSIENT, retryable: true, stage: "execution", effect: "ambiguous"
  };
  const answers: WebNodeDispatchResult[] = [
    { status: "failed", failure: ambiguous },
    { status: "failed", failure: ORIGINAL },
    { status: "failed", failure: webAutomationFailureRecord(C.TARGET_NOT_FOUND) },
    { status: "failed", failure: webAutomationFailureRecord(C.TARGET_NOT_FOUND) }
  ];
  let sent = 0;
  const outcome = await webNodeDispatchWithRetries({
    gateway: { eligibleSessionIds: () => ["session.one"], executeAction: async () => answers[sent++]! },
    sessionId: "session.one", request: { ...PROJECT, callId: "state", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {} }
  }, { definitionId: "web.output.dom-type", effect: "mutate", declared: [] }, { actionType: "web.dom.type", parameters: { selector: "#field", text: "replacement" }, metadata: {} });
  assert.equal(sent, 4);
  assert.equal(outcome.result.failure?.code, C.RATE_LIMITED, "existing explanatory selection remains");
  assert.equal(outcome.failure?.effect, "ambiguous", "new control metadata preserves earlier uncertainty");
});


test("a failed capture carries only control through its catch, and the next successful call clears it", async () => {
  let calls = 0;
  const transport: AutomationStudioFailureRecord = { ...ORIGINAL, code: C.TRANSPORT_TRANSIENT };
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("private capture failure"), { failure: transport });
      return { status: "succeeded", payload: { snapshot: PAGE } };
    }
  });
  const request = { ...PROJECT, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {} } };
  const failed = await runtime.executeTool({ ...request, callId: "capture.failed" });
  assert.equal(failed.effectApplied, false);
  assert.equal(failed.failure?.code, C.TRANSPORT_TRANSIENT);
  assert.equal(failed.failure?.transient, true);
  assert.doesNotMatch(JSON.stringify(failed.failure), new RegExp(`${PRIVATE}|${DIGEST}`, "u"));
  const succeeded = await runtime.executeTool({ ...request, callId: "capture.succeeded" });
  assert.equal(succeeded.resultCode, "web.inspect.succeeded");
  assert.equal(succeeded.failure, undefined);
  assert.equal(transport.actual, PRIVATE);
});


test("replay reset keeps the current original temporary controls and existing flags, without inferring unacted", async () => {
  for (const effect of ["ambiguous", "unacted", undefined] as const) {
    const failure: AutomationStudioFailureRecord = { category: "action_failed", code: C.TRANSPORT_TRANSIENT, retryable: true, stage: "execution" };
    if (effect !== undefined) failure.effect = effect;
    const runtime = createWebAutomationLlmEvidenceRuntime({
      eligibleSessionIds: () => ["session.one"],
      executeAction: async () => { throw Object.assign(new Error("reset failed"), { failure }); }
    });
    const result = await runtime.executeTool({ ...PROJECT, callId: "reset", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
      value: { replay: "reset", from: { location: "https://fixture.test/work" } } });
    assert.equal(result.resultCode, "core.replay.reset_failed");
    assert.equal(result.effectApplied, false);
    assert.equal(result.failure?.transient, true);
    assert.equal(result.failure?.effect, effect);
    assert.equal(result.personNeeded, undefined);
  }
});

test("unreadable optional thrown controls cannot erase a dispatched reset or admit temporary retry", async () => {
  let calls = 0;
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async () => {
      calls += 1;
      throw new Proxy(new Error("private dispatched failure"), {
        getOwnPropertyDescriptor() { throw new Error("private descriptor failure"); }
      });
    }
  });
  const result = await runtime.executeTool({
    ...PROJECT, callId: "reset.unreadable", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { replay: "reset", from: { location: "https://fixture.test/work" } }
  });
  assert.equal(calls, 1);
  assert.equal(result.resultCode, "core.replay.reset_failed");
  assert.equal(result.effectApplied, false);
  assert.equal(result.personNeeded, undefined);
  assert.ok(result.evidence);
  assert.deepEqual(result.failure, {
    category: "ambiguous_or_unknown", code: C.UNKNOWN, retryable: false, stage: "execution", effect: "ambiguous"
  });
  assert.doesNotMatch(JSON.stringify(result.failure), /private/u);
});

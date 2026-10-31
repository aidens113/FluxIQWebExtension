import assert from "node:assert/strict";
import test from "node:test";
import { runAutomationStudioLlmEvidenceLoop, type AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../../../failure";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { toolExecution } from "../../../capture";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";
import { RecoverableToolRejection } from "../../../tool-rejection";

const PROJECT = { projectId: "project.one", flowId: "flow.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID };
const FAILURE: AutomationStudioFailureRecord = { category: "unexpected_state", code: "web.target.not_actionable", retryable: false, stage: "execution", effect: "ambiguous" };
const OBSERVATION_FAILURE: AutomationStudioFailureRecord = {
  category: "user_intervention_required", code: WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED, retryable: false, stage: "execution", effect: "unacted"
};
const COVERED: JsonObject = { actionable: false, cause: "covered" };

function site(success: boolean, thrown = false) {
  let calls = 0;
  let changed = false;
  let measured: JsonObject | undefined = COVERED;
  const snapshot = (): JsonObject => ({
    url: "https://fixture.test/work", title: "Work",
    interactiveElements: changed
      ? [{ tagName: "button", selector: "#save", visibleText: "Saved" }]
      : [{ tagName: "button", selector: "#save", visibleText: "Save" }]
  });
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_session, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: snapshot() } };
      calls += 1;
      if (thrown) throw Object.assign(new Error("private failure"), { failure: FAILURE, actionability: measured });
      changed = !changed;
      const payload: JsonObject = measured === undefined ? {} : { actionability: measured };
      return success ? { status: "succeeded", payload } : { status: "failed", failure: FAILURE, payload };
    }
  };
  return { gateway, calls: () => calls, unmeasured: () => { measured = undefined; }, measure: (fact: JsonObject) => { measured = fact; } };
}

test("exploration and replay preserve current measured controls through actual failure/refusal/catch and the public Core loop", async () => {
  for (const replay of [false, true]) {
    for (const thrown of [false, true]) {
      const source = site(false, thrown);
      const runtime = createWebAutomationLlmEvidenceRuntime(source.gateway);
      let parameters: JsonObject = { selector: "#save" };
      if (!replay) {
        const looked = await runtime.executeTool({ ...PROJECT, callId: "look", value: { node: "web.output.dom-capture_snapshot", parameters: {} } });
        parameters = { target: { handle: shownHandle(looked.evidence, "Save") } };
      }
      const value: JsonObject = { node: "web.output.dom-click", parameters, consequences: [] };
      if (replay) value.replay = "step";
      const result = await runtime.executeTool({ ...PROJECT, callId: "act", value, permission: async () => ({ permitted: true as const }) });
      assert.equal(source.calls(), 1);
      assert.equal(result.effectApplied, false);
      assert.equal(result.failure?.effect, "ambiguous");
      assert.equal(result.failure?.transient, undefined);
      assert.equal(result.personNeeded, undefined);
      assert.deepEqual(result.actionability, COVERED);
      assert.doesNotMatch(JSON.stringify(result.evidence), /"actionability"/u);
      let decisions = 0;
      const loop = await runAutomationStudioLlmEvidenceLoop({
        tools: [{ toolId: "host.action", description: "Execute action", inputSchema: { type: "object" }, effect: "mutate" }],
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
});

test("replay success and reset carry only their own measurement and a fresh unmeasured success clears it", async () => {
  for (const replay of ["step", "reset"] as const) {
    const source = site(true);
    const runtime = createWebAutomationLlmEvidenceRuntime(source.gateway);
    const value: JsonObject = replay === "reset"
      ? { replay, from: { location: "https://fixture.test/work" } }
      : { replay, node: "web.output.dom-click", parameters: { selector: "#save" }, consequences: [] };
    const first = await runtime.executeTool({ ...PROJECT, callId: "first", value, permission: async () => ({ permitted: true as const }) });
    assert.equal(first.effectApplied, true);
    assert.deepEqual(first.actionability, COVERED);
    assert.equal(first.failure, undefined);
    source.unmeasured();
    const fresh = await runtime.executeTool({ ...PROJECT, callId: "fresh", value, permission: async () => ({ permitted: true as const }) });
    assert.equal(fresh.effectApplied, true);
    assert.equal(fresh.actionability, undefined);
    assert.equal(fresh.failure, undefined);
  }
});

test("failed capture and reset throws retain separate controls while targetless successful capture stays unknown", async () => {
  for (const reset of [false, true]) {
    const runtime = createWebAutomationLlmEvidenceRuntime({
      eligibleSessionIds: () => ["session.one"],
      executeAction: async () => { throw Object.assign(new Error("private"), { failure: FAILURE, actionability: COVERED }); }
    });
    const value: JsonObject = reset
      ? { replay: "reset", from: { location: "https://fixture.test/work" } }
      : { node: "web.output.dom-capture_snapshot", parameters: {} };
    const result = await runtime.executeTool({ ...PROJECT, callId: "failed", value, permission: async () => ({ permitted: true as const }) });
    assert.deepEqual(result.actionability, COVERED);
    assert.equal(result.failure?.effect, "ambiguous");
    assert.equal(result.effectApplied, false);
  }
  const source = site(true);
  const runtime = createWebAutomationLlmEvidenceRuntime(source.gateway);
  const result = await runtime.executeTool({ ...PROJECT, callId: "look", value: { node: "web.output.dom-capture_snapshot", parameters: {} } });
  assert.equal(result.actionability, undefined);
});

test("central producers and thrown refusals drop malformed or private optional metadata before raw serialization", () => {
  const evidence = { actual: "existing evidence" };
  for (const actionability of [{ actionable: true, text: "private_actionability" }, { actionable: false }, undefined]) {
    for (const applied of [false, true]) {
      const result = toolExecution(evidence, applied, "actual.result", undefined, undefined, undefined, FAILURE, actionability);
      assert.equal(result.evidence, evidence);
      assert.equal(result.effectApplied, applied);
      assert.equal(result.actionability, undefined);
      assert.equal(result.failure?.effect, "ambiguous");
      assert.doesNotMatch(JSON.stringify(result), /private_actionability/u);
    }
    const error = new RecoverableToolRejection("needs_person", undefined, undefined, true, FAILURE, actionability);
    assert.equal(error.actionability, undefined);
    assert.equal(error.personNeeded, true);
    assert.equal(error.failure?.effect, "ambiguous");
    assert.doesNotMatch(JSON.stringify(error), /private_actionability/u);
  }
});

test("a malformed browser measurement drops alone from an actual replay before any raw tool serializer", async () => {
  const source = site(true);
  source.measure({ actionable: false, cause: "covered", private: "private_actionability" });
  const runtime = createWebAutomationLlmEvidenceRuntime(source.gateway);
  const result = await runtime.executeTool({
    ...PROJECT, callId: "malformed", permission: async () => ({ permitted: true as const }),
    value: { replay: "step", node: "web.output.dom-click", parameters: { selector: "#save" }, consequences: [] }
  });
  assert.equal(source.calls(), 1);
  assert.equal(result.effectApplied, true);
  assert.equal(result.actionability, undefined);
  assert.equal(result.failure, undefined);
  assert.ok(result.evidence);
  assert.doesNotMatch(JSON.stringify(result), /private_actionability/u);
});

test("a fresh second press clears the first measurement and optional getters cannot erase a successful action", async () => {
  for (const accessor of [false, true]) {
    let clicks = 0;
    let getters = 0;
    const runtime = createWebAutomationLlmEvidenceRuntime({
      eligibleSessionIds: () => ["session.one"],
      executeAction: async (_session, command) => {
        if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: {
          url: "https://fixture.test/work", title: "Work", interactiveElements: [{ tagName: "button", selector: "#save", visibleText: accessor && clicks > 0 ? "Saved" : "Save", attributes: { type: "button" } }]
        } } };
        clicks += 1;
        const payload: JsonObject = clicks === 1 ? { actionability: { actionable: true } } : {};
        if (accessor) Object.defineProperty(payload, "actionability", {
          enumerable: true,
          get() {
            getters += 1;
            throw new Error("private optional getter");
          }
        });
        return { status: "succeeded", payload };
      }
    });
    const looked = await runtime.executeTool({ ...PROJECT, callId: "look", value: { node: "web.output.dom-capture_snapshot", parameters: {} } });
    const result = await runtime.executeTool({
      ...PROJECT, callId: "click", permission: async () => ({ permitted: true as const }),
      value: { node: "web.output.dom-click", parameters: { target: { handle: shownHandle(looked.evidence, "Save") } }, consequences: [] }
    });
    assert.equal(result.effectApplied, true);
    assert.equal(result.resultCode, "web.action.succeeded");
    assert.equal(result.actionability, undefined);
    assert.equal(getters, 0);
    assert.equal(clicks, accessor ? 1 : 2);
  }
});

test("a post-action capture refusal cannot substitute its unacted control for an already successful node", async () => {
  let acted = false;
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_session, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") {
        acted = true;
        return { status: "succeeded", payload: { actionability: { actionable: true } } };
      }
      if (acted) return {
        status: "failed", failure: OBSERVATION_FAILURE,
        payload: { actionability: { actionable: false, cause: "hidden" } }
      };
      return { status: "succeeded", payload: { snapshot: { url: "https://fixture.test/work", title: "Work", interactiveElements: [{ tagName: "button", selector: "#save", visibleText: "Save" }] } } };
    }
  });
  const looked = await runtime.executeTool({ ...PROJECT, callId: "look", value: { node: "web.output.dom-capture_snapshot", parameters: {} } });
  const result = await runtime.executeTool({
    ...PROJECT, callId: "click", permission: async () => ({ permitted: true as const }),
    value: { node: "web.output.dom-click", parameters: { target: { handle: shownHandle(looked.evidence, "Save") } }, consequences: [] }
  });
  assert.equal(result.effectApplied, false);
  assert.equal(result.personNeeded, true);
  assert.equal(result.failure, undefined);
  assert.deepEqual(result.actionability, { actionable: true });
});

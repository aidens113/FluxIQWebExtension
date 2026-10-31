import assert from "node:assert/strict";
import test from "node:test";
import { AutomationStudioHarnessOptionRegistry, type AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../../constants";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../../failure";
import { actAndCapture, type WebLlmEvidenceGateway, type WebLlmEvidenceToolExecution } from "../../capture";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSnapshotBinding } from "../../sanitize";
import { RecoverableToolRejection } from "../../tool-rejection";
import { createWebLlmExtractionHandles } from "../../structure";
import { webAutomationRecoveryHarnessOptionBundle } from "..";

const REQUEST = { projectId: "project.one", flowId: "flow.one", callId: "call.action", toolId: "web.recovery.press", value: {} };
const MEASURED: JsonObject = { actionable: true };
const OBSERVATION_FAILURE: AutomationStudioFailureRecord = {
  category: "user_intervention_required", code: WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED, retryable: false, stage: "execution", effect: "unacted"
};

function laboratory(kind: "button" | "checkbox" | "field" | "select", facts: Array<JsonObject | undefined> = [MEASURED], failAfter = false) {
  let acts = 0;
  let location = "https://example.test/start";
  const retained: WebLlmSnapshotBinding[] = [];
  const snapshot = (): JsonObject => ({
    url: location, title: "Fixture",
    interactiveElements: [
      { tagName: kind === "button" ? "button" : kind === "select" ? "select" : "input", selector: "#control", name: "Continue", role: kind === "checkbox" ? "checkbox" : kind === "button" ? "button" : kind === "select" ? "combobox" : "textbox", inputType: kind === "checkbox" ? "checkbox" : "text" },
      { tagName: "button", selector: "#state", name: acts > 0 ? "Changed" : "Initial" }
    ]
  });
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_session, command) => {
      if (command.actionType === "web.dom.capture_snapshot") {
        if (failAfter && acts > 0) return {
          status: "failed", failure: OBSERVATION_FAILURE,
          payload: { actionability: { actionable: false, cause: "hidden" } }
        };
        return { status: "succeeded", payload: { snapshot: snapshot() } };
      }
      const actionability = facts[Math.min(acts, facts.length - 1)];
      acts += 1;
      if (command.actionType === "web.browser.navigate" && typeof command.parameters.url === "string") {
        location = command.parameters.url;
      }
      return { status: "succeeded", payload: actionability === undefined ? {} : { actionability } };
    }
  };
  const registry = new AutomationStudioHarnessOptionRegistry();
  registry.register(webAutomationRecoveryHarnessOptionBundle({
    gateway, scopePolicy: { kind: "same_scope" }, retainSelectors: (binding) => { retained.push(binding); },
    extractionHandles: createWebLlmExtractionHandles(), sleep: async () => {}
  }));
  let sequence = 0;
  const run = async (optionId: string, value: JsonObject): Promise<WebLlmEvidenceToolExecution> =>
    await registry.execute({ ...REQUEST, callId: `call.${++sequence}`, optionId, value }, {
      scope: { kind: "domain", domainId: WEB_AUTOMATION_DOMAIN_ID }, stage: "gather", allowSideEffectsWithoutPolicy: true
    }) as WebLlmEvidenceToolExecution;
  return { gateway, run, retained, acts: () => acts, current: () => sanitizeWebLlmSnapshotWithBindings(snapshot()) };
}

test("recovery press, text entry, select and navigation retain per-call controls without putting them on pages", async () => {
  for (const kind of ["button", "field", "select"] as const) {
    const lab = laboratory(kind);
    const looked = await lab.run("web.recovery.inspect", {});
    assert.equal(looked.actionability, undefined);
    const result = await lab.run(kind === "button" ? "web.recovery.press" : "web.recovery.enter_field", kind === "button"
      ? { target: "t1", consequences: [] }
      : { target: "t1", value: "chosen" });
    assert.equal(result.effectApplied, true);
    assert.deepEqual(result.actionability, MEASURED);
    assert.doesNotMatch(JSON.stringify(result.evidence), /"actionability"/u);
    assert.equal(lab.retained.some((page) => "actionability" in page), false);
  }
  const lab = laboratory("button");
  const moved = await lab.run("web.recovery.navigate_in_scope", { url: "https://example.test/next" });
  assert.equal(moved.effectApplied, true);
  assert.deepEqual(moved.actionability, MEASURED);
});

test("a fresh checkbox restoration replaces the first click measurement even when its own fact is absent", async () => {
  const lab = laboratory("checkbox", [MEASURED, undefined]);
  await lab.run("web.recovery.inspect", {});
  const pressed = await lab.run("web.recovery.press", { target: "t1", consequences: [] });
  assert.equal(lab.acts(), 2);
  assert.equal(pressed.effectApplied, true);
  assert.equal(pressed.actionability, undefined);
  assert.equal(lab.retained.some((page) => "actionability" in page), false);
});

test("a successful action's later observation cannot become unacted or transient evidence about that action", async () => {
  const lab = laboratory("button", [MEASURED], true);
  await assert.rejects(actAndCapture(lab.gateway, "session.one", REQUEST, "web.dom.click", { selector: "#control" }, lab.current()), (error: unknown) => {
    assert.ok(error instanceof RecoverableToolRejection);
    assert.equal(error.code, "needs_person");
    assert.equal(error.personNeeded, true);
    assert.equal(error.failure, undefined);
    assert.deepEqual(error.actionability, MEASURED, "the later capture's negative measurement cannot replace the action's fact");
    return true;
  });
  const throughHarness = laboratory("button", [MEASURED], true);
  await throughHarness.run("web.recovery.inspect", {});
  const result = await throughHarness.run("web.recovery.press", { target: "t1", consequences: [] });
  assert.equal(result.effectApplied, false, "the existing refusal flag is retained");
  assert.equal(result.personNeeded, true);
  assert.equal(result.failure, undefined);
  assert.deepEqual(result.actionability, MEASURED);
});

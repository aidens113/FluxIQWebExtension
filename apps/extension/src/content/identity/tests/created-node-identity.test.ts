// A Flow node created from a plan handle, scored by the page the way a
// recorded one is.
//
// The live `instruction-only-form` creation run (`run-mu4t20d1-93b60760`)
// failed its first step: "refused input[data-testid="instruction-name"]
// scoring 0.17 with nothing the recording named agreeing exactly". The created
// type node carried a selector and no element, so Core's element-target
// normalizer read its `text` -- the words to type -- as the input's visible
// text, and the veto refused the right input for not showing them. The domain
// now writes `parameters.element` from the element the model was shown
// (`domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts`).
//
// Each row goes the whole way: the fixture's snapshot is inspected through the
// domain's evidence runtime, a plan handle is resolved, the node's parameters
// pass through Core's normalizer, the wire target and the gateway mapping, and
// the `command.element` the page would read is scored here by the same `veto.ts`
// and `score.ts` the resolver uses. The candidates are shaped as
// `candidateFingerprint` describes the fixture's controls
// (`apps/scenario-lab/src/scenarios/instruction-only-form/scenario.ts`); nothing
// on this path reads the element, so it is a marker, as in `veto.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_INSPECT_TOOL_ID } from "@fluxiq-web-extension/domain";
import { outputTargetFromPayload, webAutomationActionFromGatewayCommand, webAutomationOutputNodeId } from "@fluxiq-web-extension/domain/client";
import type { TargetCandidate } from "../candidates";
import { TARGET_SCORE_FLOOR, scoreTargetCandidates, type RecordedIdentity } from "../score";
import { vetoCandidate } from "../veto";

const PAGE_URL = "http://127.0.0.1:4100/instruction-only-form";

/** The fixture's controls as `describe-element.ts` puts them in a snapshot. */
const DESCRIBED: JsonObject[] = [
  { tagName: "button", selector: '[data-testid="instruction-introduce-target-drift"]', visibleText: "Introduce target drift", text: "Introduce target drift", accessibleName: "Introduce target drift", implicitRole: "button", testId: "instruction-introduce-target-drift", attributes: { "data-testid": "instruction-introduce-target-drift", type: "button" }, context: { landmark: "main" } },
  { tagName: "input", selector: '[data-testid="instruction-name"]', inputType: "text", accessibleName: "Name", label: "Name", implicitRole: "textbox", testId: "instruction-name", attributes: { name: "name", "data-testid": "instruction-name", autocomplete: "off" }, context: { landmark: "main" } },
  { tagName: "select", selector: '[data-testid="instruction-plan"]', visibleText: "Starter Team Enterprise", text: "Starter Team Enterprise", accessibleName: "Plan", label: "Plan", implicitRole: "combobox", testId: "instruction-plan", attributes: { name: "plan", "data-testid": "instruction-plan" }, context: { landmark: "main" } },
  { tagName: "button", selector: '[data-testid="instruction-submit"]', visibleText: "Submit", text: "Submit", accessibleName: "Submit", implicitRole: "button", testId: "instruction-submit", attributes: { type: "submit", "data-testid": "instruction-submit" }, context: { landmark: "main" } }
];

type Fingerprint = Omit<TargetCandidate["fingerprint"], "candidateId">;
function candidate(candidateId: string, fingerprint: Fingerprint): TargetCandidate {
  return { element: { candidateId } as unknown as Element, fingerprint: Object.assign({ candidateId }, fingerprint) };
}
const bounds = { x: 10, y: 10, width: 200, height: 24 };

/** The same controls as `candidateFingerprint` describes them live. */
const NAME_INPUT = candidate("instruction-name", { tagName: "input", role: "textbox", testId: "instruction-name", selector: '[data-testid="instruction-name"]', accessibleName: "Name", label: "Name", bounds, isVisibleOnViewport: true });
const PLAN_SELECT = candidate("instruction-plan", { tagName: "select", role: "combobox", testId: "instruction-plan", selector: '[data-testid="instruction-plan"]', visibleText: "Starter Team Enterprise", accessibleName: "Plan", label: "Plan", bounds, isVisibleOnViewport: true });
const SUBMIT = candidate("instruction-submit", { tagName: "button", role: "button", testId: "instruction-submit", selector: '[data-testid="instruction-submit"]', visibleText: "Submit", accessibleName: "Submit", bounds, isVisibleOnViewport: true });
const DRIFT_BUTTON = candidate("instruction-introduce-target-drift", { tagName: "button", role: "button", testId: "instruction-introduce-target-drift", selector: '[data-testid="instruction-introduce-target-drift"]', visibleText: "Introduce target drift", accessibleName: "Introduce target drift", bounds, isVisibleOnViewport: true });
/** A different text field a drifted page could put under the same selector. */
const EMAIL_INPUT = candidate("instruction-email", { tagName: "input", role: "textbox", testId: "instruction-email", selector: '[data-testid="instruction-email"]', accessibleName: "Email", label: "Email", bounds, isVisibleOnViewport: true });

async function resolvedNode(nodeDefinitionId: string, parameters: JsonObject): Promise<JsonObject> {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => command.actionType === "web.dom.capture_snapshot"
      ? { status: "succeeded", payload: { snapshot: { url: PAGE_URL, title: "Instruction-only automation", interactiveElements: DESCRIBED } } }
      : { status: "succeeded" }
  });
  await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.inspect", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} });
  // A press step says what it would lastingly do; these rows are about identity, so they say it does nothing.
  const resolution = await runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId, parameters, declaredConsequences: [] });
  assert.equal(resolution.status, "resolved", JSON.stringify(resolution));
  return resolution.status === "resolved" ? resolution.parameters : {};
}

/** What the page reads for these node parameters, through Core's normalizer, the wire target and the gateway mapping. */
function pageIdentity(actionType: string, parameters: JsonObject): RecordedIdentity {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId: "command.one", actionType, parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  assert.equal("status" in command, false, "the command is dispatched");
  const element = (command as { element?: RecordedIdentity }).element;
  assert.ok(element, "the command carries an identity");
  return element;
}

const TYPE_PARAMETERS: JsonObject = { selector: { handle: "target.2" }, text: "Ada Lovelace" };

test("the live failure, reproduced: a type node with no element is refused on the right input", () => {
  const identity = pageIdentity("web.dom.type", { selector: '[data-testid="instruction-name"]', text: "Ada Lovelace" });
  assert.equal(identity.visibleText, "Ada Lovelace", "Core read the typed text as the input's identity");
  const verdict = vetoCandidate(identity, NAME_INPUT);
  assert.equal(verdict.refusedBecause, "uncorroborated");
});

test("a created type node's identity is accepted on its own input, above the floor, and refused on another", async () => {
  const identity = pageIdentity("web.dom.type", await resolvedNode(webAutomationOutputNodeId("web.dom.type"), TYPE_PARAMETERS));
  assert.equal(identity.visibleText, undefined);
  assert.equal(identity.accessibleName, "Name");

  // Level 1: the selector found the input, and the veto lets it through.
  const accepted = vetoCandidate(identity, NAME_INPUT);
  assert.equal(accepted.refusedBecause, undefined);
  assert.ok(accepted.measurement && accepted.measurement.score >= TARGET_SCORE_FLOOR, `score ${accepted.measurement?.score}`);

  // The same selector landing on a different control is still refused.
  for (const wrong of [PLAN_SELECT, EMAIL_INPUT, SUBMIT]) {
    const refused = vetoCandidate(identity, wrong);
    assert.ok(refused.refusedBecause, `${wrong.fingerprint.candidateId} must be refused, scored ${refused.measurement?.score}`);
  }

  // Level 2: with the selector gone, scoring the family picks the input, and only the input.
  const scored = scoreTargetCandidates(identity, [EMAIL_INPUT, NAME_INPUT]);
  assert.equal(scored.outcome, "resolved");
  assert.equal(scored.outcome === "resolved" && scored.chosen.score.candidate.candidateId, "instruction-name");
  assert.ok(scored.outcome === "resolved" && scored.chosen.score.normalizedScore >= TARGET_SCORE_FLOOR);
  assert.notEqual(scoreTargetCandidates(identity, [EMAIL_INPUT]).outcome, "resolved", "a lone wrong input is not chosen");
});

test("a created click node's identity is accepted on its own button and refused on another", async () => {
  const identity = pageIdentity("web.dom.click", await resolvedNode(webAutomationOutputNodeId("web.dom.click"), { selector: { handle: "target.4" } }));
  assert.equal(identity.accessibleName, "Submit");
  const accepted = vetoCandidate(identity, SUBMIT);
  assert.equal(accepted.refusedBecause, undefined);
  assert.ok(accepted.measurement && accepted.measurement.score >= TARGET_SCORE_FLOOR, `score ${accepted.measurement?.score}`);
  const refused = vetoCandidate(identity, DRIFT_BUTTON);
  assert.ok(refused.refusedBecause, `the drift button must be refused, scored ${refused.measurement?.score}`);
  const scored = scoreTargetCandidates(identity, [DRIFT_BUTTON, SUBMIT]);
  assert.equal(scored.outcome === "resolved" && scored.chosen.score.candidate.candidateId, "instruction-submit");
});

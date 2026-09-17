// A repair of a web action, taken through Core's own proposal step with this
// domain as the validator. The unit tests beside this file prove what the
// domain answers; these prove what that answer does once Core has it: a
// refused repair leaves no proposal and a reason a reader can match on, and an
// accepted one is proposed carrying the fingerprint the domain resolved. The
// recorded case is the live repair lane's: Core names the failed action by
// the output its policy node dispatches.

import assert from "node:assert/strict";
import test from "node:test";
import { validateWebRuntimeTargetOverrideEvidence } from "..";
import { sanitizeWebLlmSnapshotWithBindings } from "../sanitize";
import {
  proposeAutomationStudioRuntimeTargetOverride,
  type AutomationStudioAdaptationPolicy,
  type AutomationStudioFlowDocument,
  type AutomationStudioRuntimeTargetOverrideTarget
} from "fluxiq/automation-studio";

const target = (handles: Record<string, string>): AutomationStudioRuntimeTargetOverrideTarget => ({ handles });
const NOT_REPAIRABLE = { status: "absent", reason: "action_not_repairable" } as const;

/** A form: a text field, a dropdown and one button. */
const formBinding = (): ReturnType<typeof sanitizeWebLlmSnapshotWithBindings> => sanitizeWebLlmSnapshotWithBindings({
  url: "https://example.test/form",
  interactiveElements: [
    { tagName: "textarea", selector: "#name", name: "Name" },
    { tagName: "select", selector: "#plan", name: "Plan", options: [{ value: "team", label: "Team" }] },
    { tagName: "button", selector: "#unique", name: "Unique" },
  ],
});

/** A catalogue: a list row and a price inside it -- what a list extraction's repair used to name. */
const catalogueBinding = (): ReturnType<typeof sanitizeWebLlmSnapshotWithBindings> => sanitizeWebLlmSnapshotWithBindings({
  url: "https://example.test/catalogue",
  interactiveElements: [
    { tagName: "a", selector: ".row:nth-child(1)", name: "Widget", context: { listPosition: { index: 1, total: 2 } } },
    { tagName: "span", selector: ".row:nth-child(1) .price", name: "10.00" },
  ],
});

type FlowNode = AutomationStudioFlowDocument["nodes"][number];

const oneActionFlow = (node: FlowNode): AutomationStudioFlowDocument => ({
  schemaVersion: "0.1",
  flowId: "flow.repair",
  ownerKind: "routine",
  ownerId: "routine.repair",
  name: "Repair",
  createdAt: 1,
  updatedAt: 1,
  nodes: [
    node,
    { id: "end", definitionId: "builtin.control.end", parameterValues: { resultStatus: "success" } },
  ],
  edges: [{ id: `${node.id}.end`, sourceNodeId: node.id, sourcePortId: "success", targetNodeId: "end", targetPortId: "in" }],
});

// A recorded action as a recording writes it: Core's generic policy node,
// with the web output it dispatches named in its parameters.
const recordedNode = (id: string, outputId: string): FlowNode => ({
  id,
  definitionId: "builtin.policy.action",
  parameterValues: { outputId, parameters: { selector: "#recorded", element: { tagName: "button", accessibleName: "Unique" } } },
});

/** A created node, which holds its target the way a bootstrap wrote it. */
const createdNode = (id: string, definitionId: string): FlowNode => ({
  id,
  definitionId,
  parameterValues: { element: { tagName: "button", accessibleName: "Unique" } },
});

const repairPolicy: AutomationStudioAdaptationPolicy = {
  schemaVersion: "0.1",
  policyId: "policy.repair",
  scope: { kind: "flow", flowId: "flow.repair" },
  preset: "repair",
  proposalMode: "manual",
  allowRuntimeRecovery: true,
  allowCreateRecoveryPaths: true,
  allowModifySubflows: true,
  allowCreateSubflows: true,
  allowModifyRouter: true,
  allowModifyExpectations: true,
  allowModifyActionTargets: true,
  allowDeleteOrDisableBehavior: false,
  allowExternalSideEffects: false,
  requireApprovalForDestructiveChanges: true,
  requireApprovalForExternalSideEffects: true,
  createdAt: 1,
  updatedAt: 1,
};

/** The failure a target override is Core's answer to, which is what these fixtures fail with. */
type FailureRecord = NonNullable<Parameters<typeof proposeAutomationStudioRuntimeTargetOverride>[0]["failedAttempt"]["failure"]>;

const TARGET_NOT_FOUND: FailureRecord = { category: "target_not_found", code: "web.target.not_found", retryable: true };

const proposeThroughCore = (
  binding: ReturnType<typeof sanitizeWebLlmSnapshotWithBindings>,
  node: FlowNode,
  proposed: AutomationStudioRuntimeTargetOverrideTarget,
  failure: FailureRecord = TARGET_NOT_FOUND
): ReturnType<typeof proposeAutomationStudioRuntimeTargetOverride> => proposeAutomationStudioRuntimeTargetOverride({
  projectId: "project.repair",
  flowId: "flow.repair",
  runId: "run.failed",
  flow: oneActionFlow(node),
  failedAttempt: { attemptId: `${node.id}.attempt.1`, nodeId: node.id, definitionId: node.definitionId, startedAt: 1, finishedAt: 2, status: "failed", route: "failed", inputs: {}, outputs: {}, effects: [], failure },
  patch: { kind: "temporary_target_override", targetNodeId: node.id, target: proposed, reason: "Re-point the failed action." },
  policy: repairPolicy,
  proposalMode: "manual",
  now: () => 10,
  validateTargetOverrideEvidence: (candidate, failedAction) => validateWebRuntimeTargetOverrideEvidence(binding.evidence, candidate, failedAction, binding.selectors),
});

test("Core keeps no proposal for a list extraction repair, and records why", () => {
  const proposed = target({ item: "target.1", "field.price": "target.2" });
  const result = proposeThroughCore(catalogueBinding(), { id: "rows", definitionId: "web.output.dom-extract_list" }, proposed);
  assert.equal(result.preflight.ok, false);
  assert.equal(result.preflight.issues.length, 1);
  assert.match(result.preflight.issues[0]!, /\(action_not_repairable\)\.$/u);
  assert.deepEqual(result.metadata, { proposalOnly: true, executed: false, targetOverrideRefusal: NOT_REPAIRABLE });
  assert.equal(result.adaptation, undefined);
  assert.equal(result.changeProposal, undefined);
  // Nothing the domain resolved replaced what the model wrote.
  assert.deepEqual(result.patch, { kind: "temporary_target_override", targetNodeId: "rows", target: proposed, reason: "Re-point the failed action." });
  // A recorded extraction, named only by the output Core reads off the node, the same.
  const recorded = proposeThroughCore(catalogueBinding(), recordedNode("rows", "web.dom.extract_list"), proposed);
  assert.equal(recorded.preflight.ok, false);
  assert.deepEqual(recorded.metadata, { proposalOnly: true, executed: false, targetOverrideRefusal: NOT_REPAIRABLE });
  assert.equal(recorded.changeProposal, undefined);
});

test("Core proposes a recorded click repair, from the output the recording dispatches", () => {
  const result = proposeThroughCore(formBinding(), recordedNode("save", "web.dom.click"), target({ element: "target.3" }));
  assert.deepEqual(result.preflight, { ok: true, issues: [], requiresExternalSideEffectApproval: true });
  assert.equal(result.metadata?.targetResolution, "resolved");
  assert.deepEqual(result.patch.kind === "temporary_target_override" ? result.patch.target : undefined, {
    handles: { element: "target.3" },
    handleResolution: "named",
    tagName: "button",
    accessibleName: "Unique",
    selector: "#unique",
  });
  assert.notEqual(result.adaptation, undefined);
  assert.notEqual(result.changeProposal, undefined);
});

test("Core still proposes a click repair, carrying the flat fingerprint the domain resolved", () => {
  const result = proposeThroughCore(formBinding(), createdNode("submit", "web.output.dom-click"), target({ element: "target.3" }));
  assert.deepEqual(result.preflight, { ok: true, issues: [], requiresExternalSideEffectApproval: true });
  assert.equal(result.metadata?.targetResolution, "resolved");
  assert.deepEqual(result.patch.kind === "temporary_target_override" ? result.patch.target : undefined, {
    handles: { element: "target.3" },
    handleResolution: "named",
    tagName: "button",
    accessibleName: "Unique",
    selector: "#unique",
  });
  assert.notEqual(result.adaptation, undefined);
  assert.notEqual(result.changeProposal, undefined);
});

// The failure classes a target override cannot fix: the guard refused the
// destination, the page was retired, the record is locked. Core knows the class
// and the domain does not, so Core refuses before the domain is asked -- which
// is what these two live tasks needed (`failure-surfaces-refuse-guarded-link`,
// `navigation-refuse-retired-page`, live repair campaign 2026-09-17).
test("Core keeps no proposal for a failure a different target cannot fix, and never asks the domain", () => {
  for (const category of ["navigation_unexpected", "blocked_by_capability_or_policy", "auth_required"] as const) {
    const result = proposeThroughCore(formBinding(), recordedNode("save", "web.dom.click"), target({ element: "target.3" }), { category, code: `web.${category}`, retryable: false });
    assert.equal(result.preflight.ok, false, category);
    assert.match(result.preflight.issues[0]!, /\(failure_not_target_repairable\)\.$/u, category);
    assert.equal(result.adaptation, undefined, category);
    assert.equal(result.changeProposal, undefined, category);
  }
});

// The domain's own refusal, carried through Core the same way: a control the
// model was shown, that a click can use, and that is not the one the step acted
// on. Before this the proposal was saved and the run recorded a repair.
test("Core keeps no proposal for a repair naming another control, and records which case it was", () => {
  const result = proposeThroughCore(formBinding(), recordedNode("save", "web.dom.click"), target({ element: "target.1" }));

  assert.equal(result.preflight.ok, false);
  assert.match(result.preflight.issues[0]!, /\(target_not_equivalent\)\.$/u);
  assert.deepEqual(result.metadata, { proposalOnly: true, executed: false, targetOverrideRefusal: { status: "absent", reason: "target_not_equivalent" } });
  assert.equal(result.adaptation, undefined);
  assert.equal(result.changeProposal, undefined);
});

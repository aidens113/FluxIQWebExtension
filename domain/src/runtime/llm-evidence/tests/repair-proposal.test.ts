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
  parameterValues: { outputId, parameters: { selector: "#recorded" } },
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

const proposeThroughCore = (
  binding: ReturnType<typeof sanitizeWebLlmSnapshotWithBindings>,
  node: FlowNode,
  proposed: AutomationStudioRuntimeTargetOverrideTarget
): ReturnType<typeof proposeAutomationStudioRuntimeTargetOverride> => proposeAutomationStudioRuntimeTargetOverride({
  projectId: "project.repair",
  flowId: "flow.repair",
  runId: "run.failed",
  flow: oneActionFlow(node),
  failedAttempt: { attemptId: `${node.id}.attempt.1`, nodeId: node.id, definitionId: node.definitionId, startedAt: 1, finishedAt: 2, status: "failed", route: "failed", inputs: {}, outputs: {}, effects: [] },
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
  const result = proposeThroughCore(formBinding(), { id: "submit", definitionId: "web.output.dom-click" }, target({ element: "target.3" }));
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

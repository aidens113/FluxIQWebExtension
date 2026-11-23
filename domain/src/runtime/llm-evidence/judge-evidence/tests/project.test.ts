import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioActionPermissionDenied, automationStudioFlowLessJudgedSummary, automationStudioJudgeEvidenceCapability, automationStudioLlmEvidenceRuntimeBindingChecked, automationStudioResultRunTrail, automationStudioResultSemanticTrail, automationStudioResultTrailStepOfCall } from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime } from "../../tools";
import { WEB_LLM_DENIED_EVIDENCE_KEYS } from "../../denied-keys";
import { projectWebJudgeEvidence, webJudgeStateFacts } from "..";
import type { WebLlmPageEvidence } from "../../sanitize";
import { present } from "../../present";
import { webObservationNodeId } from "../../node-run";

const schema: JsonObject = { schemaVersion: "0.1", fields: [
  { id: "id", label: "Id", valueType: "string", semanticType: "id" },
  { id: "price", label: "Price", valueType: "string", semanticType: "currency" },
  { id: "promoted", label: "Promoted", valueType: "boolean", semanticType: "flag", mark: "badge" },
  { id: "private", label: "Private", valueType: "string", handling: "exclude" }
], primaryKey: ["id"] };
const rows = [{ id: "Original item", price: "$12.50", promoted: false, private: "EXCLUDED_CELL_SENTINEL" }];

type SemanticOptions = NonNullable<Parameters<typeof automationStudioResultTrailStepOfCall>[3]>;
type DeclaredBinding = { judgeEvidenceVersion?: 1 | undefined; projectJudgeEvidence?: SemanticOptions["projectJudgeEvidence"]; deniedEvidenceKeys: readonly string[] };

/** Core's semantic options from an actual binding's declarations, every key written by name. */
function semanticOptions(binding: DeclaredBinding): SemanticOptions {
  return present<SemanticOptions>({ projectJudgeEvidence: binding.projectJudgeEvidence, judgeEvidenceVersion: binding.judgeEvidenceVersion, deniedEvidenceKeys: binding.deniedEvidenceKeys, legacySource: undefined, alreadyProjected: undefined, invalidFormat: undefined, resultEvidence: undefined });
}

function runtime() {
  return createWebAutomationLlmEvidenceRuntime({ eligibleSessionIds: () => ["session"], executeAction: async () => { throw new Error("this unit binding must not dispatch a capture or action"); } });
}

test("the actual web runtime binding explicitly supplies its projector and current privacy declaration", () => {
  const binding = runtime();
  assert.equal(binding.deniedEvidenceKeys, WEB_LLM_DENIED_EVIDENCE_KEYS);
  assert.equal(binding.projectJudgeEvidence, projectWebJudgeEvidence);
  assert.equal(binding.judgeEvidenceVersion, 1);
  const checked = automationStudioLlmEvidenceRuntimeBindingChecked(binding);
  assert.equal(checked.judgeEvidenceVersion, 1);
  assert.deepEqual(automationStudioJudgeEvidenceCapability(checked), { judgeEvidenceVersion: 1 });
  assert.deepEqual(checked.deniedEvidenceKeys, WEB_LLM_DENIED_EVIDENCE_KEYS);
  assert.deepEqual(checked.projectJudgeEvidence!({ source: "state", evidence: { evidence: { judgeState: { version: 1, location: "https://example.test", controls: [], notices: [], marks: [] } } } }).missing, undefined);
  const answer = { kind: "llm_evidence_tool_execution", effectApplied: false, resultCode: "web.inspect.succeeded", recordSchema: schema, evidence: { ok: true, status: "succeeded", page: "RAW_PAGE_SENTINEL", read: { extracted: rows } } };
  const before = structuredClone(answer);
  const options = semanticOptions(checked);
  const step = automationStudioResultTrailStepOfCall({ callId: "read.1", toolId: "core.run_node", value: { node: "web.output.dom-extract_list", parameters: {} } }, answer, undefined, options);
  const compact = automationStudioResultSemanticTrail(automationStudioResultRunTrail([step], checked.deniedEvidenceKeys).trail, options);
  const found = compact.trail!.entries[0]!.found as JsonObject;
  const facts = found.evidence as JsonObject;
  assert.deepEqual((facts.read as JsonObject).fields, ["id", "price", "promoted"]);
  assert.deepEqual((facts.read as JsonObject).primaryKey, ["id"]);
  assert.equal((facts.read as JsonObject).observedRows, 1);
  assert.deepEqual(facts.source, { callId: "read.1" });
  assert.deepEqual(compact.projection.missing, []);
  assert.doesNotMatch(JSON.stringify(compact), /RAW_PAGE_SENTINEL|EXCLUDED_CELL_SENTINEL|"private"|"extracted"/u);
  assert.deepEqual(answer, before);
});

test("a known empty privacy declaration is explicit and an unknown resumed policy fails closed", () => {
  const actual = runtime();
  const binding = { ...actual, deniedEvidenceKeys: [] as readonly string[] };
  const step = automationStudioResultTrailStepOfCall({ callId: "action.1", toolId: "core.run_node", value: { node: "web.output.dom-click" } }, { kind: "llm_evidence_tool_execution", effectApplied: true, resultCode: "web.action.succeeded", evidence: { status: "succeeded", changed: ["The selected state changed"], page: "RAW_PAGE_SENTINEL" } }, undefined, semanticOptions(binding));
  const trail = automationStudioResultRunTrail([step], binding.deniedEvidenceKeys).trail;
  assert.deepEqual(automationStudioResultSemanticTrail(trail, binding).projection.missing, []);
  const unknown = automationStudioResultSemanticTrail(trail, { projectJudgeEvidence: binding.projectJudgeEvidence, deniedEvidenceKeys: undefined });
  assert.deepEqual(unknown.projection.missing, [{ source: "trail", codes: ["judge_evidence.denied_keys_missing"] }]);
  assert.doesNotMatch(JSON.stringify(unknown), /RAW_PAGE_SENTINEL|selected state changed/u);
});

test("the real web projector retains an unmatched valid semantic look and only omits a uniquely represented Core source", () => {
  const binding = automationStudioLlmEvidenceRuntimeBindingChecked(runtime());
  const options = semanticOptions(binding);
  const state = { version: 1, location: "https://example.test/settings", controls: [{ tag: "input", name: "Updates", checked: false }, { tag: "input", name: "Comment", value: "" }], notices: [{ tag: "p", role: "status", text: "Preference removed" }], marks: [] };
  const look = { where: state.location, found: JSON.stringify({ judgeState: state }), callId: "core.look.actual" };
  const step = automationStudioResultTrailStepOfCall({ callId: look.callId, toolId: "core.run_node", value: { node: webObservationNodeId()! } }, { kind: "llm_evidence_tool_execution", effectApplied: false, evidence: { judgeState: state, page: "RAW_PAGE_SENTINEL" } }, undefined, options);
  const source = { instructions: "Read the preference state", acts: [], rows: { totalRows: 1, truncated: false, columns: [{ id: "name", label: "Name" }], rows: [{ name: "Original row" }] }, looked: [look] };
  const unmatched = automationStudioFlowLessJudgedSummary({ ...source, trail: [] }, binding.deniedEvidenceKeys, binding).sent as unknown as JsonObject;
  assert.deepEqual(((unmatched.looked as JsonObject[])[0]!.evidence as JsonObject).state, state);
  assert.deepEqual((unmatched.evidenceProjection as JsonObject).missing, []);
  const unique = automationStudioFlowLessJudgedSummary({ ...source, trail: [step] }, binding.deniedEvidenceKeys, binding).sent as unknown as JsonObject;
  assert.equal(unique.looked, undefined);
  assert.deepEqual((unique.evidenceProjection as JsonObject).missing, []);
  const duplicate = automationStudioFlowLessJudgedSummary({ ...source, trail: [step, { ...step }] }, binding.deniedEvidenceKeys, binding).sent as unknown as JsonObject;
  assert.equal((duplicate.looked as JsonObject[]).length, 1);
  assert.deepEqual(((duplicate.looked as JsonObject[])[0]!.evidence as JsonObject).state, state);
  const opaque = automationStudioFlowLessJudgedSummary({ ...source, trail: [], looked: [{ ...look, found: "UNCLASSIFIED_RAW_CAPTURE_SENTINEL" }] }, binding.deniedEvidenceKeys, binding).sent;
  assert.deepEqual(opaque.evidenceProjection?.missing, [{ source: "looked.1", codes: ["web_judge.look_state_missing"] }]);
  assert.doesNotMatch(JSON.stringify([unmatched, unique, duplicate, opaque]), /RAW_PAGE_SENTINEL|UNCLASSIFIED_RAW_CAPTURE_SENTINEL/u);
});

test("explicitly rejected schema/state metadata cannot fall back to an apparently complete capture", () => {
  for (const recordSchema of [null, { schemaVersion: "0.1", fields: [{ id: "value", label: "Value", valueType: "string", semanticType: "unknown" }] }]) {
    const projected = projectWebJudgeEvidence({ source: "call", evidence: { source: { callId: "read.1" }, recordSchema, evidence: { read: { extracted: rows }, page: "RAW_PAGE_SENTINEL" } } });
    assert.deepEqual(projected.missing, ["web_judge.record_schema_invalid"]);
    assert.doesNotMatch(JSON.stringify(projected), /RAW_PAGE_SENTINEL|EXCLUDED_CELL_SENTINEL/u);
  }
  for (const judgeState of [null, { version: 1, location: "https://example.test", controls: [{ tag: "input", value: { snapshot: "RAW_PAGE_SENTINEL" } }], notices: [], marks: [] }]) {
    const projected = projectWebJudgeEvidence({ source: "state", phase: "after", evidence: { evidence: { judgeState, page: "RAW_PAGE_SENTINEL" } } });
    assert.deepEqual(projected.missing, ["web_judge.state_invalid"]);
    assert.doesNotMatch(JSON.stringify(projected), /RAW_PAGE_SENTINEL/u);
  }
});

test("intentional capture omission for a supporting read differs from missing required state evidence", () => {
  const evidence = { evidence: { page: "RAW_PAGE_SENTINEL" } };
  const supporting = projectWebJudgeEvidence({ source: "call", evidence });
  assert.deepEqual(supporting.missing, undefined);
  assert.deepEqual(supporting.evidence, { captureOmitted: true });
  const required = projectWebJudgeEvidence({ source: "state", phase: "after", evidence });
  assert.deepEqual(required.missing, ["web_judge.semantic_state_missing"]);
  assert.doesNotMatch(JSON.stringify(required), /RAW_PAGE_SENTINEL/u);
});

test("false, empty and unavailable state remain distinct, and state facts carry no handles or geometry", () => {
  const evidence: WebLlmPageEvidence = { schemaVersion: "web-llm-evidence.v2", trust: "untrusted-page-evidence", location: "https://example.test/settings", truncated: false, elements: [
    { target: "t1", tag: "input", name: "Updates", checked: false, box: { x: 1, y: 2, width: 30, height: 10 } },
    { target: "t2", tag: "input", name: "Comment", value: "" },
    { target: "t3", tag: "select", name: "Region", selectedValue: "" },
    { target: "t4", tag: "input", name: "Not captured" },
    { target: "t5", tag: "button", name: "Saved", marked: true, attributes: [["aria-pressed", "false"], ["data-layout", "RAW_ATTRIBUTE_SENTINEL"]] },
    { target: "t6", tag: "p", role: "status", text: "Setting removed" },
    { target: "t7", tag: "div", text: "RAW_PAGE_SENTINEL" }
  ] };
  const facts = webJudgeStateFacts(evidence);
  assert.deepEqual(facts.controls, [{ tag: "input", name: "Updates", checked: false }, { tag: "input", name: "Comment", value: "" }, { tag: "select", name: "Region", selectedValue: "" }, { tag: "button", name: "Saved", marked: true, state: { "aria-pressed": "false" } }]);
  assert.deepEqual(facts.notices, [{ tag: "p", role: "status", text: "Setting removed" }]);
  assert.doesNotMatch(JSON.stringify(facts), /RAW_PAGE_SENTINEL|RAW_ATTRIBUTE_SENTINEL|"target"|"box"|Not captured/u);
  const projected = projectWebJudgeEvidence({ source: "state", phase: "after", evidence: { evidence: { judgeState: facts, page: "RAW_PAGE_SENTINEL" } } });
  assert.deepEqual(projected.missing, undefined);
  assert.deepEqual((projected.evidence as JsonObject).state, facts);
});

test("unrelated hidden leaves and unnamed container text are excluded while actual hidden alerts and named empty controls survive", () => {
  const evidence: WebLlmPageEvidence = { schemaVersion: "web-llm-evidence.v2", trust: "untrusted-page-evidence", location: "https://example.test/settings", truncated: false, elements: [
    { target: "t1", tag: "p", hidden: true, text: "UNRELATED_HIDDEN_PAGE_SENTINEL", readable: "UNRELATED_HIDDEN_PAGE_SENTINEL", ownText: "UNRELATED_HIDDEN_PAGE_SENTINEL" },
    { target: "t2", tag: "div", marked: true, readable: "UNNAMED_CONTAINER_SENTINEL", text: "UNNAMED_CONTAINER_SENTINEL" },
    { target: "t3", tag: "input", name: "Note", value: "", hidden: true },
    { target: "t4", tag: "div", role: "alert", hidden: true, text: "The setting was removed" },
    { target: "t5", tag: "p", role: "status", text: "Bearer abcdefghijklmnopqrstuvwxyz123456" }
  ] };
  const original = structuredClone(evidence);
  const facts = webJudgeStateFacts(evidence);
  assert.deepEqual(facts.controls, [{ tag: "input", name: "Note", value: "", hidden: true }]);
  assert.deepEqual((facts.marks as JsonObject[])[0], { tag: "div", marked: true });
  assert.match(JSON.stringify(facts.notices), /The setting was removed/u);
  assert.doesNotMatch(JSON.stringify(facts), /UNRELATED_HIDDEN_PAGE_SENTINEL|UNNAMED_CONTAINER_SENTINEL|abcdefghijklmnopqrstuvwxyz123456/u);
  assert.deepEqual(evidence, original);
});

test("the actual passive binding contributes semantic state from one capture, without additional reads", async () => {
  let calls = 0;
  const binding = createWebAutomationLlmEvidenceRuntime({ eligibleSessionIds: () => ["session"], executeAction: async () => {
    calls += 1;
    return { status: "succeeded", payload: { snapshot: { url: "https://example.test/settings", title: "Settings", interactiveElements: [{ tagName: "input", selector: "#updates", accessibleName: "Updates", inputType: "checkbox", checked: false, attributes: { type: "checkbox", "aria-label": "Updates" } }, { tagName: "p", selector: "#notice", role: "status", visibleText: "Preference removed", attributes: { role: "status" } }] } } };
  } });
  const view = await binding.observeResult!({ projectId: "project", flowId: "flow", callId: "observed", permission: automationStudioActionPermissionDenied });
  assert.ok(view);
  const projected = binding.projectJudgeEvidence!({ source: "state", phase: "after", evidence: { evidence: view } });
  assert.match(JSON.stringify(projected), /"checked":false/u);
  assert.match(JSON.stringify(projected), /Preference removed/u);
  assert.doesNotMatch(JSON.stringify(projected), /"page"|"selector"|"target"|#updates|#notice/u);
  assert.equal(calls, 1);
});

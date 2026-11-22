import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioActionPermissionDenied, automationStudioResultRunTrail, automationStudioResultSemanticTrail, automationStudioResultTrailStepOfCall } from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime } from "../../tools";
import { WEB_LLM_DENIED_EVIDENCE_KEYS } from "../../denied-keys";
import { projectWebJudgeEvidence, webJudgeStateFacts } from "..";
import type { WebLlmPageEvidence } from "../../sanitize";

const schema: JsonObject = { schemaVersion: "0.1", fields: [
  { id: "id", label: "Id", valueType: "string", semanticType: "id" },
  { id: "price", label: "Price", valueType: "string", semanticType: "currency" },
  { id: "promoted", label: "Promoted", valueType: "boolean", semanticType: "flag", mark: "badge" },
  { id: "private", label: "Private", valueType: "string", handling: "exclude" }
], primaryKey: ["id"] };
const rows = [{ id: "Original item", price: "$12.50", promoted: false, private: "EXCLUDED_CELL_SENTINEL" }];

function runtime() {
  return createWebAutomationLlmEvidenceRuntime({ eligibleSessionIds: () => ["session"], executeAction: async () => { throw new Error("this unit binding must not dispatch a capture or action"); } });
}

test("the actual web runtime binding explicitly supplies its projector and current privacy declaration", () => {
  const binding = runtime();
  assert.equal(binding.deniedEvidenceKeys, WEB_LLM_DENIED_EVIDENCE_KEYS);
  assert.equal(binding.projectJudgeEvidence, projectWebJudgeEvidence);
  const answer = { kind: "llm_evidence_tool_execution", effectApplied: false, resultCode: "web.inspect.succeeded", recordSchema: schema, evidence: { ok: true, status: "succeeded", page: "RAW_PAGE_SENTINEL", read: { extracted: rows } } };
  const before = structuredClone(answer);
  const step = automationStudioResultTrailStepOfCall({ callId: "read.1", toolId: "core.run_node", value: { node: "web.output.dom-extract_list", parameters: {} } }, answer, undefined, { projectJudgeEvidence: binding.projectJudgeEvidence, deniedEvidenceKeys: binding.deniedEvidenceKeys });
  const compact = automationStudioResultSemanticTrail(automationStudioResultRunTrail([step], binding.deniedEvidenceKeys).trail, { projectJudgeEvidence: binding.projectJudgeEvidence, deniedEvidenceKeys: binding.deniedEvidenceKeys });
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
  const binding = { ...runtime(), deniedEvidenceKeys: [] as readonly string[] };
  const step = automationStudioResultTrailStepOfCall({ callId: "action.1", toolId: "core.run_node", value: { node: "web.output.dom-click" } }, { kind: "llm_evidence_tool_execution", effectApplied: true, resultCode: "web.action.succeeded", evidence: { status: "succeeded", changed: ["The selected state changed"], page: "RAW_PAGE_SENTINEL" } }, undefined, { projectJudgeEvidence: binding.projectJudgeEvidence, deniedEvidenceKeys: binding.deniedEvidenceKeys });
  const trail = automationStudioResultRunTrail([step], binding.deniedEvidenceKeys).trail;
  assert.deepEqual(automationStudioResultSemanticTrail(trail, binding).projection.missing, []);
  const unknown = automationStudioResultSemanticTrail(trail, { projectJudgeEvidence: binding.projectJudgeEvidence, deniedEvidenceKeys: undefined });
  assert.deepEqual(unknown.projection.missing, [{ source: "trail", codes: ["judge_evidence.denied_keys_missing"] }]);
  assert.doesNotMatch(JSON.stringify(unknown), /RAW_PAGE_SENTINEL|selected state changed/u);
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
  assert.deepEqual(facts.notices, [{ tag: "p", role: "status", name: "Setting removed", text: "Setting removed" }]);
  assert.doesNotMatch(JSON.stringify(facts), /RAW_PAGE_SENTINEL|RAW_ATTRIBUTE_SENTINEL|"target"|"box"|Not captured/u);
  const projected = projectWebJudgeEvidence({ source: "state", phase: "after", evidence: { evidence: { judgeState: facts, page: "RAW_PAGE_SENTINEL" } } });
  assert.deepEqual(projected.missing, undefined);
  assert.deepEqual((projected.evidence as JsonObject).state, facts);
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

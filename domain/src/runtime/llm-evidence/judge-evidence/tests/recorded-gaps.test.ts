// The judge's semantic trail names no gap for a structure detection or for Core's own calls (t1032). Every judge of
// run-mwv5m906-5e999159 (and all seven of run-mwuxd2v9-33928ea3) carried `evidenceProjection.missing` entries for
// them -- `web_judge.evidence_unrecognized` for each detection and for `core.recall_result`, `web_judge.action_invalid`
// for `core.set_result_processing`'s `changed: true` -- and Core holds any yes unsure while a gap is named
// (`core.result.semantic_evidence_missing`), so the 0.8 yes with no defects at step 94 was refused. No act or read could
// clear those gaps. The detection is the web projector's to read (`../structure.ts`); Core's own calls never reach it
// (Core's `runtime/result-verification/judge-evidence/core-call.ts`), which these prove through this domain's binding.
// These are the recorded call shapes on a made-up garden centre; no recorded page data.
import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioResultRunTrail, automationStudioResultSemanticTrail, automationStudioResultTrailStepOfCall } from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime } from "../../tools";
import { present } from "../../present";

type SemanticOptions = NonNullable<Parameters<typeof automationStudioResultTrailStepOfCall>[3]>;

const binding = createWebAutomationLlmEvidenceRuntime({ eligibleSessionIds: () => ["session"], executeAction: async () => { throw new Error("this unit binding must not dispatch"); } });
const options = present<SemanticOptions>({ projectJudgeEvidence: binding.projectJudgeEvidence, judgeEvidenceVersion: binding.judgeEvidenceVersion, deniedEvidenceKeys: binding.deniedEvidenceKeys, legacySource: undefined, alreadyProjected: undefined, invalidFormat: undefined, resultEvidence: undefined });
const executed = (resultCode: string, evidence: JsonObject) => ({ kind: "llm_evidence_tool_execution", effectApplied: false, resultCode, evidence });

const DETECTION = executed("web.structure.detected", {
  schemaVersion: "web-llm-structure.v1", trust: "untrusted-page-evidence", location: "https://garden.example/plants", extraction: "extraction.1", target: "t4", list: "Perennials",
  itemCount: 6, fields: [{ key: "name", label: "name: 'Lavender'", kind: "text", coverage: 1, sample: "Lavender", type: "text" }, { key: "height", label: "height", kind: "text", coverage: 1, sample: "40cm", type: "text" }],
  pagination: "none", readNote: "read this list by naming the handle", confidence: 0.6, continues: { label: "View all", path: "/plants/all", note: "this section links to more items" }
});
const PROCESSING = executed("result_processing.set", { ok: true, changed: true, set: { where: [{ field: "height", is: "present" }], columns: ["name", "height"] }, read: 6, leftOut: 0, repeats: 0, cut: 0, kept: 6, filters: [{ condition: "height is present", leftOut: 0, leftOutOnlyByThis: [] }], rows: [{ name: "Lavender", height: "40cm" }] });
const RECALL = executed("core.recall.restored", { recalled: "read.1", restored: { page: "PAGE \"Plants\"\nt4 h2 \"Perennials\"" } });
const READ = executed("web.inspect.succeeded", { ok: true, status: "succeeded", node: "web.output.dom-extract_list", read: { extracted: [{ name: "Lavender", height: "40cm" }], listKey: "list.plants", place: "offset=0" } });

/** The trail a judge is shown of these calls, and the gaps it names: projected as each call is answered, or later as a step Core pushed without projecting it (the processing tool's). */
function trailOf(steps: ReturnType<typeof automationStudioResultTrailStepOfCall>[]) {
  return automationStudioResultSemanticTrail(automationStudioResultRunTrail(steps, binding.deniedEvidenceKeys).trail, options);
}

test("a structure detection is semantic evidence: its list's size, column keys and paging, and no gap", () => {
  const compact = trailOf([automationStudioResultTrailStepOfCall({ callId: "detect.1", toolId: "web.detect_repeating_structure", value: { target: "t4" } }, DETECTION, undefined, options)]);
  assert.deepEqual(compact.projection.missing, []);
  const found = compact.trail!.entries[0]!.found as JsonObject;
  assert.equal(found.role, "observation");
  assert.deepEqual((found.evidence as JsonObject).structure, { itemCount: 6, fields: ["name", "height"], pagination: "none", list: "Perennials" });
  assert.doesNotMatch(JSON.stringify(found), /Lavender|40cm|readNote|View all/u);
});

test("Core's own calls are Core's to account for: no gap, whether projected as they ran or later", () => {
  const ran = trailOf([
    automationStudioResultTrailStepOfCall({ callId: "process.1", toolId: "core.set_result_processing", value: { process: { where: [{ field: "height", is: "present" }] }, why: "keep the rows with a height" } }, PROCESSING, undefined, options),
    automationStudioResultTrailStepOfCall({ callId: "recall.1", toolId: "core.recall_result", value: { callId: "read.1" } }, RECALL, undefined, options)
  ]);
  assert.deepEqual(ran.projection.missing, []);
  // The processing tool pushes its step without projecting it (Core's `result-processing/processing.ts`); the trail projects it then.
  const later = trailOf([automationStudioResultTrailStepOfCall({ callId: "process.2", toolId: "core.set_result_processing", value: { process: {}, why: "no extra criteria" } }, PROCESSING)]);
  assert.deepEqual(later.projection.missing, []);
  assert.doesNotMatch(JSON.stringify([ran.trail, later.trail]), /Lavender|PAGE/u);
});

// t1029's finding, closed in Core: a wait, a merge or a For Each pass in a Flow attempt carries Core's bookkeeping, and
// was named `web_judge.evidence_unrecognized`. Core keeps its own control-flow and timing steps from the host too.
test("Core's control-flow and timing steps in a Flow attempt are no gap; unreadable content on any other node still is", () => {
  const flowOptions = present<SemanticOptions>({ projectJudgeEvidence: binding.projectJudgeEvidence, judgeEvidenceVersion: binding.judgeEvidenceVersion, deniedEvidenceKeys: binding.deniedEvidenceKeys, legacySource: "flow-attempt", alreadyProjected: undefined, invalidFormat: undefined, resultEvidence: undefined });
  const steps = [
    { did: "builtin.timing.wait", found: { outputs: { data: null } } },
    { did: "builtin.control.merge", found: { outputs: { next: true, mergeMode: "first" } } },
    { did: "builtin.control.for-each", found: { outputs: { item: { $datasetRow: { datasetId: "rows", ordinal: 1 } }, index: 0, count: 3 } } },
    { did: "builtin.data.filter-list", found: { outputs: { data: { opaque: "UNREAD" } } } },
    { did: "builtin.policy.action", found: { outputs: { data: { opaque: "UNREAD" } } } },
    { did: "web.output.dom-click", found: { outputs: { data: null } } }
  ];
  const shown = automationStudioResultSemanticTrail(automationStudioResultRunTrail(steps, binding.deniedEvidenceKeys).trail, flowOptions);
  const unread = ["web_judge.evidence_unrecognized"];
  assert.deepEqual(shown.projection.missing, [{ source: "n:4", codes: unread }, { source: "n:5", codes: unread }, { source: "n:6", codes: unread }]);
});

test("the web's own calls are projected as before, and one it cannot read is still a gap", () => {
  const read = trailOf([automationStudioResultTrailStepOfCall({ callId: "read.1", toolId: "core.run_node", value: { node: "web.output.dom-extract_list", parameters: {} } }, READ, undefined, options)]);
  assert.deepEqual(read.projection.missing, []);
  assert.equal((read.trail!.entries[0]!.found as JsonObject).role, "data");
  const unread = trailOf([automationStudioResultTrailStepOfCall({ callId: "detect.2", toolId: "web.detect_repeating_structure", value: {} }, executed("web.structure.detected", { schemaVersion: "web-llm-structure.v1", itemCount: "six" }), undefined, options)]);
  assert.deepEqual(unread.projection.missing, [{ source: "detect.2", codes: ["web_judge.evidence_unrecognized"] }]);
});

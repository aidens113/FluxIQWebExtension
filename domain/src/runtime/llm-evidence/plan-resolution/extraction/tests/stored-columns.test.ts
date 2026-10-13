// Submit reads an extraction step's record output the way the step's dispatch
// does, so a plan submit accepts is a plan that runs (t489).
//
// Lane D round 13 (`run-mv66sc3c-c47e74b8`) read the friend requests as
// `extractList: extraction.4` and named its own columns `name` and
// `mutualFriends` in the record output. Submit accepted revisions 4, 7 and 8;
// the dispatch stored the detector's keys and refused each on its last step;
// when the model wrote the detector's keys, submit refused those. These rows
// replay that shape through the real resolver and the real dispatch, and hold
// the two to one answer: every plan the resolver accepts dispatches, and every
// record output it refuses for a column the dispatch refuses too.

import assert from "node:assert/strict";
import test from "node:test";
import {
  automationStudioFlowBootstrapIssueFeedback,
  resolveAutomationStudioFlowBootstrapPlanParameters,
  type AutomationStudioActionConsequence,
  type AutomationStudioFlowBootstrapPlan
} from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebAutomationStructureDetection } from "../../../../../extraction";
import { webAutomationExtractListDispatch, webAutomationOutputNodeId } from "../../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_DETECT_STRUCTURE_TOOL_ID, type WebAutomationLlmEvidenceRuntime, type WebLlmRepeatingStructure } from "../../..";

const EXTRACT_NODE = webAutomationOutputNodeId("web.dom.extract_list");
const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const NOTHING_LASTING: readonly AutomationStudioActionConsequence[] = [];

/** The detector's keys for run mv66sc3c's `extraction.4` (step 0032), with synthetic selectors in the same shape. */
const NAME = "div_x0531l50_x1r2vv8_x4q0id2_a_x0ybvghy_x130pqy_x1yfagd";
const MUTUAL = "div_x0531l50_x1r2vv8_x4q0id2_div_x1a4yqcp_xa73opb_xtlve1b";
const CONFIRM = "div_x0531l50_x1r2vv8_x4q0id2_div_x1507i5_x1mgzeci_xu37y6r";
const CARD = "div.x0531l50.x1r2vv8.x4q0id2";
const COLUMNS: Array<[string, JsonObject]> = [
  ["a_x1cf2e2r_xu37y6r_xvzo2ll_url", { kind: "link", selector: "a.x1cf2e2r.xu37y6r.xvzo2ll", required: true }],
  [NAME, { kind: "text", selector: `${CARD} > a.x0ybvghy.x130pqy.x1yfagd`, required: true }],
  [`${NAME}_url`, { kind: "link", selector: `${CARD} > a.x0ybvghy.x130pqy.x1yfagd`, required: true }],
  [MUTUAL, { kind: "text", selector: `${CARD} > div.x1a4yqcp.xa73opb.xtlve1b`, required: true }],
  ["div_x0531l50_x1r2vv8_x4q0id2_span_x0gwrdxv_x1ksheh_x4q0id2", { kind: "text", selector: `${CARD} > span.x0gwrdxv.x1ksheh.x4q0id2`, required: true }],
  [CONFIRM, { kind: "text", selector: `${CARD} > div.x1507i5.x1mgzeci.xu37y6r`, required: true }],
  ["div_x0531l50_x1r2vv8_x4q0id2_div_x07beeli_x1ksheh_x4q0id2", { kind: "text", selector: `${CARD} > div.x07beeli.x1ksheh.x4q0id2`, required: true }]
];
const LABELS = ["a.x1cf2e2r url", "link: 'Tom Becker'", "a.x0ybvghy url", "text: '1 mutual friend'", "text: '2w'", "button: 'Confirm'", "button: 'Delete'"];
const REQUESTS: WebAutomationStructureDetection = {
  ok: true,
  proposal: {
    container: "div.x1n2onr6",
    item: "div.x1n2onr6 > div.x9f619",
    itemCount: 8,
    // The detection's own labels, page text included, as step 0032 showed them; none may reach a refusal.
    fields: COLUMNS.map(([key, spec], index) => ({ key, label: LABELS[index], spec, coverage: 1 })),
    confidence: 0.75
  }
} as unknown as WebAutomationStructureDetection;

function runtime(): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: "http://127.0.0.1:4173/scenarios/social-network-feed/friends/requests/", title: "Friend requests", interactiveElements: [] };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(REQUESTS) as unknown as JsonValue } };
    }
  });
}

async function detected(): Promise<{ runtime: WebAutomationLlmEvidenceRuntime; handle: string }> {
  const shown = runtime();
  const result = await shown.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, "web.structure.detected");
  return { runtime: shown, handle: (result.evidence as WebLlmRepeatingStructure).extraction };
}

async function resolve(shown: WebAutomationLlmEvidenceRuntime, parameters: JsonObject) {
  return await shown.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: EXTRACT_NODE, parameters, declaredConsequences: NOTHING_LASTING });
}

const schema = (...ids: string[]) => ({ schemaVersion: "0.1", fields: ids.map((id) => ({ id, label: id, valueType: "string" })) });
function output(ids: string[], process?: JsonObject): JsonObject {
  const written: JsonObject = { datasetId: "acceptedRequests", writeMode: "replace", schema: schema(...ids) };
  if (process !== undefined) written.process = process;
  return written;
}

/** Revision 4 of run mv66sc3c (step 0038): the author's names, over a detected read with no `fields`. */
const REVISION_4 = output(["name", "mutualFriends"], { columns: ["name", "mutualFriends"] });

test("run mv66sc3c's revision 4 is refused at submit, naming mutualFriends and listing the read's columns", async () => {
  const { runtime: shown, handle } = await detected();
  const answer = await resolve(shown, { extractList: { handle, minItems: 0 }, recordOutput: REVISION_4 });
  assert.equal(answer.status, "refused", JSON.stringify(answer));
  if (answer.status !== "refused") return;
  // The codes say why and where; the field and the names it can use travel as an issue beside them.
  assert.deepEqual(answer.issueCodes, [
    "web.handle.unknown_field",
    "web.handle.expected.extract_list.handle_fields",
    "web.handle.unknown_field:recordOutput.schema.fields.1.id"
  ]);
  assert.deepEqual(answer.issues, [{ code: "web.handle.unknown_field", field: "mutualFriends", valid: COLUMNS.map(([key]) => key) }]);
  // The same field and keys the dispatch gives at run time, as `{code, field, valid}`.
  const bare = await resolve(shown, { extractList: { handle, minItems: 0 } });
  const read = bare.status === "resolved" ? bare.parameters.extractList as JsonObject : {};
  const dispatch = webAutomationExtractListDispatch({ extractList: read, recordOutput: REVISION_4 });
  assert.equal(dispatch.ok, false);
  if (dispatch.ok) return;
  const issues = (dispatch.result.outputs?.error as JsonObject).issues as JsonObject[];
  assert.deepEqual(issues, [{ code: "record_output.column_not_read", field: "mutualFriends", valid: COLUMNS.map(([key]) => key) }]);
  assert.deepEqual(answer.issues.map((issue) => [issue.field, issue.valid]), issues.map((issue) => [issue.field, issue.valid]));
});

// Through Core's own submit entry: the domain's refusal crosses the boundary
// (`plan-parameter-resolution.ts` reads `issues` beside `issueCodes`) and the model
// is told, in Core's sentence, the field it wrote and the columns it can use.
test("Core's submit tells the model that revision 4 names mutualFriends, and lists the read's columns", async () => {
  const { runtime: shown, handle } = await detected();
  const plan = {
    schemaVersion: "0.1",
    router: { name: "Router", rules: [{ key: "main", name: "Main", targetSubflowKey: "main", routeTags: [] }], fallback: { kind: "fail" } },
    subflows: [{
      key: "main",
      name: "Main",
      role: "primary",
      nodes: [{ key: "accepted", definitionId: EXTRACT_NODE, definitionVersion: "1.0.0", consequences: [], parameters: { extractList: { handle, minItems: 0 }, recordOutput: REVISION_4 } }],
      edges: []
    }]
  } satisfies AutomationStudioFlowBootstrapPlan;
  const resolved = await resolveAutomationStudioFlowBootstrapPlanParameters({ plan, ...SCOPE, binding: shown, handlesIssued: true });
  assert.equal(resolved.ok, false, JSON.stringify(resolved));
  if (resolved.ok) return;
  const said = automationStudioFlowBootstrapIssueFeedback({ issues: resolved.issues });
  const told = said.find((entry) => entry.code === "web.handle.unknown_field");
  assert.ok(told, JSON.stringify(said));
  const sentence = told.message as string;
  assert.match(sentence, /"mutualFriends"/u);
  for (const [key] of COLUMNS) assert.ok(sentence.includes(`"${key}"`), `${key} in ${sentence}`);
  // Structure only: no label, sample or other page text the detection read.
  assert.doesNotMatch(sentence, /Tom Becker|mutual friend\b|Confirm|Delete/u);
});

test("submit and dispatch agree on every record output of the run, and on the fixes a refusal names", async () => {
  const { runtime: shown, handle } = await detected();
  // The read alone, as the resolver keeps it, which is what the dispatch would have been sent had submit not refused.
  const bare = await resolve(shown, { extractList: { handle, minItems: 0 } });
  assert.equal(bare.status, "resolved");
  const read = bare.status === "resolved" ? bare.parameters.extractList as JsonObject : {};
  const cases: Array<[string, JsonObject, JsonObject, "resolved" | "refused"]> = [
    ["revision 4: the author's names", { handle, minItems: 0 }, REVISION_4, "refused"],
    ["revision 7: a status column nothing reads", { handle, minItems: 0 }, output(["name", "mutualFriends", "status"], { columns: ["name", "mutualFriends", "status"], where: [{ field: "status", contains: "accepted" }] }), "refused"],
    ["revision 8: a where on name", { handle, minItems: 0 }, output(["name", "mutualFriends"], { where: [{ field: "name", is: "present" }], columns: ["name", "mutualFriends"] }), "refused"],
    ["revision 5: the author's schema, the detector's keys in process", { handle, minItems: 0 }, output(["name", "mutualFriends"], { columns: [NAME, CONFIRM] }), "refused"],
    ["the detector's keys throughout", { handle, minItems: 0 }, output([NAME, MUTUAL], { columns: [NAME, MUTUAL] }), "resolved"],
    ["the author's names kept in fields", { handle, fields: { name: NAME, mutualFriends: MUTUAL }, minItems: 0 }, REVISION_4, "resolved"],
    ["name alone, matched to the name column", { handle, minItems: 0 }, output(["name"], { columns: ["name"] }), "resolved"],
    ["no record output", { handle, minItems: 0 }, {}, "resolved"]
  ];
  for (const [label, extractList, recordOutput, expected] of cases) {
    const parameters: JsonObject = Object.keys(recordOutput).length === 0 ? { extractList } : { extractList, recordOutput };
    const answer = await resolve(shown, parameters);
    assert.equal(answer.status, expected, `${label}: ${JSON.stringify(answer)}`);
    if (answer.status === "resolved") {
      const dispatch = webAutomationExtractListDispatch(answer.parameters);
      assert.equal(dispatch.ok, true, `${label}: submit accepted it, so the dispatch runs it: ${JSON.stringify(dispatch)}`);
      continue;
    }
    assert.equal(answer.status, "refused", label);
    // Refused at submit: the dispatch refuses the same record output over the read the slot resolved.
    const sent: JsonObject = Object.keys(recordOutput).length === 0 ? { extractList: read } : { extractList: read, recordOutput };
    const dispatch = webAutomationExtractListDispatch(sent);
    assert.equal(dispatch.ok, false, `${label}: submit refused it, so the dispatch refuses it too`);
    if (dispatch.ok || answer.status !== "refused") continue;
    // And for the same field: every field the dispatch's issues name is named by submit's issues too.
    const fields = ((dispatch.result.outputs?.error as JsonObject).issues as JsonObject[]).flatMap((issue) => typeof issue.field === "string" ? [issue.field] : []);
    const named = (answer.issues ?? []).map((issue) => issue.field);
    for (const field of fields) assert.ok(named.includes(field), `${label}: ${field} in ${JSON.stringify(answer.issues)}`);
  }
});

test("the author's names become the read's columns at submit, so the Flow saves what the record output describes", async () => {
  const { runtime: shown, handle } = await detected();
  const keyed = await resolve(shown, { extractList: { handle, fields: { name: NAME, mutualFriends: MUTUAL }, minItems: 0 }, recordOutput: REVISION_4 });
  assert.equal(keyed.status, "resolved", JSON.stringify(keyed));
  const matched = await resolve(shown, { extractList: { handle, minItems: 0 }, recordOutput: output(["name", MUTUAL], { columns: ["name", MUTUAL] }) });
  assert.equal(matched.status, "resolved", JSON.stringify(matched));
  if (matched.status !== "resolved") return;
  const fields = (matched.parameters.extractList as { fields: JsonObject }).fields;
  assert.ok(Object.hasOwn(fields, "name") && !Object.hasOwn(fields, NAME), "the name column is kept under the author's name");
  const dispatch = webAutomationExtractListDispatch(matched.parameters);
  assert.equal(dispatch.ok, true);
  if (dispatch.ok) assert.deepEqual((dispatch.payload.recordOutput as { schema: { fields: { id: string }[] } }).schema.fields.map((field) => field.id), ["name", MUTUAL]);
});

test("a record output Core's parser refuses as the dispatch builds it is refused at submit with the dispatch's own issue", async () => {
  const { runtime: shown, handle } = await detected();
  const answer = await resolve(shown, { extractList: { handle, minItems: 0 }, recordOutput: output([NAME, MUTUAL], { limit: 0 }) });
  assert.equal(answer.status, "refused", JSON.stringify(answer));
  if (answer.status !== "refused") return;
  assert.ok(answer.issueCodes.includes("web.handle.malformed:recordOutput"), JSON.stringify(answer.issueCodes));
  assert.ok(answer.issueCodes.includes("record_output.process_invalid_limit"), JSON.stringify(answer.issueCodes));
  assert.equal(webAutomationExtractListDispatch({ extractList: { handle }, recordOutput: output([NAME, MUTUAL], { limit: 0 }) }).ok, false);
});

test("a refusal's issue holds Core's bounds: at most 64 names it can use, the rest left out", async () => {
  // A literal read of 70 columns, nothing detected, and a record output naming one it does not read.
  const fields: JsonObject = {};
  for (let index = 0; index < 70; index += 1) fields[`column_${index}`] = { kind: "text", selector: `.c${index}` };
  const answer = await resolve(runtime(), { extractList: { item: "li.row", fields }, recordOutput: output(["zzz"]) });
  assert.equal(answer.status, "refused", JSON.stringify(answer));
  if (answer.status !== "refused") return;
  assert.equal(answer.issues?.length, 1);
  assert.equal(answer.issues?.[0]?.field, "zzz");
  assert.deepEqual(answer.issues?.[0]?.valid, Object.keys(fields).slice(0, 64));
});

test("a node a caller runs now is not dry-dispatched: its real dispatch, a moment later, names the field and columns", async () => {
  const { runtime: shown, handle } = await detected();
  const now = { ...SCOPE, nodeDefinitionId: EXTRACT_NODE, parameters: { extractList: { handle, minItems: 0 }, recordOutput: REVISION_4 }, declaredConsequences: NOTHING_LASTING, gatedByCaller: true as const };
  const answer = await shown.resolvePlanNodeParameters(now);
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
  if (answer.status !== "resolved") return;
  const dispatch = webAutomationExtractListDispatch(answer.parameters);
  assert.equal(dispatch.ok, false);
  if (!dispatch.ok) assert.match(dispatch.result.failure?.actual ?? "", /mutualFriends/u);
});

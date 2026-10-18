// Submit saves the record output the step's dispatch runs (t510, F1).
//
// Breadth wave 1's auction run (`run-mv6qrbgx-06151cdb`, steps 0022 and 0024)
// sorted by a column the answer must not show, marked every helper `handling:
// "exclude"`, and listed the answer's columns in `process.columns`. Submit
// checked the record output as written, so Core refused the sort on an excluded
// field; the dispatch would have replaced the schema and run it. Two readers of
// one value again. Now the resolver writes the dispatch's own record output into
// the step, so Core checks, and the Flow saves, exactly what runs.

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioFlowBootstrapRecordOutputIssues, type AutomationStudioActionConsequence } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebAutomationStructureDetection } from "../../../../../extraction";
import { webAutomationExtractListDispatch, webAutomationOutputNodeDefinitions, webAutomationOutputNodeId } from "../../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_DETECT_STRUCTURE_TOOL_ID, type WebAutomationLlmEvidenceRuntime, type WebLlmRepeatingStructure } from "../../..";
import { webPlanRunRecordOutput } from "../run-record-output";

const EXTRACT_NODE = webAutomationOutputNodeId("web.dom.extract_list");
const DEFINITION = webAutomationOutputNodeDefinitions.find((definition) => definition.id === EXTRACT_NODE)!;
const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const NOTHING_LASTING: readonly AutomationStudioActionConsequence[] = [];

/** The auction read's ten columns under detector-shaped keys, with synthetic selectors. */
const COLUMNS = ["title", "price", "bids", "postage", "condition", "ends", "endsAt", "pounds", "bin", "ad"] as const;
const keyOf = (name: string) => `div_listing_div_${name.toLowerCase()}_span`;
const DETECTION: WebAutomationStructureDetection = {
  ok: true,
  proposal: {
    container: "ul.results",
    item: "ul.results > li.listing",
    itemCount: 12,
    fields: COLUMNS.map((name) => ({
      key: keyOf(name),
      label: `span.${name.toLowerCase()}`,
      spec: name === "ad" ? { kind: "attribute", attribute: "data-adid", required: false } : { kind: "text", selector: `span.${name.toLowerCase()}`, required: false },
      coverage: 1
    })),
    confidence: 0.8
  }
} as unknown as WebAutomationStructureDetection;

function runtime(): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: "http://127.0.0.1:4173/listings/", title: "Listings", interactiveElements: [] };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(DETECTION) as unknown as JsonValue } };
    }
  });
}

async function detected(): Promise<{ runtime: WebAutomationLlmEvidenceRuntime; handle: string }> {
  const shown = runtime();
  const result = await shown.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, "web.structure.detected");
  return { runtime: shown, handle: (result.evidence as WebLlmRepeatingStructure).extraction };
}

/** The step's `extractList` as the run wrote it: the handle, every column under the model's name, two of its conditions. */
const auctionList = (handle: string): JsonObject => ({
  handle,
  fields: Object.fromEntries(COLUMNS.map((name) => [name, keyOf(name)])),
  where: [{ field: "ad", is: "absent" }, { field: "pounds", lessThan: 150 }],
  minItems: 0
});

/** Steps 0022 and 0024: every helper marked exclude, the sort on one of them, the answer's columns in process. */
function auctionRecordOutput(sortField: string): JsonObject {
  const kept = ["title", "price", "bids", "postage"].map((id) => ({ id, label: id, valueType: "string" }));
  const helpers = ["condition", "ends", "endsAt", "pounds", "bin", "ad"].map((id) => ({ id, label: id, valueType: "string", handling: "exclude" }));
  return {
    datasetId: "kestrel35auctions",
    writeMode: "replace",
    schema: { schemaVersion: "0.1", fields: [...kept, ...helpers] },
    process: { sort: [{ field: sortField, order: "asc" }], columns: ["title", "price", "bids", "postage"] }
  };
}

async function resolve(shown: WebAutomationLlmEvidenceRuntime, parameters: JsonObject) {
  return await shown.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: EXTRACT_NODE, parameters, declaredConsequences: NOTHING_LASTING });
}

test("resolved extraction preserves explicit intermediate purpose without deriving it for ordinary reads", async () => {
  const { runtime: shown, handle } = await detected();
  const parameters: JsonObject = { extractList: auctionList(handle), recordOutput: { datasetId: "working", purpose: "intermediate", writeMode: "append" } };
  const resolved = await resolve(shown, parameters);
  assert.equal(resolved.status, "resolved", JSON.stringify(resolved));
  if (resolved.status !== "resolved") throw new Error("expected resolved intermediate");
  assert.equal((resolved.parameters.recordOutput as JsonObject).purpose, "intermediate");
  assert.deepEqual(automationStudioFlowBootstrapRecordOutputIssues(DEFINITION, resolved.parameters.recordOutput), []);
  for (let pass = 0; pass < 2; pass += 1) {
    const dispatch = webAutomationExtractListDispatch(resolved.parameters);
    assert.equal(dispatch.ok, true, JSON.stringify(dispatch));
    if (dispatch.ok) assert.deepEqual(dispatch.payload.recordOutput, resolved.parameters.recordOutput);
  }
  const ordinary = await resolve(shown, { extractList: auctionList(handle), recordOutput: { datasetId: "ordinary", writeMode: "append" } });
  assert.equal(ordinary.status, "resolved", JSON.stringify(ordinary));
  if (ordinary.status === "resolved") assert.equal(Object.hasOwn(ordinary.parameters.recordOutput as object, "purpose"), false);
});

test("the auction run's 0022 and 0024 resolve at submit with the record output the dispatch runs, which Core accepts", async () => {
  const { runtime: shown, handle } = await detected();
  for (const sortField of ["endsAt", "ends"]) {
    const authored = auctionRecordOutput(sortField);
    // The value as the model wrote it is what Core refused at submit.
    assert.deepEqual(automationStudioFlowBootstrapRecordOutputIssues(DEFINITION, authored), ["record_output.process_excluded_field"]);
    const answer = await resolve(shown, { extractList: auctionList(handle), recordOutput: authored });
    assert.equal(answer.status, "resolved", JSON.stringify(answer));
    if (answer.status !== "resolved") continue;
    const saved = answer.parameters.recordOutput as JsonObject;
    // One reader: the saved record output is exactly the one the dispatch runs.
    const dispatch = webAutomationExtractListDispatch(answer.parameters);
    assert.equal(dispatch.ok, true, JSON.stringify(dispatch));
    if (dispatch.ok) assert.deepEqual(dispatch.payload.recordOutput, saved);
    assert.deepEqual(automationStudioFlowBootstrapRecordOutputIssues(DEFINITION, saved), []);
    // The sort key is stored and hidden; the helpers only conditions read are not stored.
    const fields = (saved.schema as { fields: { id: string; handling?: string }[] }).fields;
    assert.deepEqual(fields.map((field) => [field.id, field.handling ?? null]), [["title", null], ["price", null], ["bids", null], ["postage", null], [sortField, null]]);
    assert.deepEqual((saved.process as JsonObject).sort, [{ field: sortField, order: "asc" }]);
    assert.deepEqual((saved.process as JsonObject).columns, ["title", "price", "bids", "postage"]);
  }
});

test("a generic shorthand: four declared columns sorted by a helper resolve with the helper stored and the columns written", async () => {
  const { runtime: shown, handle } = await detected();
  const authored = {
    datasetId: "listings",
    writeMode: "append",
    schema: { schemaVersion: "0.1", fields: ["title", "price", "bids", "postage"].map((id) => ({ id, label: id, valueType: "string" })) },
    process: { sort: [{ field: "endsAt", order: "desc" }] }
  };
  assert.deepEqual(automationStudioFlowBootstrapRecordOutputIssues(DEFINITION, authored), ["record_output.process_unknown_field"]);
  const answer = await resolve(shown, { extractList: auctionList(handle), recordOutput: authored });
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
  if (answer.status !== "resolved") return;
  const saved = answer.parameters.recordOutput as JsonObject;
  assert.deepEqual(automationStudioFlowBootstrapRecordOutputIssues(DEFINITION, saved), []);
  assert.deepEqual((saved.process as JsonObject).columns, ["title", "price", "bids", "postage"]);
  assert.ok((saved.schema as { fields: { id: string }[] }).fields.some((field) => field.id === "endsAt"));
});

test("a sort key the parser refuses is refused at submit, naming the stray key and the keys a sort key takes", async () => {
  const { runtime: shown, handle } = await detected();
  const authored = auctionRecordOutput("endsAt");
  authored.process = { sort: [{ field: "endsAt", direction: "asc" }] };
  const answer = await resolve(shown, { extractList: auctionList(handle), recordOutput: authored });
  assert.equal(answer.status, "refused", JSON.stringify(answer));
  if (answer.status !== "refused") return;
  assert.ok(answer.issueCodes.includes("record_output.process_invalid_sort"), JSON.stringify(answer.issueCodes));
  assert.deepEqual(answer.issues, [
    { code: "record_output.process_invalid_sort", field: "direction", valid: ["field", "order", "as"] },
    { code: "record_output.process_invalid_sort", field: "order", valid: ["asc", "desc"] }
  ]);
});

test("a step with no record output, or one its dispatch refuses, is left as it is", () => {
  const read = { item: "li", fields: { title: { kind: "text", selector: ".t" } } };
  const bare = { extractList: read };
  assert.equal(webPlanRunRecordOutput(bare), bare);
  const refused = { extractList: read, recordOutput: { datasetId: "d", writeMode: "append", process: { limit: 0 } } };
  assert.equal(webPlanRunRecordOutput(refused), refused);
  const runs = webPlanRunRecordOutput({ extractList: read, recordOutput: { datasetId: "d", writeMode: "append" } });
  assert.deepEqual(Object.keys(runs), ["extractList", "recordOutput"]);
  assert.equal((runs.recordOutput as JsonObject).recordsPath !== undefined, true);
});

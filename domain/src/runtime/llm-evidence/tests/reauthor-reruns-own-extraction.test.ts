// The re-author reruns the Flow's own extraction and reads what it reads.
//
// End to end over the path `run-munnhi5q-4867dabe` (2026-09-29) broke: the
// build detects a list and runs its extraction by handle, the Flow is assembled
// with the request resolved, and the re-author -- a new evidence loop, handed
// that Flow as its draft with every `selector` withheld -- reruns the step
// amended. It was refused `target_unobserved` / `extraction_handle_required`,
// then `answered_the_same_again` three times, and never saw a record. Now the
// amended step reaches the page with the selectors the Flow already had, and
// the page's answer comes back to the model.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../output-nodes";
import type { WebLlmRepeatingStructure } from "../structure";
import { CAPTURED_DETECTIONS } from "../structure/tests/captured-detections";
import { createWebAutomationLlmEvidenceRuntime } from "../tools";
import { WEB_LLM_DETECT_STRUCTURE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID } from "../vocabulary";

const SCOPE = { projectId: "project.one", flowId: "flow.one" } as const;
const CAPTURE = CAPTURED_DETECTIONS["product-catalog-largest"];
const EXTRACT_NODE = webAutomationOutputNodeId("web.dom.extract_list");

test("an amended rerun of the Flow's own extraction reaches the page with what the draft withheld", async () => {
  const reads: JsonObject[] = [];
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.extract_list") reads.push(structuredClone(command.parameters));
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: CAPTURE.url, title: CAPTURE.title, interactiveElements: [] };
      return { status: "succeeded", payload: { snapshot, structure: structuredClone(CAPTURE.structure) as JsonValue } };
    }
  });
  const look = (callId: string) => runtime.executeTool({ ...SCOPE, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const extract = (callId: string, extractList: JsonObject) => runtime.executeTool({ ...SCOPE, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: EXTRACT_NODE, parameters: { extractList }, consequences: [] } });

  // The build.
  await look(`initial.${WEB_LLM_RUN_NODE_TOOL_ID}`);
  const detected = await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  const handle = (detected.evidence as WebLlmRepeatingStructure).extraction;
  const byHandle = { handle, fields: { name: "product-name", price: "product-price" }, minItems: 0 };
  assert.equal((await extract("call.extract", byHandle)).resultCode, "web.inspect.succeeded");
  // The Flow is assembled: the step is kept resolved.
  const assembled = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: EXTRACT_NODE, parameters: { extractList: byHandle }, declaredConsequences: [] });
  assert.equal(assembled.status, "resolved");
  const kept = (assembled as { parameters: JsonObject }).parameters.extractList as { item: string; fields: Record<string, JsonObject> };

  // The re-author, a new loop, reruns the step as its draft showed it, with a condition added.
  await look(`initial.${WEB_LLM_RUN_NODE_TOOL_ID}`);
  const shownFields: JsonObject = {};
  for (const [key, spec] of Object.entries(kept.fields)) {
    const shown = structuredClone(spec);
    delete shown.selector;
    shownFields[key] = shown;
  }
  const where = [{ field: "price", lessThan: 50 }];
  const rerun = await extract("rerun.9", { item: kept.item, fields: shownFields, where, minItems: 0 });
  assert.equal(rerun.resultCode, "web.inspect.succeeded");
  assert.equal(rerun.resultReason, undefined);
  assert.deepEqual(reads.at(-1)?.extractList, { item: kept.item, fields: kept.fields, where, minItems: 0 });
});

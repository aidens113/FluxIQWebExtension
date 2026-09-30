// A Flow's own extraction, written down resolved, is its detected list rather
// than a guess.
//
// The defect this pins is `run-munnhi5q-4867dabe`, 2026-09-29. The build
// detected the results list and wrote its extraction as a handle; assembling
// the Flow resolved that into the literal request the Flow keeps. The answer
// was refuted, and the re-author was handed the Flow as its draft, that literal
// included, with every `selector` withheld from what its model was shown
// (`AS/runtime/llm/harness/draft-screen.ts`). Every rerun of that step -- as it
// stood, or amended -- was refused `extraction_required`, because the build's
// detection had made every literal after it a guess. The re-author never saw
// one record of its own step. (`../own-extraction-list.ts`.)

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmRepeatingStructure
} from "../..";
import { CAPTURED_DETECTIONS } from "../../structure/tests/captured-detections";

const EXTRACT_LIST_NODE = webAutomationOutputNodeId("web.dom.extract_list");
const EXTRACTION_HINT = "web.handle.expected.extract_list.handle_fields_paginate";
const REQUIRED = { status: "refused", issueCodes: ["web.handle.extraction_required", EXTRACTION_HINT, "web.handle.extraction_required:extractList"] };
const CAPTURE = CAPTURED_DETECTIONS["product-catalog-largest"];

function catalogRuntime(): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: CAPTURE.url, title: CAPTURE.title, interactiveElements: [] };
      return { status: "succeeded", payload: { snapshot, structure: structuredClone(CAPTURE.structure) as JsonValue } };
    }
  });
}

async function detect(runtime: WebAutomationLlmEvidenceRuntime, flowId: string): Promise<string> {
  const detected = await runtime.executeTool({ projectId: "project.one", flowId, callId: `call.detect.${flowId}`, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  return (detected.evidence as WebLlmRepeatingStructure).extraction;
}

async function resolve(runtime: WebAutomationLlmEvidenceRuntime, parameters: JsonObject, flowId = "flow.one") {
  return await runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId, nodeDefinitionId: EXTRACT_LIST_NODE, parameters, declaredConsequences: [] });
}

/** The step as the assembled Flow keeps it: resolved, under the plan's own keys. */
async function assembledStep(runtime: WebAutomationLlmEvidenceRuntime): Promise<{ item: string; fields: Record<string, JsonObject> }> {
  const handle = await detect(runtime, "flow.one");
  const assembled = await resolve(runtime, { extractList: { handle, fields: { name: "product-name", price: "product-price", url: "product-link" }, minItems: 0 } });
  assert.equal(assembled.status, "resolved");
  const kept = (assembled as { parameters: JsonObject }).parameters.extractList as { item: string; fields: Record<string, JsonObject> };
  assert.equal(typeof kept.fields.name?.selector, "string", "the Flow keeps real selectors");
  return kept;
}

/** The same fields as the re-author's model was shown them: every selector withheld. */
function withheld(fields: Record<string, JsonObject>): Record<string, JsonObject> {
  const shown: Record<string, JsonObject> = {};
  for (const [key, spec] of Object.entries(fields)) {
    const copy = structuredClone(spec);
    delete copy.selector;
    shown[key] = copy;
  }
  return shown;
}

test("the Flow's own extraction reruns as it stands", async () => {
  const runtime = catalogRuntime();
  const kept = await assembledStep(runtime);
  assert.deepEqual(await resolve(runtime, { extractList: structuredClone(kept) as unknown as JsonObject, timeoutMs: 20_000 }), { status: "unchanged" });
});

test("an amendment written from the withheld draft gets back exactly what was withheld", async () => {
  const runtime = catalogRuntime();
  const kept = await assembledStep(runtime);
  const where = [{ field: "price", lessThan: 50 }];
  const amended = { item: kept.item, fields: withheld(kept.fields), where, minItems: 0 };
  assert.deepEqual(await resolve(runtime, { extractList: amended, timeoutMs: 20_000 }), {
    status: "resolved",
    parameters: { extractList: { item: kept.item, fields: kept.fields, where, minItems: 0 }, timeoutMs: 20_000 }
  });
  // A detected column the plan never kept is named by its detected key.
  assert.deepEqual(await resolve(runtime, { extractList: { item: kept.item, fields: { "product-rating": { kind: "text" } } } }), {
    status: "resolved",
    parameters: { extractList: { item: kept.item, fields: { "product-rating": { kind: "text", selector: '[data-testid="product-rating"]' } } } }
  });
  // A key no column answers to, or a kind its column is not, stays as written: nothing is guessed.
  assert.deepEqual(await resolve(runtime, { extractList: { item: kept.item, fields: { brand: { kind: "text" }, url: { kind: "text" } } } }), { status: "unchanged" });
});

test("a list nobody detected, the list in another frame, and another Flow's keys are still not this Flow's own", async () => {
  const runtime = catalogRuntime();
  const kept = await assembledStep(runtime);
  assert.deepEqual(await resolve(runtime, { extractList: { item: ".made-up-card", fields: withheld(kept.fields) } }), REQUIRED);
  assert.deepEqual(await resolve(runtime, { extractList: structuredClone(kept) as unknown as JsonObject, browserFrameId: 4 }), REQUIRED);
  // Flow two detected the same list but never wrote `name`, `price` or `url`
  // into a step, so those keys give nothing back there.
  await detect(runtime, "flow.two");
  const amended = { item: kept.item, fields: withheld(kept.fields) };
  assert.deepEqual(await resolve(runtime, { extractList: amended }, "flow.two"), { status: "unchanged" });
});

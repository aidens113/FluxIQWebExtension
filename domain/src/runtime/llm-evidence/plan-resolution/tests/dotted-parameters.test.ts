// A parameter of a slot written as a dotted key beside the slot (t486, W2).
//
// Lane D round 12 (`run-mv62icw0-070f88ad`, 0017/0018) read a detected list
// with
//
//   { "extractList": "extraction.1",
//     "extractList.fields": { "name": "...", "mutualFriends": "..." },
//     "extractList.minItems": 0 }
//
// The two dotted keys held no handle, so they passed through untouched as
// parameters the read does not take, the page ignored them, and the read
// returned all seven raw columns. That forced a re-read, a recall and a refused
// repeat (0027, 0029, 0031).
//
// Held here: a dotted key whose head is a parameter the node names
// (`extractList.fields`) is read as that parameter's own key, exactly as the
// nested form is; one that cannot be read so -- its head a plain value, or the
// nested form saying something else at the same place -- is refused at its own
// key with the shape the slot takes. Never passed through.

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
const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");
const CATALOG = CAPTURED_DETECTIONS["product-catalog-largest"];
const EXTRACTION_HINT = "web.handle.expected.extract_list.handle_fields";
const NAMED = { name: "product-name", price: "product-price" };

function runtime(): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: CATALOG.url, title: CATALOG.title, interactiveElements: [] };
      return { status: "succeeded", payload: { snapshot, structure: structuredClone(CATALOG.structure) as JsonValue } };
    }
  });
}

async function detected(): Promise<{ runtime: WebAutomationLlmEvidenceRuntime; extraction: string }> {
  const made = runtime();
  const result = await made.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, "web.structure.detected");
  return { runtime: made, extraction: (result.evidence as WebLlmRepeatingStructure).extraction };
}

async function resolve(made: WebAutomationLlmEvidenceRuntime, parameters: JsonObject, nodeDefinitionId = EXTRACT_LIST_NODE) {
  return await made.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId, parameters, declaredConsequences: [] });
}

test("dotted extractList.fields and extractList.minItems read as the nested form does", async () => {
  const { runtime: made, extraction } = await detected();
  const nested = await resolve(made, { extractList: { handle: extraction, fields: NAMED, minItems: 0 } });
  assert.equal(nested.status, "resolved", JSON.stringify(nested));

  // As lane D wrote it: the list bare, its fields and bound beside it.
  const dotted = await resolve(made, { extractList: extraction, "extractList.fields": NAMED, "extractList.minItems": 0 });
  assert.deepEqual(dotted, nested);
  // And with the list already in the handle's shape, as the node run hands it on.
  assert.deepEqual(await resolve(made, { extractList: { handle: extraction }, "extractList.fields": NAMED, "extractList.minItems": 0 }), nested);
  if (dotted.status === "resolved") {
    assert.deepEqual(Object.keys(dotted.parameters), ["extractList"], "no dotted key rides on to the page");
    assert.deepEqual(Object.keys((dotted.parameters.extractList as JsonObject).fields as JsonObject), ["name", "price"], "only the columns asked for");
  }
});

test("a dotted key the column check refuses is refused at its place in the slot, never dropped", async () => {
  const { runtime: made, extraction } = await detected();
  const answer = await resolve(made, { extractList: extraction, "extractList.fields": { name: "no-such-column-anywhere-zzz" } });
  assert.equal(answer.status, "refused", JSON.stringify(answer));
});

test("a dotted key that cannot be read as part of its slot is refused at that key", async () => {
  const { runtime: made, extraction } = await detected();
  // The nested form says other columns at the same place.
  const clash = await resolve(made, { extractList: { handle: extraction, fields: { name: "product-name" } }, "extractList.fields": { price: "product-price" } });
  assert.equal(clash.status, "refused", JSON.stringify(clash));
  if (clash.status === "refused") assert.ok(clash.issueCodes.includes("web.handle.ambiguous:extractList.fields"), JSON.stringify(clash.issueCodes));

  // Fields with no list named: a read written out by hand, which a detected list refuses, saying to name its handle.
  const orphan = await resolve(made, { "extractList.fields": NAMED });
  assert.equal(orphan.status, "refused", JSON.stringify(orphan));
  if (orphan.status === "refused") {
    assert.equal(orphan.issueCodes[0], "web.handle.extraction_required");
    assert.ok(orphan.issueCodes.includes(EXTRACTION_HINT), JSON.stringify(orphan.issueCodes));
  }

  // A head holding a plain value has no keys to add to.
  const plain = await resolve(made, { extractList: 5, "extractList.fields": NAMED });
  assert.equal(plain.status, "refused", JSON.stringify(plain));
  if (plain.status === "refused") assert.ok(plain.issueCodes.includes("web.handle.malformed:extractList.fields"), JSON.stringify(plain.issueCodes));
});

test("a key with a dot whose head names nothing the node holds is left alone on other nodes", async () => {
  const { runtime: made } = await detected();
  // No handle, no slot: a click's unknown key is not this resolver's to read.
  assert.deepEqual(await resolve(made, { "button.text": "Go" }, CLICK_NODE), { status: "unchanged" });
});

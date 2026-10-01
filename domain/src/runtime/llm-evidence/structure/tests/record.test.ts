// One record read as a one-row table (t195 w20j; the audit is w19e, cause 1).
//
// What these rows prove, on detection answers written from the scenarios'
// markup (`record-detections.ts`):
// - a detection that carries the record the target belongs to beside the run
//   it found issues two handles, in order, and the packet names the record by
//   its handle, with its one item, its columns and the sentence saying when to
//   name it -- and no selector;
// - both handles resolve, in the same scope and frame, the record's to the
//   card's own item and spans;
// - a record whose every field is sensitive is left out, and the run is
//   answered alone;
// - a one-item proposal -- the receipt's `<dl>` -- passes through as any list.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmRepeatingStructure
} from "../..";
import { shownPageLines } from "../../page-view/tests/shown-page-lines";
import { RECORD_DETECTIONS, REPLY_CARD, REPLY_CARD_LINK, type RecordDetectionName } from "./record-detections";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };

/** A page that answers every detection with `structure`, and shows `elements` to a look. */
function pageRuntime(name: RecordDetectionName, elements: JsonObject[], structure?: unknown): WebAutomationLlmEvidenceRuntime {
  const capture = RECORD_DETECTIONS[name];
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: capture.url, title: capture.title, interactiveElements: structuredClone(elements) };
      const answer = structuredClone(structure ?? capture.structure) as JsonValue;
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: answer } };
    }
  });
}

/** Look at the page, then detect around its one shown element, as a model aimed at the card would. */
async function detectAroundCard(runtime: WebAutomationLlmEvidenceRuntime) {
  const inspected = await runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const [card] = shownPageLines(inspected.evidence);
  assert.ok(card, "the card link is shown");
  return await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: { target: card.target } });
}

const CARD: JsonObject = structuredClone(REPLY_CARD_LINK) as unknown as JsonObject;

test("the record beside the run gets a second handle, and the packet names it with its columns and when to use it", async () => {
  const runtime = pageRuntime("photo-social-reply-card", [CARD]);
  const detected = await detectAroundCard(runtime);
  assert.equal(detected.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  const packet = detected.evidence as WebLlmRepeatingStructure;
  assert.equal(packet.extraction, "extraction.1", "the run is named first");
  assert.equal(packet.itemCount, 3);
  assert.deepEqual(packet.record, {
    handle: "extraction.2",
    itemCount: 1,
    fields: [
      { key: "span_1", label: "span:1", kind: "text", coverage: 1 },
      { key: "span_2", label: "span:2", kind: "text", coverage: 1 },
      { key: "span_x1s0c7au_x1xkdpo7_xdd3vo9", label: "span.x1s0c7au.x1xkdpo7.xdd3vo9", kind: "text", coverage: 1 }
    ],
    note: "record is the one item you aimed at, read as a one-row table; name its handle in extractList when the instruction is about that item"
  });
  // Nothing the model is shown addresses the page.
  const serialized = JSON.stringify(packet);
  for (const selector of [REPLY_CARD.item, ":scope", "a.x1ui8mjl.x1unrdkg.x1xae3z8", "aside."]) {
    assert.equal(serialized.includes(selector), false, `the packet quotes ${selector}`);
  }

  const run = runtime.resolveExtractionHandle({ ...SCOPE, handle: "extraction.1" });
  const record = runtime.resolveExtractionHandle({ ...SCOPE, handle: "extraction.2" });
  assert.ok(run.ok && record.ok, "both handles resolve in the scope that detected them");
  assert.equal(run.binding.extractList.item, "a.x1ui8mjl.x1unrdkg.x1xae3z8");
  assert.deepEqual(record.binding, {
    handle: "extraction.2",
    location: "http://127.0.0.1:4173/scenarios/photo-social/direct/t/saltmarsh.goods/",
    extractList: {
      item: REPLY_CARD.item,
      fields: {
        span_1: { kind: "text", selector: REPLY_CARD.name, required: true },
        span_2: { kind: "text", selector: REPLY_CARD.price, required: true },
        span_x1s0c7au_x1xkdpo7_xdd3vo9: { kind: "text", selector: REPLY_CARD.note, required: true }
      }
    },
    itemCount: 1
  });
  // Another Flow was shown neither.
  assert.deepEqual(runtime.resolveExtractionHandle({ projectId: "project.one", flowId: "flow.two", handle: "extraction.2" }), { ok: false, code: "unknown_handle" });
});

test("a sensitive field of the record is dropped from both of its halves, as a run's is", async () => {
  // A record of nothing but sensitive fields never arrives: the wire reader
  // refuses the whole detection (`extraction/structure-detection.ts`).
  const structure = structuredClone(RECORD_DETECTIONS["photo-social-reply-card"].structure) as { record: { fields: Array<{ key: string; spec: Record<string, unknown> }> } };
  for (const field of structure.record.fields) if (field.key !== "span_2") field.spec.handling = "exclude";
  const runtime = pageRuntime("photo-social-reply-card", [CARD], structure);
  const packet = (await detectAroundCard(runtime)).evidence as WebLlmRepeatingStructure;
  assert.deepEqual(packet.record?.fields.map((field) => field.key), ["span_2"]);
  const record = runtime.resolveExtractionHandle({ ...SCOPE, handle: "extraction.2" });
  assert.ok(record.ok);
  assert.deepEqual(Object.keys(record.binding.extractList.fields), ["span_2"]);
});

test("a one-item proposal -- a label/value receipt -- passes through as a list of one", async () => {
  const runtime = pageRuntime("job-board-receipt", []);
  const detected = await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(detected.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  const packet = detected.evidence as WebLlmRepeatingStructure;
  assert.equal(packet.itemCount, 1);
  assert.deepEqual(packet.fields.map((field) => [field.key, field.label]), [["role", "Role"], ["company", "Company"], ["reference", "Reference"], ["submitted", "Submitted"]]);
  assert.equal("record" in packet, false, "a proposal of one item is the list, not a record beside one");
  const bound = runtime.resolveExtractionHandle({ ...SCOPE, handle: packet.extraction });
  assert.ok(bound.ok);
  assert.equal(bound.binding.extractList.item, "dl.tl-receipt");
  assert.equal(bound.binding.itemCount, 1);
});

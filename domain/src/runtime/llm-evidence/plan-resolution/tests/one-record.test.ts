// An extraction node over one record: the reply card named beside a run, and a
// label/value receipt detected as a list of one (t195 w20j; w19e cause 1, w19d C3).
//
// - The plan names the record's handle with two of its columns under its own
//   keys, and the node reads the card's own item and those two spans.
// - The Flow keeps that resolved request, and read back as a draft it is the
//   Flow's own list, not a guess (`../own-extraction-list.ts`).
// - A receipt's handle with `minItems` and `maxItems` of 1 builds an extract
//   node that reads exactly one row.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmRepeatingStructure
} from "../..";
import { shownPageLines } from "../../page-view/tests/shown-page-lines";
import { RECORD_DETECTIONS, REPLY_CARD, REPLY_CARD_LINK, type RecordDetectionName } from "../../structure/tests/record-detections";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const EXTRACT_LIST_NODE = webAutomationOutputNodeId("web.dom.extract_list");

function pageRuntime(name: RecordDetectionName, elements: JsonObject[]): WebAutomationLlmEvidenceRuntime {
  const capture = RECORD_DETECTIONS[name];
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: capture.url, title: capture.title, interactiveElements: structuredClone(elements) };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(capture.structure) as JsonValue } };
    }
  });
}

async function resolve(runtime: WebAutomationLlmEvidenceRuntime, extractList: JsonObject) {
  return await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: EXTRACT_LIST_NODE, parameters: { extractList }, declaredConsequences: [] });
}

/** The thread page after the reply: look, then detect around the card the model was shown. */
async function threadPacket(runtime: WebAutomationLlmEvidenceRuntime): Promise<WebLlmRepeatingStructure> {
  const look = await runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const [card] = shownPageLines(look.evidence);
  assert.ok(card, "the card link is shown");
  const detected = await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: { target: card.target } });
  return detected.evidence as WebLlmRepeatingStructure;
}

test("the record's handle with two of its columns resolves to the card's item and those two spans", async () => {
  const runtime = pageRuntime("photo-social-reply-card", [structuredClone(REPLY_CARD_LINK) as unknown as JsonObject]);
  const packet = await threadPacket(runtime);
  const record = packet.record;
  assert.ok(record, "the packet names the record");
  assert.notEqual(record.handle, packet.extraction);

  const resolved = await resolve(runtime, { handle: record.handle, fields: { item: "span_1", price: "span_2" } });
  assert.deepEqual(resolved, {
    status: "resolved",
    parameters: {
      extractList: {
        item: REPLY_CARD.item,
        fields: {
          item: { kind: "text", selector: REPLY_CARD.name, required: true },
          price: { kind: "text", selector: REPLY_CARD.price, required: true }
        }
      }
    }
  });

  // The run's handle still names the thread rows, which carry no price.
  const run = await resolve(runtime, { handle: packet.extraction });
  assert.equal(run.status, "resolved");
  assert.equal(((run as { parameters: JsonObject }).parameters.extractList as JsonObject).item, "a.x1ui8mjl.x1unrdkg.x1xae3z8");

  // The Flow keeps the resolved request; read back as a draft, with each
  // selector withheld, it is the Flow's own list and gets them back.
  const kept = (resolved as { parameters: { extractList: JsonObject } }).parameters.extractList;
  const draft = { item: kept.item as string, fields: { item: { kind: "text", required: true }, price: { kind: "text", required: true } } };
  assert.deepEqual(await resolve(runtime, draft), { status: "resolved", parameters: { extractList: kept } });
});

test("a receipt detected as a list of one builds an extract node that reads exactly one row", async () => {
  const runtime = pageRuntime("job-board-receipt", []);
  const detected = await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  const packet = detected.evidence as WebLlmRepeatingStructure;
  assert.equal(packet.itemCount, 1);

  const resolved = await resolve(runtime, { handle: packet.extraction, fields: { role: "role", company: "company", reference: "reference" }, minItems: 1, maxItems: 1 });
  assert.deepEqual(resolved, {
    status: "resolved",
    parameters: {
      extractList: {
        item: "dl.tl-receipt",
        fields: {
          role: { kind: "text", selector: ":scope > dd:nth-of-type(1)", required: true },
          company: { kind: "text", selector: ":scope > dd:nth-of-type(2)", required: true },
          reference: { kind: "text", selector: ":scope > dd:nth-of-type(3)", required: true }
        },
        minItems: 1,
        maxItems: 1
      }
    }
  });
});

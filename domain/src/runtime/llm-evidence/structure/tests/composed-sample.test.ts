// Live run `run-mvd0pbn9-bad36023` (step 0015): a listing offered two money
// columns. The sale price was a container whose words sat only in child spans
// ("", "9", ",87", " €") and reached the model with no sample; the struck-through
// original, a span with words of its own, carried "21,48 €". The model chose the
// column it could see and read the wrong price for eight revisions. A text
// column whose element has no words of its own now composes its sample from its
// described descendants, joined as the page reads them.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  type WebLlmRepeatingStructure
} from "../..";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const URL_ = "http://127.0.0.1:4173/listing/";
const CONTAINER = "body > div:nth-of-type(2) > div";
const SALE = "div_css-4p9x2kq_currency_amount";
const STRUCK = "div_css-2b8kq0w_span_css-7rt3wq1_currency_amount";
const EMPTY = "div_css-9m3vq1z";
const NOTE = "input_css-5h1rk8d";

function field(key: string, label: string, kind: string, selector: string): JsonObject {
  return { key, label, spec: { kind, selector, required: true }, coverage: 1 };
}

const STRUCTURE = {
  ok: true,
  proposal: {
    container: CONTAINER,
    item: `${CONTAINER} > div.card`,
    itemCount: 2,
    fields: [
      field(SALE, "div.css-4p9x2kq (currency amount)", "text", ":scope > div.css-4p9x2kq"),
      field(STRUCK, "div.css-2b8kq0w > span.css-7rt3wq1 (currency amount)", "text", ":scope > div.css-2b8kq0w > span.css-7rt3wq1"),
      field(EMPTY, "div.css-9m3vq1z", "text", ":scope > div.css-9m3vq1z"),
      field(NOTE, "input.css-5h1rk8d", "text", ":scope > input.css-5h1rk8d")
    ],
    confidence: 0.7
  }
};

/** One card as the capture lists it: the sale price split across spans, the struck original in a sibling, an empty box and a field. */
function card(elements: JsonObject[], parent: number, position: number, pieces: string[], struck: string): void {
  const add = (element: JsonObject): number => elements.push(element) - 1;
  const item = `${CONTAINER} > div:nth-of-type(${position})`;
  const context = { listPosition: { index: position, total: 2 } };
  const at = add({ tagName: "div", selector: item, attributes: { class: "card" }, parent, context });
  const sale = add({ tagName: "div", selector: `${item} > div:nth-of-type(1)`, ownText: "", attributes: { class: "css-4p9x2kq" }, parent: at, context });
  pieces.forEach((piece, index) => {
    add({ tagName: "span", selector: `${item} > div:nth-of-type(1) > span:nth-of-type(${index + 1})`, visibleText: piece, attributes: { class: `css-p${index}x7q2` }, parent: sale, context });
  });
  const original = add({ tagName: "div", selector: `${item} > div:nth-of-type(2)`, ownText: "", attributes: { class: "css-2b8kq0w" }, parent: at, context });
  add({ tagName: "span", selector: `${item} > div:nth-of-type(2) > span`, visibleText: struck, attributes: { class: "css-7rt3wq1" }, parent: original, context });
  add({ tagName: "div", selector: `${item} > div:nth-of-type(3)`, ownText: "", attributes: { class: "css-9m3vq1z" }, parent: at, context });
  add({ tagName: "input", selector: `${item} > input`, inputType: "text", accessibleName: "Gift note", attributes: { class: "css-5h1rk8d", type: "text", value: "kept private" }, value: "kept private", parent: at, context });
}

function listingPage(): JsonObject[] {
  const elements: JsonObject[] = [];
  const container = elements.push({ tagName: "div", selector: CONTAINER, attributes: { class: "list" } }) - 1;
  card(elements, container, 1, ["", "9", ",87", " €"], "21,48 €");
  card(elements, container, 2, ["", "12", ",30", " €"], "19,99 €");
  return elements;
}

async function detected(): Promise<WebLlmRepeatingStructure> {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: URL_, title: "Listing", interactiveElements: listingPage() };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(STRUCTURE) as JsonValue } };
    }
  });
  const result = await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  return result.evidence as WebLlmRepeatingStructure;
}

function shown(packet: WebLlmRepeatingStructure, key: string) {
  const column = packet.fields.find((each) => each.key === key);
  assert.ok(column, `the packet lists ${key}`);
  return column;
}

test("a container whose words sit only in child spans is sampled as the page reads them, and labelled a price", async () => {
  const packet = await detected();
  const sale = shown(packet, SALE);
  assert.equal(sale.sample, "9,87 €");
  assert.equal(sale.label, "price: '9,87 €'");
});

test("a column whose element has words of its own keeps its sample", async () => {
  const packet = await detected();
  assert.equal(shown(packet, STRUCK).sample, "21,48 €");
});

test("a container with no described descendants still has no sample, and a form control is never composed", async () => {
  const packet = await detected();
  assert.equal(shown(packet, EMPTY).sample, undefined);
  assert.equal(shown(packet, NOTE).sample, undefined);
  assert.equal(JSON.stringify(packet).includes("kept private"), false);
});

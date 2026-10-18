// A container whose lines detection can name only by position is offered whole
// as one `lines` column (`apps/extension/src/content/extraction/infer-fields.ts`):
// live run `run-mvcxvr3k-af919462` (step 0025) offered a card's fulfilment
// lines as `div_..._div_1`, `_2`, `_3`, so on a card without the first line the
// second sat in `_1` and no column held the whole group.
//
// What the domain owes that column: a sample joined the way the page joins its
// lines, a label that says it holds lines, and a handle that keeps `lines` so
// the read the plan writes reads the group as detection showed it.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR, webAutomationExtractListRequestValue } from "../../../../actions/extraction";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  type WebLlmRepeatingStructure
} from "../..";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const URL_ = "http://127.0.0.1:4173/results";
const CONTAINER = "body > ul";
const GROUP = "div.x7f3q9k";
const LINES_KEY = "div_x7f3q9k_all_lines";
const FIRST_LINE_KEY = "div_x7f3q9k_div_1";

/** The detection the page answers: the positional lines as before, and the group beside them. */
const STRUCTURE = {
  ok: true,
  proposal: {
    container: CONTAINER,
    item: `${CONTAINER} > li.x2card`,
    itemCount: 2,
    fields: [
      { key: "span_x9title", label: "span.x9title", spec: { kind: "text", selector: ":scope span.x9title", required: true }, coverage: 1 },
      { key: LINES_KEY, label: `${GROUP} (all lines)`, spec: { kind: "text", selector: `:scope ${GROUP}`, lines: true, required: true }, coverage: 1 },
      { key: FIRST_LINE_KEY, label: `${GROUP} > div:1`, spec: { kind: "text", selector: `:scope > ${GROUP} > div:nth-of-type(1)`, required: true }, coverage: 1 },
      { key: "div_x7f3q9k_div_2", label: `${GROUP} > div:2`, spec: { kind: "text", selector: `:scope > ${GROUP} > div:nth-of-type(2)`, required: false }, coverage: 0.5 }
    ],
    confidence: 0.75
  }
};

/** One card as the capture lists it: every rendered element, its parent by index. */
function card(elements: JsonObject[], parent: number, position: number, title: string, lines: readonly string[]): void {
  const add = (element: JsonObject): number => elements.push(element) - 1;
  const item = `${CONTAINER} > li:nth-of-type(${position})`;
  const listPosition = { index: position, total: 2 };
  const li = add({ tagName: "li", selector: item, attributes: { class: "x2card" }, parent, context: { listPosition } });
  add({ tagName: "span", selector: `${item} > span`, visibleText: title, attributes: { class: "x9title" }, parent: li, context: { listPosition } });
  const group = add({ tagName: "div", selector: `${item} > div`, visibleText: lines.join(""), attributes: { class: "x7f3q9k" }, parent: li, context: { listPosition } });
  lines.forEach((line, index) => {
    add({ tagName: "div", selector: lines.length === 1 ? `${item} > div > div` : `${item} > div > div:nth-of-type(${index + 1})`, visibleText: line, attributes: { class: "x4line" }, parent: group, context: { listPosition } });
  });
}

function resultsPage(): JsonObject[] {
  const elements: JsonObject[] = [];
  const container = elements.push({ tagName: "ul", selector: CONTAINER, attributes: { class: "x1list" } }) - 1;
  card(elements, container, 1, "Towels, 6 rolls", ["Pickup today", "Delivery today", "Shipping, arrives Thu"]);
  card(elements, container, 2, "Towels, 12 rolls", ["Delivery tomorrow"]);
  return elements;
}

function runtime() {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: URL_, title: "Results", interactiveElements: resultsPage() };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(STRUCTURE) as JsonValue } };
    }
  });
}

async function detected(evidence: ReturnType<typeof runtime>): Promise<WebLlmRepeatingStructure> {
  const result = await evidence.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  return result.evidence as WebLlmRepeatingStructure;
}

test("a lines column samples its lines joined as the page joins them, under a label that says so", async () => {
  const packet = await detected(runtime());
  const group = packet.fields.find((field) => field.key === LINES_KEY);
  assert.ok(group, JSON.stringify(packet.fields));
  // Bounded at forty characters and cut at a word, never ending on the separator.
  assert.equal(group.sample, "Pickup today · Delivery today…");
  assert.equal(group.label, "lines: 'Pickup today · Delivery today…'");
  assert.equal(group.kind, "text");
  // The container's own words run its lines together; they are never the sample.
  assert.equal(JSON.stringify(packet).includes("Pickup todayDelivery"), false);
  // The positional lines are shown as they were.
  assert.equal(packet.fields.find((field) => field.key === FIRST_LINE_KEY)?.sample, "Pickup today");
});

test("the handle keeps lines on the group's spec and on no other, so the read reads the group", async () => {
  const evidence = runtime();
  const packet = await detected(evidence);
  const resolved = evidence.resolveExtractionHandle({ ...SCOPE, handle: packet.extraction });
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  const fields = resolved.binding.extractList.fields;
  assert.deepEqual(fields[LINES_KEY], { kind: "text", selector: `:scope ${GROUP}`, required: true, lines: true });
  assert.deepEqual(fields[FIRST_LINE_KEY], { kind: "text", selector: `:scope > ${GROUP} > div:nth-of-type(1)`, required: true });
  // And the request reader the gateway lifts it with keeps it too.
  const request = webAutomationExtractListRequestValue({ item: resolved.binding.extractList.item, fields: fields as JsonValue, where: [{ field: LINES_KEY, contains: "Delivery" }] });
  assert.ok(request);
  assert.deepEqual(request.fields[LINES_KEY], { kind: "text", selector: `:scope ${GROUP}`, required: true, lines: true });
});

test("the request reader keeps lines on a text field only, keeps only true, and refuses a value that is not a boolean", () => {
  const read = (field: JsonObject) => webAutomationExtractListRequestValue({ item: "li", fields: { group: field } })?.fields.group;
  assert.deepEqual(read({ kind: "text", selector: "div.g", lines: true }), { kind: "text", selector: "div.g", lines: true });
  assert.deepEqual(read({ kind: "text", selector: "div.g", lines: false }), { kind: "text", selector: "div.g" });
  // Left behind on a kind that never reads it, as a stray header is.
  assert.deepEqual(read({ kind: "attribute", selector: "div.g", attribute: "title", lines: true }), { kind: "attribute", selector: "div.g", attribute: "title" });
  assert.equal(webAutomationExtractListRequestValue({ item: "li", fields: { group: { kind: "text", selector: "div.g", lines: "yes" } } }), undefined);
  assert.equal(WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR, " · ");
});

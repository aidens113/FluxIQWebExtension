// A column detection reads by kind rather than by position
// (`apps/extension/src/content/extraction/template-kind/`): live run
// `run-mvczv4jn-1b61183c` (step 0021) keyed its time column `span:1 > a`, which
// in the other item template is the author's link. Such a column is now read by
// a step anywhere in the item that names one kind -- `a.<meta>[aria-label]`,
// `a.<meta>[href^="/people/"]` -- and an element's `aria-label` that says more
// than its words is a column of its own (`.../extraction/stated-name/`).
//
// What the domain owes those columns: a sample read off the element the step
// names in the first item, which for a link folder means holding the prefix the
// page wrote (`/people/`) to the href the capture published resolved; and a
// handle that keeps every selector as detection wrote it.

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
const URL_ = "http://127.0.0.1:4173/feed/";
const CONTAINER = "body > div";
const TIME_KEY = "div_xhead_div_xbyline_span_1_a_x1meta";
const DATE_KEY = "div_xhead_div_xbyline_span_1_a_x1meta_aria-label";
const AUTHOR_KEY = "div_xhead_h3_a_x1meta";
const TIME = ":scope a.x1meta[aria-label]";
const AUTHOR = ':scope a.x1meta[href^="/feed/people/"]';

/** The detection the page answers once its columns are read by kind. */
const STRUCTURE = {
  ok: true,
  proposal: {
    container: CONTAINER,
    item: `${CONTAINER} > div.x2entry`,
    itemCount: 2,
    fields: [
      { key: AUTHOR_KEY, label: "div.xhead > h3 > a.x1meta", spec: { kind: "text", selector: AUTHOR, required: true }, coverage: 1 },
      { key: TIME_KEY, label: "div.xhead > div.xbyline > span:1 > a.x1meta", spec: { kind: "text", selector: TIME, required: true }, coverage: 1 },
      { key: DATE_KEY, label: "div.xhead > div.xbyline > span:1 > a.x1meta aria-label", spec: { kind: "attribute", selector: TIME, attribute: "aria-label", required: true }, coverage: 1 }
    ],
    confidence: 0.75
  }
};

/** One entry as the capture lists it: a personal one states `time · `, a group one `author · time · `. */
function entry(elements: JsonObject[], parent: number, position: number, values: { author: string; time: string; date: string; group?: string }): void {
  const add = (element: JsonObject): number => elements.push(element) - 1;
  const item = `${CONTAINER} > div:nth-of-type(${position})`;
  const context = { listPosition: { index: position, total: 2 } };
  const root = add({ tagName: "div", selector: item, attributes: { class: "x2entry" }, parent, context });
  const head = add({ tagName: "div", selector: `${item} > div`, attributes: { class: "xhead" }, parent: root, context });
  const h3 = add({ tagName: "h3", selector: `${item} > div > h3`, parent: head, context });
  const author = { class: "x1meta", href: `/feed/people/p${position}/?ref=${position}` };
  if (values.group === undefined) add({ tagName: "a", selector: `${item} > div > h3 > a`, visibleText: values.author, attributes: author, parent: h3, context });
  else add({ tagName: "a", selector: `${item} > div > h3 > a`, visibleText: values.group, attributes: { class: "x1meta", href: `/feed/groups/g${position}/` }, parent: h3, context });
  const byline = add({ tagName: "div", selector: `${item} > div > div`, attributes: { class: "xbyline" }, parent: head, context });
  const spans = values.group === undefined ? ["time", "dot"] : ["author", "dot", "time", "dot"];
  spans.forEach((part, index) => {
    const span = `${item} > div > div > span:nth-of-type(${index + 1})`;
    const holder = add(part === "dot"
      ? { tagName: "span", selector: span, visibleText: " · ", attributes: { "aria-hidden": "true" }, parent: byline, context }
      : { tagName: "span", selector: span, parent: byline, context });
    if (part === "author") add({ tagName: "a", selector: `${span} > a`, visibleText: values.author, attributes: author, parent: holder, context });
    if (part === "time") {
      const link = add({ tagName: "a", selector: `${span} > a`, visibleText: values.time, attributes: { class: "x1meta", href: `/feed/posts/${position}/`, "aria-label": values.date }, parent: holder, context });
      add({ tagName: "span", selector: `${span} > a > span`, visibleText: values.time, parent: link, context });
    }
  });
}

function feedPage(): JsonObject[] {
  const elements: JsonObject[] = [];
  const container = elements.push({ tagName: "div", selector: CONTAINER, attributes: { role: "feed" } }) - 1;
  entry(elements, container, 1, { author: "Aisha Khan", time: "1h", date: "Monday 21 September 2026 at 05:55" });
  entry(elements, container, 2, { author: "Elena Sokolova", time: "3h", date: "Monday 21 September 2026 at 03:10", group: "Seed Swap" });
  return elements;
}

function runtime() {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: URL_, title: "Feed", interactiveElements: feedPage() };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(STRUCTURE) as JsonValue } };
    }
  });
}

async function detected(evidence: ReturnType<typeof runtime>): Promise<WebLlmRepeatingStructure> {
  const result = await evidence.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  return result.evidence as WebLlmRepeatingStructure;
}

test("a column read by kind samples the element its step names, a link folder held to the published href", async () => {
  const packet = await detected(runtime());
  const sample = (key: string) => packet.fields.find((field) => field.key === key)?.sample;
  assert.equal(sample(TIME_KEY), "1h", JSON.stringify(packet.fields));
  assert.equal(sample(AUTHOR_KEY), "Aisha Khan", JSON.stringify(packet.fields));
  // The full date the time link states only in its aria-label is the date column's sample.
  assert.equal(sample(DATE_KEY), "Monday 21 September 2026 at 05:55", JSON.stringify(packet.fields));
});

test("the handle keeps each kind's selector as detection wrote it", async () => {
  const evidence = runtime();
  const packet = await detected(evidence);
  const resolved = evidence.resolveExtractionHandle({ ...SCOPE, handle: packet.extraction });
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  const fields = resolved.binding.extractList.fields;
  assert.deepEqual(fields[TIME_KEY], { kind: "text", selector: TIME, required: true });
  assert.deepEqual(fields[AUTHOR_KEY], { kind: "text", selector: AUTHOR, required: true });
  assert.deepEqual(fields[DATE_KEY], { kind: "attribute", selector: TIME, attribute: "aria-label", required: true });
});

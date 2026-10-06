// R2-U-9 (live run `run-muwansvz-a2b4a987`, moment 04): the chat's card for a
// detection read "Look · the repeating list on the page", because the
// detection's answer said nothing of what the list is. The answer now carries
// `list`, what the page itself calls the list -- the container's accessible
// name, a table's caption, or the heading straight before it -- and nothing
// when the page gives no such label, as that run's unlabelled results did.

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
const URL_ = "http://127.0.0.1:4173/scenarios/everything-store/search/";
const MAIN = "body > main";
const SECTION = `${MAIN} > section:nth-of-type(2)`;
const CONTAINER = `${SECTION} > ul`;

const STRUCTURE = {
  ok: true,
  proposal: {
    container: CONTAINER,
    item: `${CONTAINER} > li`,
    itemCount: 3,
    fields: [{ key: "name", label: "a", spec: { kind: "text", selector: ":scope > a", required: true }, coverage: 1 }],
    confidence: 0.8
  }
};

type Shape = {
  /** Attributes on the list container. */
  list?: Record<string, string>;
  /** Attributes on the section the list sits in. */
  section?: Record<string, string>;
  /** What comes before the list inside its section. */
  before?: "heading" | "header-block" | "paragraph";
  /** A sidebar before the section, with a heading of its own first. */
  sidebar?: boolean;
  /** An element elsewhere with this id, for `aria-labelledby`. */
  labelling?: { id: string; words: string };
};

/** The element with the attributes written by name, when there are any. */
function withAttributes(element: JsonObject, attributes: Record<string, string> | undefined): JsonObject {
  if (attributes !== undefined) element.attributes = attributes;
  return element;
}

/** The search page as the capture lists it: every element, its parent by index. */
function page(shape: Shape): JsonObject[] {
  const elements: JsonObject[] = [];
  const add = (element: JsonObject): number => elements.push(element) - 1;
  const main = add({ tagName: "main", selector: MAIN });
  if (shape.labelling) add({ tagName: "span", selector: `${MAIN} > span`, visibleText: shape.labelling.words, attributes: { id: shape.labelling.id }, parent: main });
  if (shape.sidebar) {
    const aside = add({ tagName: "section", selector: `${MAIN} > section:nth-of-type(1)`, parent: main });
    add({ tagName: "h2", selector: `${MAIN} > section:nth-of-type(1) > h2`, visibleText: "Filters", parent: aside });
    add({ tagName: "label", selector: `${MAIN} > section:nth-of-type(1) > label`, visibleText: "Under $50", parent: aside });
  }
  const section = add(withAttributes({ tagName: "section", selector: SECTION, parent: main }, shape.section));
  if (shape.before === "heading") add({ tagName: "h2", selector: `${SECTION} > h2`, visibleText: "Search results", parent: section });
  if (shape.before === "header-block") {
    const header = add({ tagName: "div", selector: `${SECTION} > div`, parent: section });
    add({ tagName: "span", selector: `${SECTION} > div > span`, visibleText: "3 items", parent: header });
    add({ tagName: "h3", selector: `${SECTION} > div > h3`, visibleText: "Wireless earbuds", parent: header });
  }
  if (shape.before === "paragraph") add({ tagName: "p", selector: `${SECTION} > p`, visibleText: "Prices include tax", parent: section });
  const list = add(withAttributes({ tagName: "ul", selector: CONTAINER, parent: section }, shape.list));
  for (const [index, name] of ["Pulse Buds", "Echo Pods", "Nova Air"].entries()) {
    const item = add({ tagName: "li", selector: `${CONTAINER} > li:nth-of-type(${index + 1})`, parent: list, context: { listPosition: { index: index + 1, total: 3 } } });
    add({ tagName: "a", selector: `${CONTAINER} > li:nth-of-type(${index + 1}) > a`, accessibleName: name, visibleText: name, attributes: { href: `/item/${index + 1}` }, parent: item });
  }
  return elements;
}

async function detected(shape: Shape): Promise<WebLlmRepeatingStructure> {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: URL_, title: "Search", interactiveElements: page(shape) };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(STRUCTURE) as JsonValue } };
    }
  });
  const result = await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  return result.evidence as WebLlmRepeatingStructure;
}

test("a list is named by the heading straight before it", async () => {
  const packet = await detected({ before: "heading" });
  assert.equal(packet.list, "Search results");
  // The name is the list's own, never words read inside an item.
  for (const words of ["Pulse Buds", "Echo Pods", "Nova Air"]) assert.equal(packet.list?.includes(words), false, `the list's name does not quote ${words}`);
});

test("a header block whose last element is a heading names the list", async () => {
  assert.equal((await detected({ before: "header-block" })).list, "Wireless earbuds");
});

test("the list's own accessible name comes first, from aria-label or aria-labelledby", async () => {
  assert.equal((await detected({ list: { "aria-label": "Results" }, before: "heading" })).list, "Results");
  assert.equal((await detected({ list: { "aria-labelledby": "results-title" }, labelling: { id: "results-title", words: "Earbuds under $50" } })).list, "Earbuds under $50");
});

test("a labelled section round the list names it", async () => {
  assert.equal((await detected({ section: { "aria-label": "Search results" } })).list, "Search results");
});

test("no name when the page gives none: no heading straight before, and never a sidebar's heading", async () => {
  // The live run's shape: the results in an unlabelled region with no heading of their own.
  assert.equal((await detected({})).list, undefined);
  assert.equal((await detected({ before: "paragraph" })).list, undefined);
  assert.equal((await detected({ sidebar: true })).list, undefined);
  assert.equal("list" in (await detected({ sidebar: true })), false, "an absent name is no key at all");
});

// The cells of a grouped grid (`cells.test.ts`) are shown with what their
// columns hold (t885, fix 32 R2 gap; run `run-mwcqv476-02419f96`, step 0020): the
// run's fields carried a `sample` and an `at`, the cells' fields only a key,
// label, kind and coverage, so a model asked for "the free times on Saturday"
// could not see which column held a day or which held a time. The cells' items
// are not the container's children but controls inside its groups, so the walk
// found none. The page below is a three-day grid of times, as the page sends it.
//
// What these rows prove:
// - every cells column with an element carries a sample read from a real cell:
//   the group's heading read in the group, an attribute's value from a cell that
//   has it, the cell's own words;
// - the columns the page view shows carry `at`, the cell's handle;
// - a state flag, which the main list's walk does not read either, carries none.

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
import { shownHandle } from "../../page-view/tests/shown-page-lines";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const WEEK = "body > div.week";
const DAY = `${WEEK} > div.day`;

const RUN_FIELD = { key: "head", label: "head", spec: { kind: "text", selector: ":scope > div.head", required: true }, coverage: 1 };
const STRUCTURE = {
  ok: true,
  proposal: { container: WEEK, item: DAY, itemCount: 3, fields: [RUN_FIELD], confidence: 0.7 },
  cells: {
    container: WEEK,
    item: `${WEEK} button.time`,
    itemCount: 5,
    fields: [
      { key: "group_heading", label: "group heading", spec: { kind: "text", selector: ":scope > div.head", group: DAY, required: false }, coverage: 1 },
      { key: "data_slot", label: "data-slot", spec: { kind: "attribute", selector: ":scope", attribute: "data-slot", required: false }, coverage: 0.8 },
      { key: "item_disabled", label: "item (disabled)", spec: { kind: "text", selector: ':scope:is([aria-disabled="true"], :disabled)', mark: "state", required: false }, coverage: 0.4 },
      { key: "item", label: "item", spec: { kind: "text", selector: ":scope", required: true }, coverage: 1 }
    ],
    confidence: 0.7
  }
};

/** Three days; the first has a taken slot without the `data-slot` attribute, so the attribute is read from the next cell. */
function page(): JsonObject[] {
  const elements: JsonObject[] = [];
  const add = (element: JsonObject): number => elements.push(element) - 1;
  const week = add({ tagName: "div", selector: WEEK, attributes: { class: "week" } });
  const days: Array<[string, Array<{ time: string; slot?: string; disabled?: boolean }>]> = [
    ["Mon 28/09", [{ time: "09:00", disabled: true }, { time: "10:00", slot: "mon-10" }]],
    ["Sat 03/10", [{ time: "11:00", slot: "sat-11" }, { time: "12:00", slot: "sat-12" }]],
    ["Sun 04/10", [{ time: "13:00", slot: "sun-13" }]]
  ];
  days.forEach(([heading, times], index) => {
    const day = `${WEEK} > div:nth-of-type(${index + 1})`;
    const group = add({ tagName: "div", selector: day, attributes: { class: "day" }, parent: week });
    add({ tagName: "div", selector: `${day} > div.head`, visibleText: heading, attributes: { class: "head" }, parent: group });
    times.forEach((slot, position) => {
      const attributes: Record<string, string> = { class: "time" };
      if (slot.slot !== undefined) attributes["data-slot"] = slot.slot;
      if (slot.disabled === true) attributes["aria-disabled"] = "true";
      add({ tagName: "button", selector: `${day} > button:nth-of-type(${position + 1})`, accessibleName: slot.time, visibleText: slot.time, attributes, parent: group });
    });
  });
  return elements;
}

function runtime(): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: "http://127.0.0.1:4173/book/", title: "Book", interactiveElements: page() };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(STRUCTURE) as JsonValue } };
    }
  });
}

async function cellsOfPage(): Promise<{ cells: NonNullable<WebLlmRepeatingStructure["cells"]>; shown: unknown }> {
  const evidence = runtime();
  const shown = (await evidence.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } })).evidence;
  const result = await evidence.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  const cells = (result.evidence as WebLlmRepeatingStructure).cells;
  assert.ok(cells, "the packet carries the cells");
  return { cells, shown };
}

test("the cells' columns carry a sample read from a real cell, a group's heading included", async () => {
  const { cells } = await cellsOfPage();
  const column = (key: string) => cells.fields.find((field) => field.key === key);
  assert.equal(column("group_heading")?.sample, "Mon 28/09", "the heading is read in the cell's group");
  assert.equal(column("group_heading")?.type, "text");
  assert.equal(column("data_slot")?.sample, "mon-10", "the attribute is read from the first cell that has it");
  assert.equal(column("item")?.sample, "09:00", "the cell's own words");
  assert.equal(column("item_disabled")?.sample, undefined, "a state flag is read from no element, as the main list's is");
});

test("the cells' columns carry the handle the page view gave their element", async () => {
  const { cells, shown } = await cellsOfPage();
  const at = Object.fromEntries(cells.fields.flatMap((field) => field.at === undefined ? [] : [[field.key, field.at]]));
  assert.equal(at.group_heading, shownHandle(shown, "Mon 28/09"));
  assert.equal(at.item, shownHandle(shown, "09:00"));
});

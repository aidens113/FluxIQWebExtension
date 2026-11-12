// A run's grid of grouped controls read one row per control (t885, R2): the
// detection's `cells` beside its run.
//
// What these rows prove, on an answer whose cells are written by hand in the
// shape `apps/extension/src/content/extraction/cell-run/` sends (a cinema's
// showings per day; the run is the reply-card thread of `record-detections.ts`,
// which only stands in for any run):
// - the wire reader keeps well-formed cells beside the run, the group a
//   heading column is read in included, and refuses malformed ones;
// - the cells get a handle of their own after the run's, and the packet names
//   them with their columns, their marks and when to name them -- no selector;
// - the handle resolves in the same scope, its heading column still read in
//   the group, so `extractList` reads one row per control.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationStructureDetectionValue } from "../../../../extraction";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmRepeatingStructure
} from "../..";
import { shownPageLines } from "../../page-view/tests/shown-page-lines";
import { RECORD_DETECTIONS, REPLY_CARD_LINK } from "./record-detections";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };

const HEADING = { kind: "text", selector: ":scope > div.head", group: "div.week > div.day", required: false };
const DISABLED = { kind: "text", selector: ':scope:is([aria-disabled="true"], :disabled)', mark: "state", required: false };

/** Six showings over three days, as the page sends them beside the run. */
const CELLS = {
  container: "div.week",
  item: "div.week div.time",
  itemCount: 6,
  fields: [
    { key: "group_heading", label: "group heading", spec: HEADING, coverage: 1 },
    { key: "item_disabled", label: "item (disabled)", spec: DISABLED, coverage: 0.33 },
    { key: "item", label: "item", spec: { kind: "text", selector: ":scope", required: true }, coverage: 1 }
  ],
  confidence: 0.7
};

/** The run's answer with the cells beside it. */
function withCells(cells: unknown = CELLS): Record<string, unknown> {
  const { record: _record, ...run } = structuredClone(RECORD_DETECTIONS["photo-social-reply-card"].structure) as Record<string, unknown>;
  return { ...run, cells: structuredClone(cells) };
}

/** A page that answers every detection with `structure`, and shows the card to a look. */
function pageRuntime(structure: unknown): WebAutomationLlmEvidenceRuntime {
  const capture = RECORD_DETECTIONS["photo-social-reply-card"];
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: capture.url, title: capture.title, interactiveElements: [structuredClone(REPLY_CARD_LINK) as unknown as JsonObject] };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(structure) as JsonValue } };
    }
  });
}

test("the wire keeps well-formed cells beside the run, with the group their heading is read in, and refuses malformed ones", () => {
  const read = webAutomationStructureDetectionValue(withCells());
  assert.ok(read?.ok === true);
  assert.equal(read.cells?.itemCount, 6);
  assert.deepEqual(read.cells?.fields[0]?.spec, HEADING);
  assert.equal(webAutomationStructureDetectionValue(withCells({ ...CELLS, fields: [] })), undefined, "cells with no column");
  assert.equal(webAutomationStructureDetectionValue(withCells({ ...CELLS, fields: [{ ...CELLS.fields[0], spec: { ...HEADING, group: 7 } }] })), undefined, "a group that is no selector");
});

test("the cells get a handle after the run's, and the packet names them with their columns, marks and when to use them", async () => {
  const runtime = pageRuntime(withCells());
  const inspected = await runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const [card] = shownPageLines(inspected.evidence);
  assert.ok(card);
  const detected = await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: { target: card.target } });
  const packet = detected.evidence as WebLlmRepeatingStructure;
  assert.equal(packet.extraction, "extraction.1", "the run is still the list");
  assert.equal(packet.cells?.handle, "extraction.2");
  assert.equal(packet.cells?.itemCount, 6);
  assert.deepEqual(packet.cells?.fields.map((field) => [field.key, field.label, field.kind]), [
    ["group_heading", "group heading", "text"], ["item_disabled", "item (disabled)", "text"], ["item", "item", "text"]
  ]);
  assert.deepEqual(packet.cells?.fieldMarks, [{ id: "item_disabled", label: "item (disabled)", kind: "state" }]);
  assert.match(packet.cells?.note ?? "", /one row per control inside its items/u);
  assert.ok(packet.markNote, "the marks are explained once");
  for (const selector of ["div.week", ":scope", "aria-disabled", "div.head"]) assert.equal(JSON.stringify(packet).includes(selector), false, `the packet quotes ${selector}`);

  const cells = runtime.resolveExtractionHandle({ ...SCOPE, handle: "extraction.2" });
  assert.ok(cells.ok, "the cells' handle resolves in the scope that detected them");
  assert.equal(cells.binding.extractList.item, "div.week div.time");
  assert.deepEqual(cells.binding.extractList.fields.group_heading, HEADING);
  assert.deepEqual(cells.binding.extractList.fields.item_disabled, DISABLED);
  assert.equal(cells.binding.oneRecord, undefined, "a list of controls reads every row");
});

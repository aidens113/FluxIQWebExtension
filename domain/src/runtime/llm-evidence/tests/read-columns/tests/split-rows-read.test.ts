// A read of a detected list that names another handle's keys is told which name
// is not a column, and every detection says how its handle is read (t1020).
//
// Live run `run-mwuuo3zk-75b482b3` was shown, in one packet, a results list of
// cards (long class-path keys) and the same list read one row per link
// (`cells`, three short keys). Its first read named the list's handle with two
// of the cells' keys and was refused with codes alone; it then read the cells,
// whose rows lacked the columns it needed, for the rest of the run. The page
// here is written by hand in the shape the content script sent for that page
// (`apps/extension/src/content/extraction/cell-run/` no longer offers cells for
// it, t1020, which its own test proves); it is a rental catalog, never the
// recorded site, and holds no recorded page data.
//
// What these prove:
// - the packet says, around the list's own handle, how it is read, that a key
//   under cells or record needs that handle, and how a new read replaces one
//   the draft holds;
// - a read of the list naming a cells key is refused with `next` naming that
//   key and saying where such a key belongs, and the name rides in `instead` so
//   the same refusal said again says the same;
// - the read naming the list's own keys runs.

import assert from "node:assert/strict";
import test from "node:test";
import { runWithAutomationStudioEvidenceBuildScope } from "fluxiq/automation";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_DETECT_STRUCTURE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmRepeatingStructure } from "../../..";

const SCOPE = { projectId: "project.one", flowId: "flow.one" } as const;
const EXTRACT_NODE = webAutomationOutputNodeId("web.dom.extract_list");
const URL = "http://127.0.0.1:4173/scenarios/tool-rental/search";

/** The card list and its one-row-per-link cells, as the content script answered such a page before t1020. */
const STRUCTURE = {
  ok: true,
  proposal: {
    container: "div.grid",
    item: "div.grid > div.tile",
    itemCount: 5,
    fields: [
      { key: "a_tile-link_url", label: "a.tile-link url", spec: { kind: "link", selector: ":scope > a.tile-link", required: true }, coverage: 1 },
      { key: "a_tile-link_span_sr", label: "a.tile-link > span.sr", spec: { kind: "text", selector: ":scope > a.tile-link > span.sr", required: true }, coverage: 1 },
      { key: "div_price_span_sr_currency_amount", label: "div.price > span.sr (currency amount)", spec: { kind: "text", selector: ":scope > div.price > span.sr", required: true }, coverage: 1 },
      { key: "div_rating_span_value_number", label: "div.rating > span.value (number)", spec: { kind: "text", selector: ":scope > div.rating > span.value", required: true }, coverage: 1 },
      { key: "div_pickup_div_line", label: "div.pickup > div.line", spec: { kind: "text", selector: ":scope > div.pickup > div.line", required: true }, coverage: 1 }
    ],
    confidence: 0.51
  },
  cells: {
    container: "div.grid",
    item: "div.grid a",
    itemCount: 6,
    fields: [
      { key: "group_heading", label: "group heading", spec: { kind: "text", selector: ":scope > div.price > span.sr", group: "div.grid > div.tile", required: false }, coverage: 1 },
      { key: "item_url", label: "item url", spec: { kind: "link", selector: ":scope", required: true }, coverage: 1 },
      { key: "span_sr", label: "span.sr", spec: { kind: "text", selector: ":scope span.sr", required: false }, coverage: 0.83 }
    ],
    confidence: 0.4
  }
};

function catalog(): { runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>; reads: JsonObject[] } {
  const reads: JsonObject[] = [];
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.extract_list") reads.push(structuredClone(command.parameters));
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: URL, title: "Tool rental", interactiveElements: [] };
      return { status: "succeeded", payload: { snapshot, structure: structuredClone(STRUCTURE) as unknown as JsonValue } };
    }
  });
  return { runtime, reads };
}

function inBuild<T>(run: () => T, opening?: "fresh"): T {
  return runWithAutomationStudioEvidenceBuildScope(opening ? { ...SCOPE, buildId: "build.one", opening } : { ...SCOPE, buildId: "build.one" }, run);
}

async function detected(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>): Promise<WebLlmRepeatingStructure> {
  await inBuild(() => runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } }), "fresh");
  const answer = await inBuild(() => runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} }));
  return answer.evidence as WebLlmRepeatingStructure;
}

const read = (runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, callId: string, extractList: JsonObject) =>
  inBuild(() => runtime.executeTool({ ...SCOPE, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: EXTRACT_NODE, parameters: { extractList }, consequences: [] } }));

type Refusal = { ok: false; detail: { reason: string; instead?: string[]; next?: string; repeatedAnswer?: number } };

test("the packet says how its handle is read, where another handle's keys belong, and how a new read replaces one the draft holds", async () => {
  const packet = await detected(catalog().runtime);
  assert.equal(packet.cells?.handle !== undefined && packet.cells.handle !== packet.extraction, true, "the cells keep a handle of their own");
  assert.match(packet.readNote, new RegExp(`naming "${packet.extraction.replace(".", "\\.")}" in extractList`, "u"));
  assert.match(packet.readNote, /a key under cells or record needs that handle/u);
  assert.match(packet.readNote, /run this read as a new step and drop the old read step/u);
  for (const word of ["tile", "price", "rating", "pickup", "$"]) assert.equal(packet.readNote.includes(word), false, `the note carries no page word: ${word}`);
});

test("a read of the list naming a cells key is told the key and where it belongs, and said again the same", async () => {
  const { runtime, reads } = catalog();
  const packet = await detected(runtime);
  const list = { handle: packet.extraction, fields: { url: "item_url", price: "div_price_span_sr_currency_amount", rating: "div_rating_span_value_number" }, minItems: 0 };
  const first = await read(runtime, "call.read.1", list);
  assert.equal(first.resultCode, "web.action.rejected.target_unobserved", JSON.stringify(first.evidence).slice(0, 400));
  const refusal = first.evidence as unknown as Refusal;
  assert.equal(refusal.detail.reason, "column_not_in_detected_list");
  assert.ok(refusal.detail.instead?.includes("web.handle.unknown_column.item_url"), JSON.stringify(refusal.detail.instead));
  assert.match(refusal.detail.next ?? "", /`item_url` is not a column of the list this read's handle names/u);
  assert.match(refusal.detail.next ?? "", /cells or record is a column of their own handle/u);
  assert.equal(reads.length, 0, "nothing was read");

  const again = (await read(runtime, "call.read.2", list)).evidence as unknown as Refusal;
  assert.equal(again.detail.repeatedAnswer, 2);
  assert.equal(again.detail.next, refusal.detail.next, "the repeat says the same");
});

test("the read naming the list's own keys runs, with every column the instruction needs", async () => {
  const { runtime, reads } = catalog();
  const packet = await detected(runtime);
  const fields = { url: "a_tile-link_url", name: "a_tile-link_span_sr", price: "div_price_span_sr_currency_amount", rating: "div_rating_span_value_number", pickup: "div_pickup_div_line" };
  const answer = await read(runtime, "call.read", { handle: packet.extraction, fields, minItems: 0 });
  assert.equal(answer.resultCode, "web.inspect.succeeded", JSON.stringify(answer.evidence).slice(0, 400));
  const sent = reads.at(-1)?.extractList as { item: string; fields: Record<string, unknown> };
  assert.equal(sent.item, "div.grid > div.tile", "the card is the row");
  assert.deepEqual(Object.keys(sent.fields).sort(), Object.keys(fields).sort());
});

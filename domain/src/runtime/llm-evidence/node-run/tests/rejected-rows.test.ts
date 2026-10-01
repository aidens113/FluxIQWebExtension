// The rows a list read's conditions turned down, shown to the exploring model
// and to nothing else (`../rejected-rows.ts`).
//
// The case is `run-munq5s8x-6d620cdf`'s: an accessory rule written as `name not
// contains ["ear tips", "charging case"]` rejected true earbuds named "...
// Wireless Charging Case ...", and the model saw only the count. The page is a
// stub here that answers with samples exactly when the command asks for them,
// which is what `content/actions/extract-list.ts` does.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationExtractListDispatch } from "../../../../output-nodes/extract-list";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway,
  type WebLlmRepeatingStructure
} from "../..";
import { WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS } from "../../capture";
import { CAPTURED_DETECTIONS } from "../../structure/tests/captured-detections";
import { WEB_NODE_REJECTED_ROWS_NOTE, webNodeReadWithRejectedRows } from "../rejected-rows";
import { WEB_LLM_WITHHELD_TEXT } from "../../withheld";

const CATALOG_CAPTURE = CAPTURED_DETECTIONS["product-catalog-largest"];
const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const PERMITTED = async () => ({ permitted: true as const });
const TRUE_EARBUDS = "Pro Earbuds Wireless Charging Case";

/** The three rows the name condition rejected, one of them a true answer. */
const SAMPLED = [{ name: TRUE_EARBUDS, price: "$39" }, { name: "Foam ear tips", price: "$9" }, { name: "Charging case for earbuds", price: "$12" }];

/** The read's account, with the samples the page adds only when asked. */
function extraction(asked: boolean): JsonObject {
  const account: JsonObject = {
    recordCount: 1,
    pagesRead: 1,
    truncated: false,
    missingFields: [],
    fieldNames: ["name", "price"],
    conditions: { applied: 4, kept: 1, rejected: [0, 3], unfiltered: false }
  };
  if (asked) account.rejectedSamples = [[], SAMPLED];
  return account;
}

function stub(): { gateway: WebLlmEvidenceGateway; commands: Array<{ actionType: string; parameters: JsonObject }> } {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.dom.extract_list") {
        const asked = command.parameters.rejectedSamples === true;
        return { status: "succeeded", payload: { extracted: [{ name: "Basic Earbuds", price: "$19" }], extraction: extraction(asked) } };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: CATALOG_CAPTURE.url, title: CATALOG_CAPTURE.title, interactiveElements: [] };
      return { status: "succeeded", payload: { snapshot, structure: structuredClone(CATALOG_CAPTURE.structure) as JsonValue } };
    }
  };
  return { gateway, commands };
}

const WHERE = [{ field: "price", lessThan: 50 }, { field: "name", contains: ["ear tips", "charging case"], not: true }];

async function explore() {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const detected = await runtime.executeTool({ ...PROJECT, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  const handle = (detected.evidence as WebLlmRepeatingStructure).extraction;
  const ran = await runtime.executeTool({
    ...PROJECT, callId: "call.run", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: "web.output.dom-extract_list", parameters: { extractList: { handle, fields: { name: "product-name", price: "product-price" }, where: WHERE } }, consequences: [] }
  });
  return { ran, runtime, stubbed };
}

test("an exploring list read shows the model the rows each condition rejected, beside the rows it kept", async () => {
  const { ran, stubbed } = await explore();
  assert.equal(ran.resultCode, "web.inspect.succeeded");
  // The one command that went out asked for the samples.
  const dispatched = stubbed.commands.find((command) => command.actionType === "web.dom.extract_list");
  assert.equal(dispatched?.parameters.rejectedSamples, true);
  const read = (ran.evidence as JsonObject).read as JsonObject;
  assert.deepEqual(read.extracted, [{ name: "Basic Earbuds", price: "$19" }]);
  // Only the condition that rejected something, by its position in `where`,
  // with its count and the rows: the true earbuds among them.
  assert.deepEqual(read.rejectedRows, [
    { where: 1, rejected: 3, rows: SAMPLED }
  ]);
  // Inside the evidence, never a new member of the execution result.
  for (const key of Object.keys(ran)) assert.equal(WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS.includes(key), true, key);
});

test("the samples are never in what the Flow keeps, and a playback of it asks for none", async () => {
  const { ran, runtime, stubbed } = await explore();
  // The exploring model saw the true earbuds, on a command that asked for them...
  assert.equal(stubbed.commands.find((command) => command.actionType === "web.dom.extract_list")?.parameters.rejectedSamples, true);
  assert.equal(JSON.stringify(ran.evidence).includes(TRUE_EARBUDS), true);
  // ...and nothing else holds them. Not the draft statement: not its
  // parameters, not its replay record.
  assert.equal(JSON.stringify(ran.draft).includes(TRUE_EARBUDS), false);
  const kept = ran.draft?.ranWith?.parameters as JsonObject;
  assert.equal(Object.hasOwn(kept, "rejectedSamples"), false);
  // A sample list is three long; the payload's longest list without them is two.
  assert.equal(ran.draft?.replay?.produced?.records, 2, "the replay counts the payload without samples");
  // The playback's own dispatch of those parameters carries no request for samples.
  const playback = webAutomationExtractListDispatch(kept);
  assert.ok(playback.ok, "the kept parameters dispatch");
  assert.equal(Object.hasOwn(playback.payload.parameters as JsonObject, "rejectedSamples"), false);
  // And Core's replay of the draft runs the same parameters, asking for none.
  const before = stubbed.commands.length;
  await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: { replay: "step", node: "web.output.dom-extract_list", parameters: kept, consequences: [] } });
  const replayed = stubbed.commands.slice(before).find((command) => command.actionType === "web.dom.extract_list");
  assert.ok(replayed, "the replay dispatched the read");
  assert.equal(Object.hasOwn(replayed.parameters, "rejectedSamples"), false);
});

test("the samples and the kept rows come back whole, with no byte budget, and the recorded payload holds no samples", () => {
  const row = (index: number) => ({ name: `${"x".repeat(70)} ${index}`, price: "$1" });
  const payload: JsonObject = {
    extracted: Array.from({ length: 40 }, (_unused, index) => row(index)),
    extraction: {
      recordCount: 40, pagesRead: 5, truncated: false, missingFields: [], fieldNames: ["name", "price"],
      conditions: { applied: 100, kept: 40, rejected: [20, 20, 20, 20], unfiltered: false },
      rejectedSamples: Array.from({ length: 4 }, (_unused, condition) => [row(condition), row(condition + 10), row(condition + 20)])
    }
  };
  const { read, recorded } = webNodeReadWithRejectedRows(payload);
  assert.equal(JSON.stringify(recorded).includes("rejectedSamples"), false);
  const whole = read as { extracted: unknown[]; rejectedRows: Array<{ rows: unknown[] }> };
  // Every kept row and every sampled row: nothing is dropped to fit (t200).
  assert.equal(whole.extracted.length, 40);
  assert.deepEqual(whole.rejectedRows.map((entry) => entry.rows.length), [3, 3, 3, 3]);
  // Nothing bounds what a page sends either (user, 2026-09-30): every rejected
  // row the page sent reaches the model, every value whole
  // (`actions/extraction/rejected-samples.ts`).
  const flooded = structuredClone(payload) as { extraction: { rejectedSamples: unknown[][] } };
  flooded.extraction.rejectedSamples[0] = Array.from({ length: 300 }, (_unused, index) => ({ name: `${index} ${"y".repeat(5_000)}` }));
  const all = webNodeReadWithRejectedRows(flooded as unknown as JsonObject).read as { rejectedRows: Array<{ rows: Array<{ name: string }> }> };
  assert.equal(all.rejectedRows[0]?.rows.length, 300);
  assert.equal(all.rejectedRows[0]?.rows[299]?.name, `299 ${"y".repeat(5_000)}`);
});

test("with every cap gone the screen still holds: a card number in a rejected row is withheld, and the rest of the row is whole", () => {
  const long = `Gift card ${"with a long description ".repeat(200)}`.trim();
  const payload: JsonObject = {
    extracted: [{ name: "Basic Earbuds", price: "$19" }],
    extraction: {
      recordCount: 1, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["name", "price"],
      conditions: { applied: 2, kept: 1, rejected: [1], unfiltered: false },
      rejectedSamples: [[{ name: long, price: "4111 1111 1111 1111" }]]
    }
  };
  const read = webNodeReadWithRejectedRows(payload).read as { rejectedRows: Array<{ rows: Array<{ name: string; price: string }> }> };
  assert.equal(read.rejectedRows[0]?.rows[0]?.price, WEB_LLM_WITHHELD_TEXT);
  assert.equal(read.rejectedRows[0]?.rows[0]?.name, long);
});

test("the model is shown, per condition, the rows it removed alone apart from the rows another condition also rejected, with one sentence on which to check", () => {
  // run-mup2u8o3-6697c4be: the accessory rule (where 1) rejected 4 rows here,
  // 2 of them alone -- a true pair and an accessory; the other 2 also failed price.
  const truePair = { name: "Ultra Earbuds with Wireless Charging Case", price: "$59" };
  const accessory = { name: "Charging Case Replacement for Ultra Earbuds", price: "$19" };
  const payload: JsonObject = {
    extracted: [{ name: "Basic Earbuds", price: "$19" }],
    extraction: {
      recordCount: 1, pagesRead: 2, truncated: false, missingFields: [], fieldNames: ["name", "price"],
      conditions: { applied: 7, kept: 1, rejected: [3, 4], unfiltered: false, alone: [1, 2] },
      rejectedSamples: [
        [{ name: "Studio Headphones", price: "$99" }, { name: "Premium ear tips", price: "$79" }, { name: "Deluxe charging case", price: "$89" }],
        [truePair, accessory, { name: "Premium ear tips", price: "$79" }, { name: "Deluxe charging case", price: "$89" }]
      ],
      rejectedSamplesAlone: [1, 2]
    }
  };
  const { read, recorded } = webNodeReadWithRejectedRows(payload);
  const shown = read as { rejectedRows: JsonObject[]; rejectedRowsNote?: string };
  assert.deepEqual(shown.rejectedRows, [
    { where: 0, rejected: 3, alone: 1, rowsAlone: [{ name: "Studio Headphones", price: "$99" }], rowsWithOthers: [{ name: "Premium ear tips", price: "$79" }, { name: "Deluxe charging case", price: "$89" }] },
    { where: 1, rejected: 4, alone: 2, rowsAlone: [truePair, accessory], rowsWithOthers: [{ name: "Premium ear tips", price: "$79" }, { name: "Deluxe charging case", price: "$89" }] }
  ]);
  assert.equal(shown.rejectedRowsNote, WEB_NODE_REJECTED_ROWS_NOTE);
  // Neither the rows nor their alone lead is in what the draft records; the count is, as a count.
  const kept = (recorded as JsonObject).extraction as JsonObject;
  assert.equal(Object.hasOwn(kept, "rejectedSamples"), false);
  assert.equal(Object.hasOwn(kept, "rejectedSamplesAlone"), false);
  assert.deepEqual((kept.conditions as JsonObject).alone, [1, 2]);
  // A page build that does not order its rows: every row, unsplit, and no sentence.
  const unordered = structuredClone(payload) as { extraction: JsonObject };
  delete unordered.extraction.rejectedSamplesAlone;
  const plain = webNodeReadWithRejectedRows(unordered as unknown as JsonObject).read as { rejectedRows: JsonObject[]; rejectedRowsNote?: string };
  assert.deepEqual(plain.rejectedRows[1], { where: 1, rejected: 4, alone: 2, rows: [truePair, accessory, { name: "Premium ear tips", price: "$79" }, { name: "Deluxe charging case", price: "$89" }] });
  assert.equal(plain.rejectedRowsNote, undefined);
});

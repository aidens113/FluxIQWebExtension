// t504, lane D round 17 (`run-mv6lgt3s-c3aa6fac`): a detected list's button
// column carried `at`, the handle of that button in the first item, and the
// model pressed it meaning "every row that qualifies" -- it was the first row's,
// which did not. A control column's `at` now carries `atItem`, the one item it
// sits in, by the place the page view marks and that item's words, so the
// handle cannot read as the whole column's. The page is a plain inbox.

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

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const URL_ = "https://mail.test/inbox";
const CONTAINER = "body > ul#inbox";

const MESSAGES = [
  { from: "Ana Ruiz", subject: "Invoice for March" },
  { from: "Ben Okafor", subject: "Team lunch" },
  { from: "Cleo Park", subject: "Quarterly report" }
];

const STRUCTURE = {
  ok: true,
  proposal: {
    container: CONTAINER,
    item: `${CONTAINER} > li.msg`,
    itemCount: MESSAGES.length,
    fields: [
      field("from", "from", ":scope > span.from"),
      field("subject", "subject", ":scope > span.subject"),
      field("archive", "archive", ":scope > button.archive")
    ],
    confidence: 0.9
  }
};

function field(key: string, label: string, selector: string): JsonObject {
  return { key, label, spec: { kind: "text", selector, required: true }, coverage: 1 };
}

function inboxPage(): JsonObject[] {
  const elements: JsonObject[] = [{ tagName: "h2", selector: "body > h2", visibleText: "Inbox" }];
  const container = elements.push({ tagName: "ul", selector: CONTAINER, attributes: { id: "inbox" } }) - 1;
  MESSAGES.forEach((message, index) => {
    const item = `${CONTAINER} > li:nth-of-type(${index + 1})`;
    const listPosition = { index: index + 1, total: MESSAGES.length };
    const row = elements.push({ tagName: "li", selector: item, attributes: { class: "msg" }, parent: container, context: { listPosition } }) - 1;
    elements.push({ tagName: "span", selector: `${item} > span.from`, visibleText: message.from, attributes: { class: "from" }, parent: row, context: { listPosition } });
    elements.push({ tagName: "span", selector: `${item} > span.subject`, visibleText: message.subject, attributes: { class: "subject" }, parent: row, context: { listPosition } });
    elements.push({ tagName: "button", selector: `${item} > button.archive`, visibleText: "Archive", attributes: { class: "archive" }, parent: row, context: { listPosition } });
  });
  return elements;
}

function runtimeOver(elements: () => JsonObject[]): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: URL_, title: "Inbox", interactiveElements: elements() };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(STRUCTURE) as JsonValue } };
    }
  });
}

async function look(runtime: WebAutomationLlmEvidenceRuntime): Promise<unknown> {
  return (await runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } })).evidence;
}

async function detect(runtime: WebAutomationLlmEvidenceRuntime): Promise<WebLlmRepeatingStructure> {
  const result = await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  return result.evidence as WebLlmRepeatingStructure;
}

test("a button column's at names the one item it sits in, by its place and words", async () => {
  const runtime = runtimeOver(inboxPage);
  const shown = await look(runtime);
  const packet = await detect(runtime);
  const archives = shownPageLines(shown).filter((line) => line.words === "Archive").map((line) => line.target);
  assert.equal(archives.length, MESSAGES.length, "each row's Archive has a line of its own");

  const archive = packet.fields.find((shownField) => shownField.key === "archive");
  assert.equal(archive?.at, archives[0], "at is the first row's Archive");
  assert.equal(archive?.atItem, "item 1/3 (Ana Ruiz, Invoice for March)");
  // Text columns are not acted on: they carry no item, and the packet quotes no other row.
  for (const key of ["from", "subject"]) assert.equal(packet.fields.find((shownField) => shownField.key === key)?.atItem, undefined, key);
  const wire = JSON.stringify(packet);
  for (const words of ["Ben Okafor", "Cleo Park", "Team lunch"]) assert.equal(wire.includes(words), false, `the packet does not quote ${words}`);
});

test("the note says a control's at is that one item's, never the whole column's", async () => {
  const runtime = runtimeOver(inboxPage);
  await look(runtime);
  const packet = await detect(runtime);
  assert.match(packet.atNote ?? "", /never of the whole column/u);
  assert.match(packet.atNote ?? "", /atItem/u);
  // What it said before still holds (`./column-at.test.ts`).
  assert.match(packet.atNote ?? "", /that item's own element, so acting on it acts on that item only/u);
});

test("with no page shown there is no at, so no item either", async () => {
  const packet = await detect(runtimeOver(inboxPage));
  assert.equal(packet.fields.some((shownField) => shownField.at !== undefined || shownField.atItem !== undefined), false);
});

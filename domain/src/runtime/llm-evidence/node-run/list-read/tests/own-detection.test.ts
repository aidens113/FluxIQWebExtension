// A list read is one call that detects its own list (t1038, D13), end to end through the runtime against a stub page:
// named by a line of the page view, by its words or by nothing, the read detects the list there, keeps every column
// under its readable name, and the step it becomes names the issued list and holds what it stands for.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const EXTRACT = "web.output.dom-extract_list";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const READ_PERMITTED = async () => ({ permitted: true as const });

/** A detected list whose columns a build tool's class names labelled, as a styled-component site's are. */
const STRUCTURE: JsonValue = {
  ok: true,
  proposal: {
    container: "ul.css-1a2b",
    item: "ul.css-1a2b > li.css-2c3d",
    itemCount: 2,
    fields: [
      { key: "li_css-2c3d_a_css-3e4f", label: "li.css-2c3d > a.css-3e4f", spec: { kind: "text", selector: "a.css-3e4f", required: true }, coverage: 1 },
      { key: "li_css-2c3d_a_css-3e4f_url", label: "li.css-2c3d > a.css-3e4f url", spec: { kind: "link", selector: "a.css-3e4f", required: true }, coverage: 1 },
      { key: "li_css-2c3d_span_css-5g6h", label: "li.css-2c3d > span.css-5g6h", spec: { kind: "text", selector: "span.css-5g6h", required: true }, coverage: 1 }
    ],
    confidence: 1
  }
};

type Sent = { actionType: string; parameters: JsonObject };

/** A page with a heading over a two-item list; the detection answers `STRUCTURE`, and a read answers two rows under whatever keys it asked. */
function listPage(): WebLlmEvidenceGateway & { sent: Sent[] } {
  const sent: Sent[] = [];
  return {
    sent,
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      sent.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.dom.capture_snapshot") {
        const snapshot = {
          url: "https://recipes.test/search?q=soup",
          title: "Soups",
          viewport: { width: 1000, height: 1000, scrollX: 0, scrollY: 0 },
          interactiveElements: [
            { tagName: "h2", selector: "#soups-heading", visibleText: "Soups to try" },
            { tagName: "a", selector: "#first", visibleText: "Leek soup", href: "https://recipes.test/r/1" },
            { tagName: "a", selector: "#second", visibleText: "Bean soup", href: "https://recipes.test/r/2" }
          ]
        };
        return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(STRUCTURE) } };
      }
      const list = command.parameters.extractList as JsonObject;
      const keys = Object.keys(list.fields as JsonObject);
      const rows = ["Leek soup", "Bean soup"].map((words) => Object.fromEntries(keys.map((key) => [key, words])));
      return { status: "succeeded", payload: { extracted: rows, extraction: { recordCount: 2, pagesRead: 1, itemsSeen: 2, truncated: false, fieldNames: keys, missingFields: [] } } };
    }
  };
}

/** The page looked at once, as a build does before it reads; `run` then runs one read with the parameters given. */
async function looked() {
  const gateway = listPage();
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const look = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const handleOf = (words: string) => shownHandle(look.evidence, words);
  gateway.sent.length = 0;
  return { gateway, handleOf, run: async (parameters: JsonObject) => await runtime.executeTool({ ...PROJECT, callId: "call.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: READ_PERMITTED, value: { node: EXTRACT, parameters, consequences: [] } }) };
}

function detections(sent: readonly Sent[]): JsonObject[] {
  return sent.flatMap((command) => command.actionType === "web.dom.capture_snapshot" && command.parameters.detectStructure !== undefined ? [command.parameters.detectStructure as JsonObject] : []);
}

function readList(sent: readonly Sent[]): JsonObject | undefined {
  return sent.find((command) => command.actionType === "web.dom.extract_list")?.parameters.extractList as JsonObject | undefined;
}

test("a read named by a line of the list detects the list there and keeps every column under its readable name", async () => {
  const setup = await looked();
  const result = await setup.run({ extractList: { handle: setup.handleOf("Leek soup") } });
  assert.equal(result.effectApplied, true, JSON.stringify(result.evidence).slice(0, 600));
  // One call: the detection around the line, then the read of the list it found.
  assert.deepEqual(detections(setup.gateway.sent), [{ selector: "#first" }]);
  const sentList = readList(setup.gateway.sent)!;
  assert.equal(sentList.item, "ul.css-1a2b > li.css-2c3d");
  assert.deepEqual(Object.keys(sentList.fields as JsonObject), ["link", "url", "text"]);
  // The read tells the model the names it kept.
  const outcome = result.evidence as JsonObject & { read?: JsonObject };
  assert.deepEqual(outcome.read?.columns, ["link", "url", "text"]);
  assert.deepEqual((outcome.read?.extracted as JsonObject[])[0], { link: "Leek soup", url: "Leek soup", text: "Leek soup" });
  // The step names the list the read issued and holds what it stands for, so it runs again without detecting.
  const ranWith = (result.draft as { ranWith?: { parameters?: JsonObject } }).ranWith!.parameters!.extractList as JsonObject;
  assert.match(String(ranWith.handle), /^extraction\.\d+$/u);
  assert.deepEqual((ranWith.extractionBinding as JsonObject).names, { "li_css-2c3d_a_css-3e4f": "link", "li_css-2c3d_a_css-3e4f_url": "url", "li_css-2c3d_span_css-5g6h": "text" });
});

test("fields picks columns by name or by detected key, and every other column is still kept", async () => {
  const setup = await looked();
  const result = await setup.run({ extractList: { handle: setup.handleOf("Leek soup"), fields: { title: "link", where: "li_css-2c3d_a_css-3e4f_url" } } });
  assert.equal(result.effectApplied, true, JSON.stringify(result.evidence).slice(0, 600));
  const sentList = readList(setup.gateway.sent)!;
  assert.deepEqual(Object.keys(sentList.fields as JsonObject), ["title", "where", "text"]);
  assert.deepEqual(sentList.askedFields, ["title", "where"]);
  const outcome = result.evidence as JsonObject & { read?: JsonObject };
  assert.deepEqual(outcome.read?.asked, ["title", "where"]);
});

test("a read naming nothing reads the page's largest list", async () => {
  const setup = await looked();
  const result = await setup.run({ extractList: {} });
  assert.equal(result.effectApplied, true, JSON.stringify(result.evidence).slice(0, 600));
  assert.deepEqual(detections(setup.gateway.sent), [{}]);
  assert.equal(readList(setup.gateway.sent)?.item, "ul.css-1a2b > li.css-2c3d");
});

test("a read named by words detects around the first line that shows them", async () => {
  const setup = await looked();
  const result = await setup.run({ extractList: { words: "soups to try" } });
  assert.equal(result.effectApplied, true, JSON.stringify(result.evidence).slice(0, 600));
  assert.deepEqual(detections(setup.gateway.sent), [{ selector: "#soups-heading" }]);
});

test("words no line shows are refused, never read as the page's largest list", async () => {
  const setup = await looked();
  const result = await setup.run({ extractList: { words: "Customer rating" } });
  assert.equal(result.effectApplied, false);
  assert.deepEqual(detections(setup.gateway.sent), []);
  assert.equal(readList(setup.gateway.sent), undefined, "nothing was read");
  const detail = (result.evidence as { detail?: { reason?: string; next?: string } }).detail;
  assert.equal(detail?.reason, "list_not_on_page");
  assert.match(String(detail?.next), /no line of this page's view shows the words/u);
  assert.doesNotMatch(String(detail?.next), /[Dd]etect/u);
});

test("an element read with only its own columns is still its own one-row table, and detects nothing (t903)", async () => {
  const setup = await looked();
  const result = await setup.run({ extractList: { handle: setup.handleOf("Soups to try"), fields: { heading: "text" } } });
  assert.equal(result.effectApplied, true, JSON.stringify(result.evidence).slice(0, 600));
  assert.deepEqual(detections(setup.gateway.sent), []);
  assert.deepEqual(readList(setup.gateway.sent)?.item, "#soups-heading");
});

test("a line outside the list reads the record it sits in, but a heading names the list under it", async () => {
  const withRecord = structuredClone(STRUCTURE) as JsonObject & { record?: JsonValue };
  withRecord.record = {
    container: "aside.css-7k8l",
    item: "aside.css-7k8l",
    itemCount: 1,
    fields: [{ key: "aside_css-7k8l_p", label: "aside.css-7k8l > p", spec: { kind: "text", selector: "p", required: true }, coverage: 1 }],
    confidence: 1
  };
  for (const [words, item] of [["Soups to try", "ul.css-1a2b > li.css-2c3d"], ["Bean soup", "aside.css-7k8l"]] as const) {
    const gateway = listPage();
    const answer = gateway.executeAction.bind(gateway);
    gateway.executeAction = async (sessionId, command) => {
      const result = await answer(sessionId, command);
      if (command.parameters.detectStructure !== undefined) (result.payload as JsonObject).structure = structuredClone(withRecord) as JsonValue;
      return result;
    };
    const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
    const look = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
    const result = await runtime.executeTool({ ...PROJECT, callId: "call.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: READ_PERMITTED, value: { node: EXTRACT, parameters: { extractList: { handle: shownHandle(look.evidence, words) } }, consequences: [] } });
    assert.equal(result.effectApplied, true, JSON.stringify(result.evidence).slice(0, 600));
    assert.equal(readList(gateway.sent)?.item, item, words);
  }
});

// One element read as a one-row table, end to end against a stub page (t903, F1).
//
// On `run-mwbkuxqt-c57f42cb` the asked table was one row: the account menu's
// "Followed stores" line under a column the task named. The line sat in a
// closed menu, so only a search printed its handle. A read of that handle ran
// four times and made no row; Extract List made rows only of a detected list,
// and detection refused the handle. The page below has that shape, with other
// words: a header line listed only when a capture asks for hidden elements.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_FIND_ON_PAGE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../../..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const READ = "web.output.dom-extract_list";
const READ_PERMITTED = async () => ({ permitted: true as const });
const LINE = '[data-testid="saved-lists"]';
const WORDS = "Saved lists: Winter coats; Desk lamps; Garden chairs; Reading glasses; Travel mugs; Wall clocks";

type Sent = { actionType: string; parameters: JsonObject };

function runtimeOver(sent: Sent[]): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      sent.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.dom.extract_list") {
        return { status: "succeeded", payload: { extracted: [{ saved: WORDS }], extraction: { recordCount: 1, pagesRead: 1, itemsSeen: 1, truncated: false, fieldNames: ["saved"], missingFields: [] } } };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const interactiveElements: JsonObject[] = [{ tagName: "button", selector: "#account", accessibleName: "Account" }];
      if (command.parameters.includeHidden === true) interactiveElements.push({ tagName: "p", selector: LINE, visibleText: WORDS, attributes: { "data-testid": "saved-lists" }, hidden: true });
      return { status: "succeeded", payload: { snapshot: { url: "https://shop.test/home", title: "Shop", interactiveElements } } };
    }
  });
}

/** The handle a search printed for the hidden line. */
async function lineHandle(runtime: WebAutomationLlmEvidenceRuntime): Promise<string> {
  await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const found = await runtime.executeTool({ ...PROJECT, callId: "call.find", toolId: WEB_LLM_FIND_ON_PAGE_TOOL_ID, value: { query: "saved lists" } });
  const handle = /^(t\d+) p "/mu.exec(String((found.evidence as JsonObject).found))?.[1];
  assert.ok(handle !== undefined, String((found.evidence as JsonObject).found));
  return handle;
}

test("Extract List reads one element named by its own handle as a one-row table under the plan's key", async () => {
  const sent: Sent[] = [];
  const runtime = runtimeOver(sent);
  const handle = await lineHandle(runtime);

  const read = await runtime.executeTool({ ...PROJECT, callId: "call.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: READ_PERMITTED, value: { node: READ, parameters: { extractList: { handle, fields: { saved: "text" } } }, consequences: [] } });
  assert.equal(read.resultCode, "web.inspect.succeeded", JSON.stringify(read.evidence).slice(0, 600));
  // The page is asked for the element itself as the one item, its own words as the column.
  const dispatched = sent.find((entry) => entry.actionType === "web.dom.extract_list")?.parameters.extractList as JsonObject | undefined;
  assert.deepEqual(dispatched, { item: LINE, fields: { saved: { selector: ":scope", kind: "text" } }, maxItems: 1 });
  // The rows come back as rows, under the read's rows key, an array of one.
  const rows = ((read.evidence as JsonObject).read as JsonObject | undefined)?.extracted;
  assert.deepEqual(rows, [{ saved: WORDS }]);

  // The step keeps the list's handle and what it stands for, never the `tN`, so it runs again with no memory.
  const kept = (read.draft?.ranWith?.parameters as JsonObject | undefined)?.extractList as JsonObject | undefined;
  assert.match(String(kept?.handle), /^extraction\.\d+$/u);
  assert.deepEqual((kept?.extractionBinding as JsonObject | undefined)?.extractList, { item: LINE, fields: { text: { selector: ":scope", kind: "text" } } });
  assert.equal((kept?.extractionBinding as JsonObject | undefined)?.oneRecord, true);
  assert.equal(JSON.stringify(kept).includes(handle), false, "the target handle is not what the step keeps");

  // The same element read again is the same list, not a second one.
  const again = await runtime.executeTool({ ...PROJECT, callId: "call.read.again", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: READ_PERMITTED, value: { node: READ, parameters: { extractList: { handle } }, consequences: [] } });
  assert.equal(((again.draft?.ranWith?.parameters as JsonObject | undefined)?.extractList as JsonObject | undefined)?.handle, kept?.handle);
});

test("a handle no view or look printed is refused at the list's handle, and nothing is read", async () => {
  const sent: Sent[] = [];
  const runtime = runtimeOver(sent);
  await lineHandle(runtime);
  const read = await runtime.executeTool({ ...PROJECT, callId: "call.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: READ_PERMITTED, value: { node: READ, parameters: { extractList: { handle: "t99", fields: { saved: "text" } } }, consequences: [] } });
  assert.notEqual(read.resultCode, "web.inspect.succeeded");
  assert.match(JSON.stringify(read.evidence), /extractList\.handle/u);
  assert.equal(sent.some((entry) => entry.actionType === "web.dom.extract_list"), false);
});

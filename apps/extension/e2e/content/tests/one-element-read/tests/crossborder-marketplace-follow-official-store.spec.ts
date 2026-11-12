// Can the product store `crossborder-marketplace-follow-official-store`'s one-row table off the real site, with no Lab
// run and no model? (t903, F1 and F2)
//
// The task follows Voltbay Official Store and asks for "a one-row table with column following containing my account's
// Followed stores line exactly as the account writes it". Its oracle is one record, `{following: ...}`, from the
// manifest (`extracted[0].records`), imported, never copied. On `run-mwbkuxqt-c57f42cb` the model followed the store
// right and stored no row: the line sits in the account menu, which opens only on hover, so only a search printed its
// handle; Extract read it into a value that is no row, and detection refused the handle. A person points at the
// account control, the menu opens, and the line is read; so does this walk, with the hover node (F5).
//
// Every act on the page is the content script's own (`harness.runAction`), aimed at the element its own snapshot lists
// under the words a person names it by, and every read goes through the domain's evidence runtime with scripted
// decisions, as a model would make them: a look, a search for the line's words, and Extract List naming the handle the
// search printed, its words under the task's column. The commands reach the page as the gateway's own mapping sends
// them and the answers come back as it maps them (`@fluxiq-web-extension/domain/client`). One step is the person's and
// not the product's: the listing opens in a new tab, which a harness bound to one tab cannot follow, so the tab goes to
// the address the listing's own link names.

import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_FIND_ON_PAGE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import { webAutomationActionFromGatewayCommand, webAutomationActionResultPayload } from "@fluxiq-web-extension/domain/client";
import { crossborderMarketplaceManifest } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/manifest/index.js";
import { VOLTBAY_OFFICIAL_ID } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/catalog/index.js";
import type { BrowserActionCommand, BrowserActionResult, DomElementDescriptor } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const BASE = { projectId: "project.follow-store", flowId: "flow.follow-store", maxEvidenceBytes: 48_000 } as const;
const READ_PERMITTED = async () => ({ permitted: true as const });
const followOfficialStoreWorkflow = crossborderMarketplaceManifest.workflows!.find((workflow) => workflow.id === "follow-official-store")!;
let commandCount = 0;

const run = (harness: ContentHarness, action: Omit<BrowserActionCommand, "commandId">): Promise<BrowserActionResult> =>
  harness.runAction({ commandId: `follow-proof.${++commandCount}`, ...action } as BrowserActionCommand);

async function contentReady(harness: ContentHarness): Promise<void> {
  await harness.page.waitForLoadState("load");
  await expect.poll(async () => (await harness.messages().catch(() => [])).some((message) => message.type === "fluxiq.contentReady"), { timeout: 15_000 }).toBe(true);
}

const words = (element: DomElementDescriptor): string => (element.visibleText ?? element.text ?? element.accessibleName ?? "").replace(/\s+/gu, " ").trim();

/** Presses the one control the content script's snapshot lists under exactly `label`. */
async function press(harness: ContentHarness, label: string): Promise<void> {
  const found = (await harness.capture()).interactiveElements.filter((element) => words(element) === label);
  expect(found, `the snapshot lists exactly one control named "${label}"`).toHaveLength(1);
  const reply = await run(harness, { actionType: "web.dom.click", selector: found[0]!.selector });
  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
}

async function waitForText(harness: ContentHarness, text: string): Promise<void> {
  expect((await run(harness, { actionType: "web.dom.wait_for_text", text, timeoutMs: 8_000 })).status, `"${text}" appears`).toBe("succeeded");
}

/** The domain's evidence runtime over the content script, as the gateway maps commands and answers. */
function evidenceRuntime(harness: ContentHarness) {
  const sent: Array<{ actionType: string; parameters: JsonObject }> = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.live-browser"],
    structureDetectionSessionIds: () => ["session.live-browser"],
    executeAction: async (_sessionId, request) => {
      sent.push({ actionType: request.actionType, parameters: request.parameters });
      const action = webAutomationActionFromGatewayCommand({ commandId: `follow-proof.${++commandCount}`, actionType: request.actionType, parameters: request.parameters, metadata: request.metadata, ...(request.timeoutMs === undefined ? {} : { timeoutMs: request.timeoutMs }) });
      if ("status" in action) return { status: "failed", error: action.message };
      const reply = await harness.runAction(action as BrowserActionCommand);
      // The worker sends the content script's reply on as JSON, so it is read back as the result the mapping takes.
      const result = JSON.parse(JSON.stringify(reply)) as Parameters<typeof webAutomationActionResultPayload>[0];
      return { status: reply.status, payload: webAutomationActionResultPayload(result), ...(result.failure === undefined ? {} : { failure: result.failure }) };
    }
  };
  return { runtime: createWebAutomationLlmEvidenceRuntime(gateway), sent };
}

/** Arrive, answer the two popups, search, go to the official listing, and follow its store. */
async function followOfficialStore(harness: ContentHarness): Promise<void> {
  await waitForText(harness, "Welcome back, Mara!");
  await press(harness, "No thanks");
  await press(harness, "Accept all");
  const boxes = (await harness.capture()).interactiveElements.filter((element) => element.tagName.toLowerCase() === "input" && (element.name ?? element.attributes?.name) === "q");
  expect(boxes).toHaveLength(1);
  expect((await run(harness, { actionType: "web.dom.type", selector: boxes[0]!.selector, text: "usb c hub" })).status).toBe("succeeded");
  const before = harness.page.url();
  expect((await run(harness, { actionType: "web.dom.keypress", selector: boxes[0]!.selector, key: "Enter" })).status).toBe("succeeded");
  await harness.page.waitForURL((url) => url.href !== before, { timeout: 15_000 });
  await contentReady(harness);
  await waitForText(harness, "Voltbay Official Store");
  // The person's step: the listing's own link, followed in this tab (header).
  const link = (await harness.capture()).interactiveElements.find((element) => (element.href ?? element.attributes?.href ?? "").endsWith(`/item/${VOLTBAY_OFFICIAL_ID}`));
  expect(link, "the results link the official listing").toBeDefined();
  await harness.page.goto(new URL(link!.href ?? link!.attributes!.href!, harness.page.url()).href);
  await contentReady(harness);
  await press(harness, "Follow");
  await waitForText(harness, "Following");
}

test("crossborder-marketplace follow-official-store: the account's line, found by a search, is read as the task's one-row table", async ({ openHarness }) => {
  test.setTimeout(180_000);
  const harness = await openHarness("crossborder-marketplace");
  await followOfficialStore(harness);
  const state = (await harness.finalState()).state as unknown as { following: string[] };
  expect(state.following, "the act: the official store followed, the three before it kept").toEqual(["hubsmith", "mirafone", "qinport", "voltbay-official"]);

  const read = evidenceRuntime(harness);
  await read.runtime.executeTool({ ...BASE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  // The line sits in the account menu, which is closed: the page view does not show it, and the search does.
  const found = await read.runtime.executeTool({ ...BASE, callId: "call.find", toolId: WEB_LLM_FIND_ON_PAGE_TOOL_ID, value: { query: "Followed stores" } });
  const matches = String((found.evidence as JsonObject).found);
  const line = /^(t\d+) p "(Followed stores: [^"]*)" not rendered$/mu.exec(matches);
  expect(line, matches).not.toBeNull();
  const expected = followOfficialStoreWorkflow.expected.extracted![0]!.records!;
  // F4a: the search prints the whole line, never its first eighty characters.
  expect(line![2]).toBe(expected[0]!.following);

  // F2: the handle the search printed binds a detection too, as it binds a read.
  const detected = await read.runtime.executeTool({ ...BASE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: { target: line![1]! } });
  expect(JSON.stringify(detected.evidence)).not.toContain("handle_not_in_packet");

  // Read while the menu is closed, the page says the line is there and not shown, and what may show it.
  const unshown = await read.runtime.executeTool({ ...BASE, callId: "call.read.closed", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: READ_PERMITTED, value: { node: "web.output.dom-extract_list", parameters: { extractList: { handle: line![1]!, fields: { following: "text" } } }, consequences: [] } });
  expect(JSON.stringify(unshown.evidence)).toContain("items_not_rendered");
  expect(JSON.stringify(unshown.evidence)).toContain("a hover or a click");

  // F5: a person points at the account control and the menu opens; so does the hover node. Its own words are
  // "Welcome back", over the name in a child element; the shop's welcome popup says "Welcome back, Mara!".
  const accountFound = await read.runtime.executeTool({ ...BASE, callId: "call.find.account", toolId: WEB_LLM_FIND_ON_PAGE_TOOL_ID, value: { query: "Welcome back" } });
  const account = /^(t\d+) \S+ "Welcome back(?:\s*Mara)?"/mu.exec(String((accountFound.evidence as JsonObject).found));
  expect(account, String((accountFound.evidence as JsonObject).found)).not.toBeNull();
  const hovered = await read.runtime.executeTool({ ...BASE, callId: "call.hover", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: READ_PERMITTED, value: { node: "web.output.dom-hover", parameters: { target: { handle: account![1]! } }, consequences: [] } });
  expect(hovered.resultCode, JSON.stringify(hovered.evidence).slice(0, 1_000)).not.toContain("rejected");
  await expect(harness.page.getByTestId("followed-stores")).toBeVisible();

  // F1: Extract List names the line by its own handle; its words are the task's column.
  const openFound = await read.runtime.executeTool({ ...BASE, callId: "call.find.open", toolId: WEB_LLM_FIND_ON_PAGE_TOOL_ID, value: { query: "Followed stores" } });
  const shown = /^(t\d+) p "(Followed stores: [^"]*)"/mu.exec(String((openFound.evidence as JsonObject).found));
  expect(shown).not.toBeNull();
  const table = await read.runtime.executeTool({ ...BASE, callId: "call.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: READ_PERMITTED, value: { node: "web.output.dom-extract_list", parameters: { extractList: { handle: shown![1]!, fields: { following: "text" } } }, consequences: [] } });
  expect(table.resultCode, JSON.stringify(table.evidence).slice(0, 1_000)).toBe("web.inspect.succeeded");
  const rows = ((table.evidence as JsonObject).read as JsonObject | undefined)?.extracted;
  expect(rows, "the rows under the read's rows key are the oracle's one record").toEqual(expected);
});

// A read or a detection that names a handle which is no list of this page is told where a list is detected and read
// (t1034). The recorded shape, bigbox run run-mwveg5ls-0266dfe0: on the basket page a search printed the handle of a
// quantity label (steps 109, 128); the run went back to the results page and, asked for the basket as a table, read
// that label's handle with columns item, quantity and price (steps 240, 242) and asked to detect a list at it (steps
// 275, 286). The first was told the names were not columns "of the list this read's handle names" and to use "keys from
// this list's own fields" -- there was no list -- and the second was told nothing at all. It never went back to the
// basket page or detected the basket's list there. The pages here are written by hand (a garden shop), never the
// recorded site, and hold no recorded page data.
import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webLlmShownPageText } from "../../shown-page";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_DETECT_STRUCTURE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const READ = "web.output.dom-extract_list";
const READ_PERMITTED = async () => ({ permitted: true as const });
const BASKET = "https://garden.test/basket";
const RESULTS = "https://garden.test/search?q=seed+trays";

type Refusal = { ok: false; detail: { reason: string; target?: string; next?: string; instead?: string[] } };

/** A shop whose basket page shows a quantity label and whose results page does not. */
function shop(): { runtime: WebAutomationLlmEvidenceRuntime; go(url: string): void } {
  let url = BASKET;
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const interactiveElements: JsonObject[] = url === BASKET
        ? [{ tagName: "label", selector: "#qty-label-1", visibleText: "Qty" }, { tagName: "select", selector: "#qty-1", accessibleName: "Qty" }]
        : [{ tagName: "a", selector: "#tray-1", visibleText: "Fernway Seed Tray" }];
      const snapshot = { url, title: url === BASKET ? "Basket" : "Results", interactiveElements };
      // Nothing on either page repeats, so a read that detects its own list (t1038) finds none and reads the one element.
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: { ok: false, refused: "no_repeating_run" } } };
    }
  });
  return { runtime, go: (next) => (url = next) };
}

const look = (runtime: WebAutomationLlmEvidenceRuntime, callId: string) =>
  runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });

/**
 * The handle of the basket's quantity control, one element and no list, as the whole basket page prints it (page-diff
 * D15: there is no search). The page prints the label and the select it names as the select's one line, so the select's
 * handle stands for the label's. With `leave`, the run is then on the results page.
 */
async function labelSeen(leave: boolean): Promise<{ runtime: WebAutomationLlmEvidenceRuntime; label: string }> {
  const { runtime, go } = shop();
  await look(runtime, "call.look.basket");
  const full = await runtime.pageChannel?.fullPage?.({ ...PROJECT, callId: "call.full", permission: READ_PERMITTED });
  const text = webLlmShownPageText(full) ?? "";
  const label = /^(t\d+) select "Qty"/mu.exec(text)?.[1];
  assert.ok(label !== undefined, text);
  if (leave) {
    go(RESULTS);
    await look(runtime, "call.look.results");
  }
  return { runtime, label };
}

const readTable = (runtime: WebAutomationLlmEvidenceRuntime, handle: string) =>
  runtime.executeTool({ ...PROJECT, callId: "call.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: READ_PERMITTED, value: { node: READ, parameters: { extractList: { handle, fields: { item: "name", quantity: "qty", price: "price" } } }, consequences: [] } });

test("a read through an element's own handle with a table's columns is told it names one element, and where a list is detected and read", async () => {
  const { runtime, label } = await labelSeen(false);
  const read = await readTable(runtime, label);
  assert.equal(read.resultCode, "web.action.rejected.target_unobserved", JSON.stringify(read.evidence).slice(0, 600));
  const refusal = read.evidence as unknown as Refusal;
  assert.equal(refusal.detail.reason, "column_not_in_detected_list");
  assert.equal(refusal.detail.target, label);
  const next = refusal.detail.next ?? "";
  assert.ok(next.startsWith(`Nothing was read: ${label} names one element, not a list, and \`name\` is not one of its columns. `), next);
  assert.match(next, /whose only columns are text, value and link/u);
  // t1038 (D13): no list was found around it, and a list is read on its own page by a line of it, never detected first.
  assert.match(next, /No list was found around it on this page/u);
  assert.match(next, /naming the list by the handle of a line inside it/u);
  assert.doesNotMatch(next, /[Dd]etect/u);
  assert.equal(next.includes("keys from this list's own fields"), false, "no list's fields are pointed to: there is none");
  for (const word of ["Qty", "Fernway", "basket", "garden"]) assert.equal(next.includes(word), false, `the sentence carries no page word: ${word}`);
});

test("the same read from another page is refused as a handle of a page no longer loaded", async () => {
  const { runtime, label } = await labelSeen(true);
  const refusal = (await readTable(runtime, label)).evidence as unknown as Refusal;
  assert.equal(refusal.detail.reason, "page_moved_since_packet");
  assert.match(refusal.detail.next ?? "", /came from a view of a page that is no longer the one loaded/u);
});

test("a detection at a handle another page printed is told the handle names nothing here, and to detect on that page", async () => {
  const { runtime, label } = await labelSeen(true);
  const detected = await runtime.executeTool({ ...PROJECT, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: { target: label } });
  const refusal = detected.evidence as unknown as Refusal;
  assert.equal(refusal.detail.reason, "handle_not_in_packet", JSON.stringify(detected.evidence).slice(0, 600));
  assert.equal(refusal.detail.next, `Nothing was done: ${label} is not a handle of this page's views. A handle names an element of the page view that printed it, and one printed on another page names nothing here. Use a handle the newest view of this page prints, or look at the page again; to detect or read a list that another page shows, go to that page first and name the list there by a handle its own view prints.`);
});

test("a read of a detected list naming a column it lacks is told as before (t1020)", async () => {
  const { webLlmUnknownColumn } = await import("../index");
  assert.match(webLlmUnknownColumn.next(["web.handle.unknown_column.item"], "extraction.3"), /^Nothing was read: `item` is not a column of the list this read names\./u);
  // t1038 (D13): a read keeps every column, and the same read with no fields shows every column under its name.
  assert.match(webLlmUnknownColumn.next(["web.handle.unknown_column.item"]), /Run the same read with no fields to get every column under its name/u);
  assert.doesNotMatch(webLlmUnknownColumn.next(["web.handle.unknown_column.item"]), /[Dd]etect (?:the|it|a) list|detect(?:ion)? first/u);
});

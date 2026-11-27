import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioLlmPageChannelProjection } from "fluxiq/automation";
import type { JsonValue } from "fluxiq/core";
import type { ScriptedModelRequest } from "../../wire-request.js";
import { currentPageOf } from "../evidence.js";
import { applyPageChanges } from "../page-changes.js";

type Line = { key: string; text: string };
const KEY = "https://shop.test/results";
const header: Line[] = [{ key: "PAGE", text: 'PAGE "Results"' }, { key: "URL", text: "URL ~/results" }, { key: "VIEW", text: "VIEW · 4 elements" }, { key: "-", text: "" }];
const body = (...handles: Array<[string, string]>): Line[] => handles.map(([key, words]) => ({ key, text: `${key} ${words}` }));
const text = (lines: Line[]) => lines.map((line) => line.text).join("\n");

function request(views: Line[][]): ScriptedModelRequest {
  const records = views.map((lines, index) => ({ callId: `call.${index + 1}`, toolId: "core.run_node", value: { ok: true, pageView: { key: KEY, lines } as unknown as JsonValue } }));
  const { history, window } = automationStudioLlmPageChannelProjection(records, { member: "pageView" });
  return wire([...history, ...(window ? [window] : [])]);
}

function wire(evidence: unknown[]): ScriptedModelRequest {
  return { kind: "evidence_tool_decision", ordinal: 1, model: "fixture", jsonText: true, message: "", payload: { taskKind: "evidence_tool_decision", context: { evidenceLoop: { evidence } } } } as unknown as ScriptedModelRequest;
}

const filler = Array.from({ length: 12 }, (_, index): [string, string] => [`t${10 + index}`, `link "Product ${index + 1} of the results list" ~/p/${index + 1}`]);
const first = [...header, ...body(["t1", 'button "Accept all"'], ["t2", 'field "Search"'], ["t3", 'link "Towels" ~/p/1'], ["t4", 'select "Sort by"'], ...filler)];
// The consent button left, a button arrived before the filler, a line reads differently, the header changed: all small against the page.
const second = [header[0]!, header[1]!, { key: "VIEW", text: "VIEW · 16 elements, scrolled" }, header[3]!, ...body(["t2", 'field "Search"'], ["t3", 'link "Towels" ~/p/1'], ["t5", 'button "Next page"'], ["t4", 'select "Sort by" =rating'], ...filler)];

test("the first result's page is read whole", () => {
  assert.equal(currentPageOf(request([first])), text(first));
});

test("changes after the whole page are applied in order: lines gone, arrived and reworded", () => {
  const both = request([first, second]);
  const evidence = (both.payload as { context: { evidenceLoop: { evidence: Array<{ toolId: string; value: Record<string, unknown> }> } } }).context.evidenceLoop.evidence;
  const window = evidence.find((entry) => entry.toolId === "core.page_window")!.value as { pages: Array<{ shown: Array<Record<string, unknown>> }> };
  assert.equal(typeof window.pages[0]!.shown[1]!.changes, "string", "Core's projection sent the second view as changes");
  assert.equal(currentPageOf(both), text(second));
});

test("the page the window marks current is read, not another page it still holds", () => {
  const cart: Line[] = [{ key: "PAGE", text: 'PAGE "Cart"' }, { key: "t1", text: 't1 button "Checkout"' }];
  const records = [first, cart].map((lines, index) => ({ callId: `call.${index + 1}`, toolId: "core.run_node", value: { ok: true, pageView: { key: index ? "https://shop.test/cart" : KEY, lines } as unknown as JsonValue } }));
  const { history, window } = automationStudioLlmPageChannelProjection(records, { member: "pageView" });
  assert.equal(currentPageOf(wire([...history, window])), text(cart));
});

test("a request from before the page window is read from the deliveries its results carry", () => {
  const changes = ["  t2 field \"Search\"", "+ t5 button \"Next page\""].join("\n");
  const inPlace = [
    { callId: "call.1", toolId: "core.run_node", value: { ok: true, pageView: { key: KEY, whole: "PAGE one\nt2 field \"Search\"" } } },
    { callId: "call.2", toolId: "core.run_node", value: { ok: true, pageView: { key: KEY, since: "call.1", changes } } }
  ];
  assert.equal(currentPageOf(wire(inPlace)), "PAGE one\nt2 field \"Search\"\nt5 button \"Next page\"");
});

test("an unchanged view leaves the page as it was, and three views in a row compose", () => {
  const third = second.map((line) => (line.key === "t2" ? { key: "t2", text: 't2 field "Search" ="towels"' } : line));
  assert.equal(currentPageOf(request([first, second, second])), text(second));
  assert.equal(currentPageOf(request([first, second, third])), text(third));
});

test("a changed line that is not there is added where the delivery puts it, and the rest stays in order", () => {
  assert.deepEqual(applyPageChanges(["a", "t1 x", "t2 y"], ["  a", "~ t9 z", "+ t3 w"]), ["a", "t9 z", "t3 w", "t1 x", "t2 y"]);
});

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
  const evidence = automationStudioLlmPageChannelProjection(records, { member: "pageView" });
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
  const evidence = (both.payload as { context: { evidenceLoop: { evidence: Array<{ value: { pageView: Record<string, unknown> } }> } } }).context.evidenceLoop.evidence;
  assert.equal(typeof evidence[1]!.value.pageView.changes, "string", "Core's projection sent the second view as changes");
  assert.equal(currentPageOf(both), text(second));
});

test("an unchanged view leaves the page as it was, and three views in a row compose", () => {
  const third = second.map((line) => (line.key === "t2" ? { key: "t2", text: 't2 field "Search" ="towels"' } : line));
  assert.equal(currentPageOf(request([first, second, second])), text(second));
  assert.equal(currentPageOf(request([first, second, third])), text(third));
});

test("a changed line that is not there is added where the delivery puts it, and the rest stays in order", () => {
  assert.deepEqual(applyPageChanges(["a", "t1 x", "t2 y"], ["  a", "~ t9 z", "+ t3 w"]), ["a", "t9 z", "t3 w", "t1 x", "t2 y"]);
});

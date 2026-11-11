import assert from "node:assert/strict";
import test from "node:test";
import { attemptOverheadLine } from "../attempt-overhead-line.js";
import { overheadOfSteps } from "../overhead-of-steps.js";
import { overheadWords } from "../overhead-words.js";
import type { StepRecord } from "../step-record.js";

const ROOT = "http://site.test/";
const SEARCH = "http://site.test/search?q=x&sort=rating";
const PAGE2 = `${SEARCH}&page=2`;
const READ = "web.output.dom-extract_list";
const NEXT = "web.output.dom-next_page";

type Pieces = Partial<StepRecord> & { kind: string };

/** Builds a run's records in order, numbering the steps as the run's folders are. */
function run(): { records: StepRecord[]; add: (record: Pieces) => void } {
  const records: StepRecord[] = [];
  const add = (record: Pieces): void => {
    records.push({ step: records.length + 1, toolId: null, resultCode: null, summary: "", callId: null, callInput: undefined, locationAfter: null, runFrom: null, ...record });
  };
  return { records, add };
}

const replay = (node: string, location: string, parameters: unknown = {}): unknown => ({ node, parameters, consequences: [], replay: "step", from: { location } });
const byHand = (node: string, parameters: unknown): unknown => ({ node, parameters, consequences: [] });

type Tool = Readonly<{ code: string; id: string; input: unknown; toolId?: string; after?: string }>;
type Node = readonly [node: string, location: string, id: string, parameters: unknown];

/** A decision with the tool step that answers it. */
function decided(add: (record: Pieces) => void, summary: string, tool: Tool): void {
  add({ kind: "decide", summary });
  add({ kind: "tool", toolId: tool.toolId ?? "core.run_node", resultCode: tool.code, summary: tool.code, callId: tool.id, callInput: tool.input, locationAfter: tool.after ?? null });
}

function described(add: (record: Pieces) => void, id: string): void {
  add({ kind: "decide", summary: "tool_call core.describe_nodes" });
  add({ kind: "tool", toolId: "core.describe_nodes", summary: "ok", callId: id, callInput: {} });
}

/** A run of the draft: a decision, the nodes it replayed (the last one ends the run) and the look that follows. */
function ranFlow(add: (record: Pieces) => void, label: string, from: number, nodes: readonly Node[]): void {
  add({ kind: "decide", summary: "tool_call core.run_flow", runFrom: from });
  nodes.forEach(([node, location, id, parameters], index) => {
    const code = index === nodes.length - 1 ? "core.replay.ended" : "core.replay.replayed";
    add({ kind: "tool", toolId: "core.run_node", resultCode: code, summary: code, callId: `run.flow.${label}.${id}`, callInput: replay(node, location, parameters) });
  });
  add({ kind: "tool", toolId: "core.run_node", resultCode: "web.inspect.succeeded", summary: "web.inspect.succeeded", callId: `run.flow.${label}.look`, callInput: byHand("web.output.dom-capture_snapshot", {}) });
}

const WHOLE_FLOW: readonly Node[] = [
  ["web.output.browser-navigate", ROOT, "1", { url: ROOT }],
  ["web.output.dom-type", ROOT, "4", { text: "x", selector: "input" }],
  ["web.output.dom-check", ROOT, "5", { checked: true }],
  ["web.output.dom-select", ROOT, "7", { value: "rating" }],
  [READ, SEARCH, "9.pass.1", {}],
  [NEXT, SEARCH, "11.pass.1", {}],
  [READ, SEARCH, "9.pass.2", {}],
  [NEXT, SEARCH, "11.pass.2", {}],
];

const SAVED_FLOW = ["web.output.browser-navigate", "web.output.dom-type", "web.output.dom-check", "web.output.dom-select", "builtin.control.merge", "builtin.control.repeat", READ, NEXT, "builtin.control.merge", "builtin.control.repeat", READ, NEXT, "builtin.control.merge"];

/**
 * The shape of towels attempt 1 in the result-evidence design's table: 36 browser calls (18 replayed, 4 ended, 8 actions, 5 reads
 * or looks, 1 detection), 3 describes, 1 format error and two refusals, two whole-Flow runs from step 1, then three attempts that
 * run the saved Flow's 8 browser nodes.
 */
function towelsShape(): StepRecord[] {
  const { records, add } = run();
  add({ kind: "chat", summary: "ok" });
  // By hand: 6 actions, a detection and a read, with 3 describes and a format error between.
  add({ kind: "tool", toolId: "core.run_node", resultCode: "web.action.succeeded", summary: "web.action.succeeded", callId: "open.1", callInput: byHand("web.output.browser-navigate", { url: ROOT }), locationAfter: ROOT });
  described(add, "d.1");
  described(add, "d.2");
  add({ kind: "decide", summary: "error llm.provider_output_invalid" });
  add({ kind: "answer", summary: "refused llm.provider_output_invalid" });
  decided(add, "tool_call core.run_node add", { code: "web.action.succeeded", id: "type.1", input: byHand("web.output.dom-type", { target: { handle: "t11" }, text: "x" }), after: SEARCH });
  described(add, "d.3");
  decided(add, "tool_call core.run_node add", { code: "web.action.succeeded", id: "check.1", input: byHand("web.output.dom-check", { target: { handle: "t20" } }), after: SEARCH });
  decided(add, "tool_call core.run_node add", { code: "web.action.succeeded", id: "sort.1", input: byHand("web.output.dom-select", { target: { handle: "t30" } }), after: SEARCH });
  decided(add, "tool_call web.detect_repeating_structure", { code: "web.structure.detected", id: "detect.1", input: { target: "t40" }, toolId: "web.detect_repeating_structure" });
  decided(add, "tool_call core.run_node add", { code: "web.inspect.succeeded", id: "read.1", input: byHand(READ, { handle: "extraction.1" }), after: SEARCH });
  decided(add, "tool_call core.run_node add", { code: "web.action.succeeded", id: "next.1", input: byHand(NEXT, { handle: "extraction.1" }), after: PAGE2 });
  decided(add, "tool_call core.run_node add", { code: "web.action.succeeded", id: "page1.1", input: byHand("web.output.dom-click", { target: { handle: "t50" } }), after: SEARCH });
  // The draft run from step 9: 4 nodes. Then a rerun refused on a task with no reset, and a by-hand call refused as the same call.
  ranFlow(add, "9", 9, WHOLE_FLOW.slice(4));
  add({ kind: "decide", summary: "amend_draft 1 amendment" });
  add({ kind: "answer", summary: "amend_draft applied" });
  add({ kind: "tool", toolId: "core.run_node", resultCode: "answer_first.no_reset", summary: "answer_first.no_reset", callId: "rerun.9.place", callInput: { replay: "reset" } });
  add({ kind: "decide", summary: "tool_call core.run_node add" });
  add({ kind: "answer", toolId: "core.run_node", summary: "refused llm_evidence_loop.repeat_refused (the same call before: failed)" });
  // The whole Flow from step 1 (8 nodes), a run of the last two nodes (2), then the whole Flow from step 1 again (8).
  ranFlow(add, "fromstart.1", 1, WHOLE_FLOW);
  ranFlow(add, "10", 10, WHOLE_FLOW.slice(6));
  decided(add, "tool_call core.run_node", { code: "web.action.succeeded", id: "back.1", input: byHand("web.output.dom-click", { target: { handle: "t60" } }), after: SEARCH });
  decided(add, "tool_call core.run_node", { code: "web.action.succeeded", id: "next.2", input: byHand(NEXT, { handle: "extraction.1" }), after: PAGE2 });
  ranFlow(add, "all.1", 1, WHOLE_FLOW);
  add({ kind: "decide", summary: "complete" });
  add({ kind: "judge", summary: "diagnosis: ok" });
  // Three later attempts that only run the saved Flow: 8 browser nodes and 5 control nodes each.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const toolId of SAVED_FLOW) add({ kind: "flow", toolId, summary: `${toolId} succeeded` });
    add({ kind: "note", summary: "The saved Flow's replay stood on its record." });
    if (attempt === 0) add({ kind: "judge", summary: "diagnosis: ok" });
  }
  return records;
}

test("towels attempt 1: 36 live browser calls beside the Flow's 8 is 36 / 8 = 4.5x, with two whole-Flow runs from step 1", () => {
  const [first] = overheadOfSteps(towelsShape());
  assert.ok(first);
  assert.equal(first.attempt, 1);
  assert.equal(first.liveBrowserCalls, 36);
  assert.equal(first.flowBrowserCalls, 8);
  assert.equal(first.overhead, 4.5);
  assert.equal(overheadWords(first), "36 / 8 = 4.5x");
  assert.equal(first.wholeFlowRuns, 2);
  assert.match(attemptOverheadLine(first), /^attempt 1 overhead: 36 live browser calls, the saved Flow runs 8, overhead 36 \/ 8 = 4\.5x; 18 repeated calls; 2 whole-Flow runs from step 1; decisions: 3 describe, 1 provider-format error, 2 refused, 1 look, 13 step$/u);
});

test("repeated calls are those whose node, parameters without replay words and place already occurred", () => {
  const [first] = overheadOfSteps(towelsShape());
  // The first run from step 1: its navigate repeats the by-hand navigate (+1) and its 4 read and next passes repeat the run from step 9 (+4).
  // The by-hand next at the end repeats the earlier one, pressed from the same page (+1).
  // The run from step 10 repeats the second passes (+2). The second run from step 1 repeats all 8 (+8).
  // The snapshot looks after the runs from step 10 and from step 1 the first time repeat the first look, taken at the same address (+2).
  // The last look follows the by-hand next, at page 2, so it is another place.
  assert.equal(first?.repeatedCalls, 1 + 4 + 1 + 2 + 8 + 2);
});

test("decisions are counted once each, by kind", () => {
  const [first] = overheadOfSteps(towelsShape());
  assert.deepEqual(first?.decisions, { describe: 3, providerFormatError: 1, refused: 2, look: 1, step: 13 });
});

test("later attempts that only replay the saved Flow have no live calls and no overhead ratio", () => {
  const attempts = overheadOfSteps(towelsShape());
  assert.equal(attempts.length, 4);
  for (const later of attempts.slice(1)) {
    assert.equal(later.liveBrowserCalls, 0);
    assert.equal(later.overhead, null);
    assert.equal(later.flowBrowserCalls, 8);
    assert.equal(later.wholeFlowRuns, 0);
  }
});

test("a run with no replay of a Flow has no ratio, and says only the live count", () => {
  const { records, add } = run();
  decided(add, "tool_call core.run_node add", { code: "web.action.succeeded", id: "a", input: byHand("web.output.dom-click", { target: { handle: "t1" } }) });
  const [only] = overheadOfSteps(records);
  assert.equal(only?.flowBrowserCalls, null);
  assert.equal(only?.overhead, null);
  assert.equal(overheadWords(only!), "1");
  assert.match(attemptOverheadLine(only!), /1 live browser calls, no replay of the saved Flow in this run, overhead not worked out/u);
});

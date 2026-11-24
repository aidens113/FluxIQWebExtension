// The patterns the run watcher alerts on, fed synthetic events in step order.
// Each pattern fires on its own shape, and a run that acts and finds new things stays quiet.

import assert from "node:assert/strict";
import test from "node:test";
import { WATCH_THRESHOLDS, createWatchState, isActNode } from "../index.mjs";

const LOW = { ...WATCH_THRESHOLDS, noActAfterLoopDecisions: 3, noActDecisions: 6, repeatedCalls: 3, unfinishedAfterFinish: 2, unchangedAfterChange: 2, stepsWithoutEvidence: 8 };

function feed(thresholds, events) {
  const state = createWatchState(thresholds);
  let step = 0;
  const alerts = [];
  for (const partial of events) {
    step += 1;
    alerts.push(...state.observe({
      step, name: `${step}`, kind: "decide", toolId: null, callId: null, callKey: null, node: null, startUrl: null, initial: false, act: false,
      costUsd: 0.001, decision: null, verdict: null, decidedTool: null, resultCode: null, pattern: null, toolIds: [], location: null, pageHash: null, rows: null, ...partial,
    }));
  }
  return { alerts, state };
}
const read = (id, input = id) => ({ kind: "tool", toolId: "web.find_on_page", callKey: `web.find_on_page:${input}`, pageHash: null, location: null, id });
const act = (n) => ({ kind: "tool", toolId: "core.run_node", callKey: `core.run_node:${n}`, callId: `call.${n}`, node: "web.output.dom-click", act: true, pageHash: `page-${n}` });
const patterns = (alerts) => alerts.map((alert) => alert.pattern);

test("no act for N decisions after a loop decision fired alerts, with the step range, counts and spend", () => {
  const { alerts } = feed(LOW, [{ kind: "loop_decision", decision: "continue", toolIds: ["web.find_on_page"] }, {}, {}, {}, {}]);
  const alert = alerts.find((one) => one.pattern === "no_act_after_loop");
  assert.ok(alert);
  assert.deepEqual([alert.fromStep, alert.toStep, alert.counts.decisionsWithoutAct], [1, 4, 3]);
  assert.ok(alert.costUsd > 0);
});

test("decisions with no act and no loop alert only at their own, higher threshold", () => {
  assert.deepEqual(patterns(feed(LOW, [{}, {}, {}, {}, {}]).alerts), []);
  assert.deepEqual(patterns(feed(LOW, [{}, {}, {}, {}, {}, {}]).alerts), ["no_act"]);
});

test("an act ends the no-act count", () => {
  const { alerts } = feed(LOW, [{ kind: "loop", pattern: "cycle" }, {}, {}, act(1), {}, {}]);
  assert.deepEqual(patterns(alerts), []);
});

test("the same call repeated K times with no act between alerts, and an act between resets it", () => {
  assert.deepEqual(patterns(feed(LOW, [read("a"), read("a"), read("a")]).alerts), ["repeated_call"]);
  assert.deepEqual(patterns(feed(LOW, [read("a"), read("a"), act(1), read("a"), read("a")]).alerts), []);
  assert.deepEqual(patterns(feed(LOW, [read("a"), read("b"), read("a"), read("b")]).alerts), []);
});

test("a finish_with_best decision that does not end the build alerts, and a Flow run or judged run ends the wait", () => {
  const stuck = feed(LOW, [{ kind: "loop_decision", decision: "finish_with_best" }, {}, {}]);
  assert.ok(patterns(stuck.alerts).includes("finish_not_ending"));
  const ended = feed(LOW, [{ kind: "loop_decision", decision: "finish_with_best" }, {}, { kind: "judge" }, {}, {}]);
  assert.ok(!patterns(ended.alerts).includes("finish_not_ending"));
});

test("calls after change_approach that stay the kind the loop named alert; a different kind or an act is a change", () => {
  const change = { kind: "loop_decision", decision: "change_approach", toolIds: ["web.find_on_page"] };
  assert.ok(patterns(feed(LOW, [change, read("x"), read("y")]).alerts).includes("approach_unchanged"));
  assert.ok(!patterns(feed(LOW, [change, { kind: "tool", toolId: "web.describe_element", callKey: "web.describe_element:1" }, read("x"), read("y")]).alerts).includes("approach_unchanged"));
  assert.ok(!patterns(feed(LOW, [change, act(1), read("x"), read("y")]).alerts).includes("approach_unchanged"));
});

test("the page landing on the start URL again after the first time alerts, unless a Flow run or judged run explains it", () => {
  const at = (location, extra = {}) => ({ kind: "tool", toolId: "core.run_node", callKey: `core.run_node:${location}`, startUrl: "http://site/", location, ...extra });
  const bare = feed(LOW, [at("http://site/"), at("http://site/search?p=2"), at("http://site/", { pageHash: "again" })]);
  assert.deepEqual(patterns(bare.alerts), ["page_reset"]);
  assert.equal(bare.alerts[0].counts.resets, 1);
  const explained = feed(LOW, [at("http://site/"), at("http://site/search?p=2"), { kind: "judge" }, at("http://site/", { pageHash: "again" })]);
  assert.deepEqual(patterns(explained.alerts), []);
  assert.equal(explained.state.snapshot().pageResets, 0);
});

test("a start-page landing inside a model-sent Flow run raises nothing, and one outside it still raises", () => {
  const at = (location, extra = {}) => ({ kind: "tool", toolId: "core.run_node", callKey: `core.run_node:${location}${extra.pageHash ?? ""}`, startUrl: "http://site/", location, ...extra });
  const replay = { resultCode: "core.replay.replayed" };
  const sent = feed(LOW, [at("http://site/"), at("http://site/cart"), { kind: "decide", decidedTool: "core.run_flow" }, at(null, replay), at("http://site/", { pageHash: "again" })]);
  assert.deepEqual(patterns(sent.alerts), []);
  assert.equal(sent.state.snapshot().pageResets, 0);
  const byReplay = feed(LOW, [at("http://site/"), at("http://site/cart"), at(null, replay), at("http://site/", { pageHash: "again", ...replay })]);
  assert.deepEqual(patterns(byReplay.alerts), []);
  const outside = feed(LOW, [at("http://site/"), at("http://site/cart"), { kind: "decide", decidedTool: "web.find_on_page" }, at("http://site/", { pageHash: "again", resultCode: "ok" })]);
  assert.deepEqual(patterns(outside.alerts), ["page_reset"]);
});

test("an opening call whose held navigate names the start URL while the page stays elsewhere raises nothing", () => {
  const opening = (n) => ({ kind: "tool", toolId: "core.run_node", callId: "initial.core.run_node", callKey: `core.run_node:o${n}`, initial: true, startUrl: "http://site/", location: "http://site/search?q=x&page=3", pageHash: "same" });
  const events = [{ kind: "tool", toolId: "core.run_node", startUrl: "http://site/", location: "http://site/" }, { location: null }, opening(1), { kind: "decide" }, opening(2), { kind: "decide" }, opening(3), { kind: "decide" }, opening(4)];
  assert.ok(!patterns(feed(LOW, events).alerts).includes("page_reset"));
});

test("Core opening calls again with no model decision between alert, and a decision between them does not", () => {
  const opening = (n) => ({ kind: "tool", toolId: "core.run_node", callId: "initial.core.run_node", callKey: `core.run_node:o${n}`, initial: true, pageHash: `o${n}` });
  const stuck = feed(LOW, [opening(1), opening(2)]);
  assert.deepEqual(patterns(stuck.alerts), ["rounds_without_decision"]);
  assert.equal(stuck.alerts[0].toStep, 2);
  assert.deepEqual(patterns(feed(LOW, [opening(1), {}, opening(2)]).alerts), []);
  assert.deepEqual(patterns(feed(LOW, [opening(1), opening(2), opening(3), opening(4)]).alerts), ["rounds_without_decision", "rounds_without_decision"]);
});

test("steps since the last new evidence alert; a new location, fingerprint, row count, or an act resets them", () => {
  assert.ok(patterns(feed(LOW, [read("a"), ...Array.from({ length: 8 }, () => ({ kind: "answer" }))]).alerts).includes("no_new_evidence"));
  const moving = Array.from({ length: 20 }, (_, index) => ({ kind: "tool", toolId: "core.run_node", callKey: `c:${index}`, location: `http://site/${index}` }));
  assert.deepEqual(patterns(feed(LOW, moving).alerts), []);
});

test("a run that keeps acting and finding new pages stays quiet", () => {
  const events = [];
  for (let index = 0; index < 30; index += 1) events.push({}, act(index));
  assert.deepEqual(patterns(feed(WATCH_THRESHOLDS, events).alerts), []);
});

test("an act is any node that changes the page; reads, snapshots and waits are not", () => {
  for (const node of ["web.output.dom-click", "web.output.dom-type", "web.output.dom-select", "web.output.browser-navigate", "web.output.dom-scroll", "web.output.dom-keypress", "web.output.dom-upload", "web.output.dom-next_page"]) assert.equal(isActNode(node), true, node);
  for (const node of ["web.output.dom-capture_snapshot", "web.output.dom-extract_list", "web.output.dom-extract", "web.output.dom-wait_for_text", "builtin.control.merge"]) assert.equal(isActNode(node), false, node);
});

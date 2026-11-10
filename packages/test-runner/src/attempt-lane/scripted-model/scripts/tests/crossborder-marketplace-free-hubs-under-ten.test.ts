import assert from "node:assert/strict";
import test from "node:test";
import { scriptedModelScriptFor, type ScriptedModelRequest } from "../../index.js";

const SCRIPT = scriptedModelScriptFor("crossborder-marketplace-free-hubs-under-ten");
const decide = SCRIPT.replies.evidence_tool_decision![0]!;

function request(page: string, extra: readonly Record<string, unknown>[] = []): ScriptedModelRequest {
  const evidence = [...extra, { callId: "core.current_view", toolId: "core.current_view", value: { groups: [{ group: "top", callId: "x", value: { page } }] } }];
  return { kind: "evidence_tool_decision", ordinal: 1, model: "m", jsonText: true, message: "", payload: { taskKind: "evidence_tool_decision", context: { evidenceLoop: { evidence } } } };
}

type Called = { decision: { kind: string; callId?: string; toolId?: string; input?: { node?: string; parameters?: Record<string, any> } } };
const decision = (page: string, extra?: readonly Record<string, unknown>[]) => (decide(request(page, extra)) as Called).decision;
const made = (...ids: string[]) => ids.map((callId) => ({ callId, toolId: "core.run_node", value: { ok: true } }));

const RESULTS = 'URL ~/search?q=usb+c+hub\nt30 clickable "Free shipping"\nt31 field placeholder "Max" =""\nt32 clickable "OK"\nt33 clickable "Price ↑"\nt40 link "Keelson USB C Hub 7 in 1" same href';

test("a script is registered for the task, with a chat turn for each of its two attempts", () => {
  assert.equal(SCRIPT.taskId, "crossborder-marketplace-free-hubs-under-ten");
  assert.equal(SCRIPT.replies.panel_command?.length, 2);
});

test("it clears what covers the page by the handle the page gives, each only while it shows", () => {
  assert.equal(decision('URL ~/\nt5 "No thanks"').input?.parameters?.target.handle, "t5");
  assert.equal(decision('URL ~/\nt77 "No thanks"').input?.parameters?.target.handle, "t77");
  assert.equal(decision('URL ~/\nt6 "Accept all"', made("dismiss-welcome")).callId, "accept-cookies");
});

test("it narrows by free shipping, types the ceiling and applies it, then sorts, taking each handle from the page", () => {
  assert.equal(decision(RESULTS).callId, "free-shipping");
  assert.equal(decision(RESULTS).input?.parameters?.target.handle, "t30");
  const typed = decision(RESULTS, made("free-shipping"));
  assert.equal(typed.input?.node, "web.output.dom-type");
  assert.equal(typed.input?.parameters?.target.handle, "t31");
  assert.equal(typed.input?.parameters?.text, "10");
  assert.equal(decision(RESULTS, made("free-shipping", "ceiling-typed")).input?.parameters?.target.handle, "t32");
  assert.equal(decision(RESULTS, made("free-shipping", "ceiling-typed", "ceiling-applied")).input?.parameters?.target.handle, "t33");
});

test("it reads the rows from the fields the page's own structure gives, leaving out the ads, and then completes", () => {
  const before = made("free-shipping", "ceiling-typed", "ceiling-applied", "sort-by-price");
  assert.equal(decision(RESULTS, before).toolId, "web.detect_repeating_structure");
  const fields = [
    { key: "a_title", sample: "Keelson USB C Hub 9 in 1 Multiport Adapter", type: "text", kind: "text", coverage: 1 },
    { key: "b_store", sample: "Voltbay Official Store", type: "text", kind: "text", coverage: 1 },
    { key: "c_price", sample: "8,99 €", type: "currency", kind: "text", coverage: 1 },
    { key: "d_rating", sample: "4.7", type: "text", kind: "text", coverage: 0.9 },
    { key: "e_ad", sample: "Ad", type: "text", kind: "text", coverage: 0.2 },
  ];
  const read = decision(RESULTS, [...before, { callId: "detect-hubs", toolId: "web.detect_repeating_structure", value: { extraction: "extraction.9", fields } }]);
  assert.equal(read.input?.node, "web.output.dom-extract_list");
  assert.deepEqual(read.input?.parameters?.extractList.fields, { title: "a_title", store: "b_store", price: "c_price", rating: "d_rating" });
  assert.deepEqual(read.input?.parameters?.extractList.where, [{ field: "e_ad", is: "present", not: true }]);
  assert.equal(decision(RESULTS, [...before, ...made("read-hubs")]).kind, "complete");
});

test("it never answers a traffic screen, and a page without what it needs fails loudly", () => {
  assert.throws(() => decision('URL ~/search?q=usb+c+hub\nt1 "I\'m not a robot"', made("free-shipping")), /Max price box|shows nothing/u);
  assert.throws(() => decision('URL ~/search?q=usb+c+hub\nt1 "Hub"'), /shows nothing matching/u);
});

test("a second attempt's round starts where its saved Flow left the page, and never presses again what the address says is on", () => {
  const typed = 'URL ~/search?q=usb+c+hub&freeShipping=y\nt30 clickable "Free shipping"\nt31 field placeholder "Max" ="10"\nt32 clickable "OK"\nt33 clickable "Price ↑"\nt40 link "Keelson USB C Hub 7 in 1" same href';
  // Free shipping on and the ceiling typed, not applied: Free shipping is not pressed (it would turn off), and the ceiling is applied.
  assert.equal(decision(typed).callId, "ceiling-applied");
  assert.equal(decision(typed).input?.parameters?.target.handle, "t32");
  const filtered = typed.replace("freeShipping=y", "freeShipping=y&maxPrice=10");
  assert.equal(decision(filtered).callId, "sort-by-price");
  assert.equal(decision(filtered.replace("maxPrice=10", "maxPrice=10&sort=price_asc")).toolId, "web.detect_repeating_structure");
});

// The `timed-check` form, for the variant whose check only a person may pass covers the first page on a timer.
const TIMED = "crossborder-marketplace-free-hubs-under-ten-timed-check";
const timedForm = () => {
  const script = scriptedModelScriptFor(TIMED, "timed-check");
  return (page: string, extra?: readonly Record<string, unknown>[]) => (script.replies.evidence_tool_decision![0]!(request(page, extra)) as Called).decision;
};
const HOME = 'URL ~/\nt5 "No thanks"\nt6 "Accept all"';
const CHECKED = `${HOME}\nDIALOG modal robot_check\nt80 h2 "Please confirm you are human"\nt81 clickable "Verify you are human"`;
const completedOn = (callId: string) => ({ callId, toolId: "core.run_node", value: { personCompletedCheck: true, note: "This step met a check only a person can complete.", page: HOME } });

test("the variant row has a script too, the plain form is the read's, and a form neither has is refused", () => {
  assert.equal(scriptedModelScriptFor(TIMED).taskId, TIMED);
  assert.equal(scriptedModelScriptFor(TIMED, "timed-check").taskId, TIMED);
  assert.equal(scriptedModelScriptFor(TIMED).replies.panel_command?.length, 2);
  assert.throws(() => scriptedModelScriptFor(TIMED, "by-hand"), /no form "by-hand"\. It has plain and timed-check/u);
  assert.throws(() => scriptedModelScriptFor("crossborder-marketplace-free-hubs-under-ten", "by-hand"), /no form "by-hand"/u);
});

test("timed-check answers the default four attempts", () => {
  const script = scriptedModelScriptFor(TIMED, "timed-check");
  assert.equal(script.replies.panel_command?.length, 4);
  assert.ok((script.replies.loop_verification?.length ?? 0) >= 4);
});

test("timed-check: with the check standing and nothing handed over, the round looks at the page and presses nothing", () => {
  const look = timedForm()(CHECKED);
  assert.equal(look.toolId, "core.run_node");
  assert.equal(look.callId, "look-at-the-page");
  assert.equal(look.input?.node, "web.output.dom-capture_snapshot");
  assert.deepEqual(look.input?.parameters, {});
  assert.equal((look as { add?: boolean }).add, undefined, "a look is never a step of the Flow");
  // Before its timer has run the page is clean, and the round still looks before it presses anything.
  assert.equal(timedForm()(HOME).callId, "look-at-the-page");
});

test("timed-check: a look that came back with no hand-off is refused, saying whether the check stood", () => {
  const looked = [{ callId: "look-at-the-page", toolId: "core.run_node", value: { ok: true, page: CHECKED } }];
  assert.throws(() => timedForm()(CHECKED, looked), /looked at the page while the check stood, and the look handed nothing to the person/u);
  assert.throws(() => timedForm()(HOME, looked), /no check stood over it: the variant was not armed, or its timer had not run/u);
});

test("timed-check: once a look handed the check to the person, the round goes on as the plain form from the page as it stands, and so do the later attempts", () => {
  const decide = timedForm();
  const onward = decide(HOME, [completedOn("look-at-the-page")]);
  assert.equal(onward.callId, "dismiss-welcome");
  assert.equal(onward.input?.parameters?.target.handle, "t5");
  // A later attempt's round carries no note of the check the person passed in the first: it is past it.
  assert.equal(decide(RESULTS).callId, "free-shipping");
  // The arrival's own look after it landed is a look too.
  assert.equal(timedForm()(HOME, [completedOn("initial.core.run_node")]).callId, "dismiss-welcome");
});

test("timed-check: a hand-off from a press is not a look, and a check still standing after the person is refused", () => {
  assert.throws(() => timedForm()(HOME, [completedOn("dismiss-welcome")]), /from dismiss-welcome, which is not a look/u);
  assert.throws(() => timedForm()(CHECKED, [completedOn("look-at-the-page")]), /still covers the page after the person completed it/u);
});

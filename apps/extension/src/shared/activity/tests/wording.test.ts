// Coverage of wording.ts: every tool and seam Core reports, every
// family of result code, Core's own sentences kept when they are human, and
// that no visible word is a raw id. The real t174 build is checked in
// background/activity/tests/activity-replay.test.ts, beside its fixture.

import assert from "node:assert/strict";
import test from "node:test";

import { activityWording, type ActivityWording, type ClientGatewayActivity } from "../index";

const RAW_ID = /\b[a-z]+\.[a-z_]+/u;

let sequence = 0;
function event(fields: Partial<ClientGatewayActivity> & Pick<ClientGatewayActivity, "phase" | "label">): ClientGatewayActivity {
  sequence += 1;
  return { activityId: "build:b", sequence, subject: { kind: "build", id: "b", projectId: "p" }, at: "2026-09-29T00:00:00.000Z", ...fields };
}

/** A tool event exactly as Core's observer sends it (observer.ts `toolActivity`). */
function tool(toolId: string, status: "started" | "succeeded" | "failed", resultCode?: string, extra: Partial<ClientGatewayActivity> = {}): ClientGatewayActivity {
  const drafting = toolId === "core.flow_draft";
  const title = drafting ? "Amending the draft Flow" : `Using ${toolId}`;
  return event({
    phase: drafting ? "building" : "exploring",
    label: status === "started" ? title : `${title}: ${status === "failed" ? "failed" : resultCode ?? "done"}`,
    detail: { kind: "tool", title, status, ref: toolId, ...(resultCode ? { text: `Result: ${resultCode}` } : {}) },
    ...extra
  });
}

function assertHuman(wording: ActivityWording, context: string): void {
  for (const text of [wording.action, wording.outcome ?? "", wording.sentence]) {
    assert.doesNotMatch(text, RAW_ID, `${context}: "${text}" shows a raw id`);
  }
}

test("tools are named by what they do", () => {
  const cases: Array<[ClientGatewayActivity, string]> = [
    [tool("core.run_node", "started"), "Trying a step on the page"],
    [tool("web.detect_repeating_structure", "started"), "Looking for the list of items"],
    [tool("core.flow_draft", "started"), "Updating the Flow"],
    [tool("web.some_future_tool", "started"), "Working on the page"],
    [tool("", "started"), "Working on the page"]
  ];
  for (const [input, sentence] of cases) {
    const wording = activityWording(input);
    assert.equal(wording.sentence, sentence, input.label);
    assert.equal(wording.outcome, null, `${input.label}: a started tool has no outcome yet`);
    assertHuman(wording, input.label);
  }
});

test("core.run_node is named by the node it runs, when the event says which", () => {
  const cases: Array<[NonNullable<ClientGatewayActivity["step"]>, string]> = [
    [{ index: 1, count: 3, nodeId: "nav.start" }, "Opening the page"],
    [{ index: 1, count: 3, nodeId: "open-home" }, "Opening the page"],
    [{ index: 1, count: 3, nodeId: "click.voltbay-item" }, "Clicking on the page"],
    // D5 of the t174 UI review of run-musp8nz1-dbd3905a: a typing step names its field, as a click names its control.
    [{ index: 1, count: 3, nodeId: "n7", label: "Type the product name" }, "Type the product name"],
    [{ index: 1, count: 3, nodeId: "type.quantity", label: "Quantity" }, "Typing into “Quantity”"],
    [{ index: 1, count: 3, nodeId: "type.quantity" }, "Typing into the page"],
    [{ index: 1, count: 3, nodeId: "n7", label: "Add to cart" }, "Trying a step on the page"],
    [{ index: 1, count: 3, nodeId: "click.add", label: "Add to cart" }, "Clicking “Add to cart”"],
    [{ index: 1, count: 3, nodeId: "n8", label: "Click the Buy button" }, "Click the Buy button"],
    [{ index: 1, count: 3, nodeId: "extract.listings" }, "Reading the list"],
    [{ index: 1, count: 3, nodeId: "read-rows" }, "Reading the list"],
    [{ index: 1, count: 3, nodeId: "snap.home" }, "Looking at the page"],
    [{ index: 1, count: 3, nodeId: "inspect-page" }, "Looking at the page"],
    [{ index: 1, count: 3, nodeId: "scroll.down" }, "Scrolling the page"]
  ];
  for (const [step, sentence] of cases) {
    const wording = activityWording(tool("core.run_node", "started", undefined, { step }));
    assert.equal(wording.sentence, sentence, JSON.stringify(step));
    assertHuman(wording, JSON.stringify(step));
  }
});

test("a node's result code names the step when nothing else does", () => {
  assert.equal(activityWording(tool("core.run_node", "succeeded", "web.inspect.succeeded")).sentence, "Looking at the page — done");
  assert.equal(activityWording(tool("core.run_node", "succeeded", "core.replay.replayed")).sentence, "Trying the Flow out — done");
  assert.equal(activityWording(tool("core.run_node", "succeeded", "web.action.succeeded")).sentence, "Trying a step on the page — done");
});

test("result codes become a short outcome, never the code", () => {
  const cases: Array<[string | undefined, "succeeded" | "failed", string]> = [
    ["web.action.succeeded", "succeeded", "done"],
    ["web.structure.detected", "succeeded", "done"],
    ["core.replay.replayed", "succeeded", "done"],
    ["web.action.rejected.not_at_start_location", "succeeded", "that didn't work, trying another way"],
    ["web.action.rejected.target_unobserved", "succeeded", "couldn't find it on the page"],
    ["web.action.target_not_found", "succeeded", "couldn't find it on the page"],
    ["web.structure.not_detected", "succeeded", "couldn't find it on the page"],
    ["web.action.timeout", "succeeded", "that didn't work, trying another way"],
    ["web.action.failed", "succeeded", "that didn't work, trying another way"],
    ["web.something.new", "succeeded", "done"],
    [undefined, "succeeded", "done"],
    [undefined, "failed", "that didn't work, trying another way"]
  ];
  for (const [code, status, outcome] of cases) {
    const input = tool("web.detect_repeating_structure", status, code);
    const wording = activityWording(input);
    assert.equal(wording.outcome, outcome, input.label);
    assert.equal(wording.sentence, `Looking for the list of items — ${outcome}`, input.label);
    assertHuman(wording, input.label);
  }
});

test("the draft tool's end reads as the Flow updated", () => {
  assert.equal(activityWording(tool("core.flow_draft", "succeeded")).sentence, "Updating the Flow — done");
  assert.equal(activityWording(tool("core.flow_draft", "failed")).sentence, "Updating the Flow — that didn't work, trying another way");
});

test("an event that carries only Core's sentence is read from it", () => {
  assert.equal(activityWording(event({ phase: "exploring", label: "Using core.run_node" })).sentence, "Trying a step on the page");
  assert.equal(activityWording(event({ phase: "exploring", label: "Using web.detect_repeating_structure: web.action.rejected.target_unobserved" })).sentence, "Looking for the list of items — couldn't find it on the page");
  assert.equal(activityWording(event({ phase: "building", label: "Amending the draft Flow" })).sentence, "Updating the Flow");
  assert.equal(activityWording(event({ phase: "thinking", label: "Deciding the next step" })).sentence, "Thinking about the next step");
});

test("decisions and the completion check", () => {
  // t193: every decision read "Thinking about the next step", before and after the model answered.
  assert.equal(activityWording(event({ phase: "thinking", label: "Deciding the next step", detail: { kind: "thought", title: "Deciding the next step", status: "started" } })).sentence, "Deciding the next step");
  const reason = "Closing the sign-up popup that covers the store picker.";
  assert.equal(activityWording(event({ phase: "exploring", label: "Clicking “No thanks”", detail: { kind: "thought", title: "Clicking “No thanks”", text: reason, status: "succeeded" } })).sentence, reason);
  assert.equal(activityWording(event({ phase: "exploring", label: "Clicking “No thanks”", detail: { kind: "thought", title: "Clicking “No thanks”", text: "Run web.output.dom-click on t332.", status: "succeeded" } })).sentence, "Clicking “No thanks”", "a reason naming an id gives way to the action");
  assert.equal(activityWording(event({ phase: "thinking", label: "The AI model provider did not answer", detail: { kind: "thought", title: "Deciding the next step", status: "failed", text: "The AI model provider did not answer this request. Asking it again; the build stops if it keeps not answering." } })).sentence, "The AI model provider did not answer this request. Asking it again; the build stops if it keeps not answering.");
  const check = (status: "started" | "succeeded" | "failed", label: string) => activityWording(event({ phase: "verifying", label, detail: { kind: "check", title: "Completion check", status, ...(status === "failed" ? { text: "bootstrap.instructed_act_missing" } : {}) } }));
  assert.equal(check("started", "Checking the proposed result").sentence, "Checking the Flow does what you asked");
  assert.equal(check("succeeded", "The proposed result passed its check").sentence, "Checking the Flow does what you asked — done");
  assert.equal(check("failed", "The proposed result was refused").sentence, "Checking the Flow does what you asked — not yet, trying another way");
  assert.equal(activityWording(event({ phase: "verifying", label: "The proposed result was refused" })).outcome, "not yet, trying another way");
});

test("Core's human sentences are kept: run steps, saved records, settles", () => {
  const kept: ClientGatewayActivity[] = [
    event({ phase: "building", label: "Building the Flow", detail: { kind: "step", title: "Build started", status: "started", ref: "flow-1" } }),
    event({ phase: "done", label: "Build finished: a Flow is proposed", final: true }),
    event({ phase: "failed", label: "Build failed", final: true }),
    event({ phase: "running", label: "Run started", detail: { kind: "note", title: "Run started", status: "started", ref: "run-1" } }),
    event({ phase: "extracting", label: "Saved 12 records", detail: { kind: "step", title: "Records saved", status: "succeeded", ref: "extract.listings" } }),
    event({ phase: "extracting", label: "Saved 1 record" }),
    event({ phase: "repairing", label: "Recovering from a failed step: Open search" }),
    event({ phase: "waiting_permission", label: "Waiting for an answer before going on", detail: { kind: "ask", title: "Asked a question (confirm)", status: "started", ref: "ask.confirm" } })
  ];
  for (const input of kept) assert.equal(activityWording(input).sentence, input.label);
});

test("run steps read 'Running step N of M: label', without a node id standing in for the label", () => {
  const step = (label: string, index: number, count: number, stepLabel?: string) => activityWording(event({ phase: "running", label, step: { index, count, nodeId: "nav.start", ...(stepLabel ? { label: stepLabel } : {}) }, detail: { kind: "step", title: stepLabel ?? "nav.start", status: "started", ref: "nav.start" } })).sentence;
  assert.equal(step("Running step 2 of 5: Open search", 2, 5, "Open search"), "Running step 2 of 5: Open search");
  assert.equal(step("Running step 2 of 5", 2, 5), "Running step 2 of 5");
  assert.equal(step("Running step 7", 7, 5, "Next page"), "Running step 7: Next page");
  assert.equal(step("Running step 3 of 5: nav.start", 3, 5, "nav.start"), "Running step 3 of 5");
});

test("a sentence carrying an id is replaced by its phase's plain words", () => {
  const phases: Array<[ClientGatewayActivity["phase"], string]> = [
    ["thinking", "Thinking about the next step"],
    ["exploring", "Working on the page"],
    ["building", "Building the Flow"],
    ["running", "Running the Flow"],
    ["extracting", "Saving what was found"],
    ["verifying", "Checking the Flow does what you asked"],
    ["repairing", "Fixing a step that didn't work"],
    ["waiting_permission", "Waiting for your answer"],
    ["done", "Done"],
    ["failed", "That didn't work"]
  ];
  for (const [phase, sentence] of phases) {
    const wording = activityWording(event({ phase, label: `Something about web.action.rejected (${phase})` }));
    assert.equal(wording.sentence, sentence, phase);
    assertHuman(wording, phase);
  }
});

/** A tool event as Core's observer sends it once it names the call's action (Core `activity/tool-call.ts`). */
function named(fields: { phase: ClientGatewayActivity["phase"]; kind?: "tool" | "note"; title: string; label: string; status: "started" | "succeeded" | "failed"; text?: string }): ClientGatewayActivity {
  return event({ phase: fields.phase, label: fields.label, detail: { kind: fields.kind ?? "tool", title: fields.title, status: fields.status, ref: "core.run_node", ...(fields.text ? { text: fields.text } : {}) } });
}

test("Core's own words for a call are used as they come, with the outcome read from the code", () => {
  const started = activityWording(named({ phase: "exploring", title: "Clicking “Get a free quote”", label: "Clicking “Get a free quote”", status: "started" }));
  assert.deepEqual(started, { action: "Clicking “Get a free quote”", outcome: null, sentence: "Clicking “Get a free quote”", internal: false });
  const ended = activityWording(named({ phase: "exploring", title: "Opening a page", label: "Opening a page — done", status: "succeeded", text: "Result: web.action.succeeded · Node: web.output.browser-navigate" }));
  assert.equal(ended.sentence, "Opening a page — done");
  const refused = activityWording(named({ phase: "exploring", title: "Clicking on the page", label: "Clicking on the page — didn't work", status: "succeeded", text: "Result: web.action.rejected.target_unobserved · Node: web.output.dom-click" }));
  assert.equal(refused.sentence, "Clicking on the page — couldn't find it on the page");
  for (const wording of [started, ended, refused]) assertHuman(wording, wording.sentence);
});

test("a dry run reads as trying the Flow from the start, and a step that did not repeat says so", () => {
  const label = "Trying the Flow from the start: clicking “Get a free quote”";
  const started = activityWording(named({ phase: "verifying", title: "Clicking “Get a free quote”", label, status: "started" }));
  assert.equal(started.sentence, label);
  assert.equal(started.outcome, null, "a started call whose sentence has a colon has not ended");
  const changed = activityWording(named({ phase: "verifying", title: "Clicking “Get a free quote”", label: `${label} — didn't work the same way again`, status: "succeeded", text: "Result: core.replay.unreproducible · Node: web.output.dom-click" }));
  // Core's reason for the code (`fluxiq/ui` `activityActionFailureReason`), as the step's card says it (t174-lead-1003).
  assert.equal(changed.sentence, `${label} — the page wasn't in the same state when the test got there`);
  assert.equal(activityWording(named({ phase: "verifying", title: "Running a step", label: "Trying the Flow from the start: running a step — done", status: "succeeded", text: "Result: core.replay.replayed" })).sentence, "Trying the Flow from the start: running a step — done");
});

// t193 1002-M (`run-murzln6g-11debe1d`, C10): the overlay said "done" for a step
// the test only checked, and "that didn't work, trying another way" for the
// drawer's "×" the Flow passes over, while the card said "Done" and "Didn't
// work". What the test did with such a step is Core's to say, in the words its
// card says it in (`activityActionTested`), so the overlay takes Core's.
test("a dry run step the test only checked, found already done, or passed over says what the test did, in Core's words", () => {
  const label = "Trying the Flow from the start: clicking “Add to cart”";
  const said = (outcome: string, text: string) => activityWording(named({ phase: "verifying", title: "Clicking “Add to cart”", label: `${label} — ${outcome}`, status: "succeeded", text })).sentence;
  assert.equal(said("checked, not pressed", "Result: core.replay.verified · Node: web.output.dom-click"), `${label} — checked, not pressed`);
  assert.equal(said("already done on the site", "Result: core.replay.present · Node: web.output.dom-click"), `${label} — already done on the site`);
  assert.equal(said("already done on the site", "Result: core.replay.remembered · Node: web.output.dom-click"), `${label} — already done on the site`);
  assert.equal(said("skipped: not there, optional", "Result: core.replay.failed · Excused: interruption · Node: web.output.dom-click"), `${label} — skipped: not there, optional`);
  // A step that did not hold and is not excused reads as before.
  assert.equal(said("didn't work the same way again", "Result: core.replay.unreproducible · Node: web.output.dom-click"), `${label} — the page wasn't in the same state when the test got there`);
  assert.equal(said("didn't work the same way again", "Result: core.replay.changed · Node: web.output.dom-click"), `${label} — it did nothing this time, where it did something before`);
  // An older Core, whose sentence said only "done", is read as it was.
  assert.equal(said("done", "Result: core.replay.verified · Node: web.output.dom-click"), `${label} — done`);
});

test("Core's bookkeeping calls are marked internal, and nothing else is", () => {
  const reset = activityWording(named({ phase: "verifying", kind: "note", title: "Putting the page back to where the Flow starts", label: "Trying the Flow from the start", status: "started" }));
  assert.equal(reset.internal, true);
  assert.equal(reset.sentence, "Trying the Flow from the start");
  assert.equal(activityWording(named({ phase: "exploring", kind: "note", title: "Looking at the page", label: "Looking at the page", status: "started" })).internal, true);
  assert.equal(activityWording(event({ phase: "running", label: "Run started", detail: { kind: "note", title: "Run started", status: "started", ref: "run-1" } })).internal, false);
  assert.equal(activityWording(tool("core.run_node", "started")).internal, false);
});

// D3 of the t174 UI review of run-musp8nz1-dbd3905a: "the plan checks out, it
// still has to run cleanly" is Core's bookkeeping ("the plan"), not a person's words.
test("a passed completion check says, in plain words, that the Flow looks right and is tested next", () => {
  const check = (status: "started" | "succeeded" | "failed", label: string) => activityWording(event({ phase: "verifying", label, detail: { kind: "check", title: "Completion check", status } })).sentence;
  assert.equal(check("started", "Checking the proposed Flow"), "Checking the Flow does what you asked");
  assert.equal(check("succeeded", "The proposed Flow’s plan checks out; it still has to run cleanly"), "Checking the Flow does what you asked — looks right, testing it next");
  assert.doesNotMatch(check("succeeded", "The proposed Flow’s plan checks out; it still has to run cleanly"), /\bplan\b|run cleanly/u);
  assert.equal(check("failed", "The proposed Flow was sent back to be fixed"), "Checking the Flow does what you asked — not yet, trying another way");
  assert.equal(activityWording(event({ phase: "verifying", label: "The proposed Flow was sent back to be fixed" })).outcome, "not yet, trying another way");
});

test("a run step keeps Core's action, and never a node id", () => {
  const step = (label: string) => activityWording(event({ phase: "running", label, step: { index: 1, count: 7, nodeId: "node.bootstrap.a.b" }, detail: { kind: "step", title: "x", status: "started", ref: "node.bootstrap.a.b" } })).sentence;
  assert.equal(step("Running step 1 of 7: Clicking “Get a free quote”"), "Running step 1 of 7: Clicking “Get a free quote”");
  assert.equal(step("Running step 1 of 7"), "Running step 1 of 7");
  assert.equal(step("Running step 1 of 7: node.bootstrap.a.b"), "Running step 1 of 7");
});

test("U6: a control's name is quoted once, with one space between words", () => {
  const click = (label: string) => activityWording(tool("core.run_node", "started", undefined, { step: { index: 1, count: 3, nodeId: "click.x", label } })).sentence;
  assert.equal(click("  “Add   to cart” "), "Clicking “Add to cart”");
  assert.equal(click("\"Get a free quote\""), "Clicking “Get a free quote”");
  assert.equal(click("Clicker game"), "Clicking “Clicker game”");
});

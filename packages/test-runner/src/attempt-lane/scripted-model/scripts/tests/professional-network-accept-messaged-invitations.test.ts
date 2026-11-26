import assert from "node:assert/strict";
import test from "node:test";
import { scriptedModelScriptFor, type EvidenceEntry, type ScriptedModelRequest } from "../../index.js";

const TASK = "professional-network-accept-messaged-invitations";

const PAGE = [
  'URL ~/mynetwork/invitation-manager/',
  "- 1/8",
  't519 link "Ximena Ruiz View Ximena Ruiz’s profile" ~/in/ximena/',
  't523 "Hi Rafaela, we\'re both hiring"',
  "- 1/8",
  't527 button "Ignore"',
  't528 button "Accept"',
  "- 2/8",
  't534 link "Pavel Novák View Pavel Novák’s profile" ~/in/pavel/',
  "- 2/8",
  't541 button "Ignore"',
  't542 button "Accept"',
  "- 3/8",
  't561 link "Lucia Romano View Lucia Romano’s profile" ~/in/lucia/',
  "- 3/8",
  't569 button "Ignore"',
  't570 button "Accept"',
].join("\n");

const FIELDS = [
  { key: "strong_span", sample: "Ximena Ruiz" },
  { key: "headline_div", sample: "Senior Recruiter at Northbound Search" },
  { key: "x_blockquote", sample: "Hi Rafaela, we're both hiring data…" },
];

const made = (callId: string, toolId = "core.run_node", value: Record<string, unknown> = { ok: true }): EvidenceEntry => ({ callId, toolId, value });
const DETECTED = made("detect", "web.detect_repeating_structure", { extraction: "extraction.1", fields: FIELDS });

function request(page: string, extra: readonly EvidenceEntry[]): ScriptedModelRequest {
  const evidence = [...extra, { callId: "core.current_view", toolId: "core.current_view", value: { groups: [{ group: "top", callId: "x", value: { page } }] } }];
  return { kind: "evidence_tool_decision", ordinal: 1, model: "m", jsonText: true, message: "", payload: { taskKind: "evidence_tool_decision", context: { evidenceLoop: { evidence } } } };
}

type Called = { decision: { kind: string; callId?: string; toolId?: string; add?: boolean; amendments?: Record<string, unknown>[]; input?: { node?: string; write?: boolean; from?: number; consequences?: string[]; parameters?: Record<string, any> } } };
const decide = (form: string, extra: readonly EvidenceEntry[], page = PAGE) => (scriptedModelScriptFor(TASK, form).replies.evidence_tool_decision![0]!(request(page, extra)) as Called).decision;

test("it reads the rows with a message, keeping the columns the task asks for", () => {
  const read = decide("plain", [DETECTED]);
  assert.equal(read.input?.node, "web.output.dom-extract_list");
  assert.deepEqual(read.input?.parameters?.extractList.fields, { name: "strong_span", message: "x_blockquote" });
  assert.deepEqual(read.input?.parameters?.extractList.where, [{ field: "x_blockquote", is: "present" }]);
});

test("the thin form's read keeps only the message, and its press is still the first row's own control", () => {
  const read = decide("thin", [DETECTED]);
  assert.equal(read.callId, "read-invitations");
  assert.deepEqual(Object.keys(read.input?.parameters?.extractList.fields), ["message"]);
  assert.equal(decide("thin", [DETECTED, made("read-invitations")]).callId, "accept-first");
});

test("the press by hand is on the first row's own control, declares its act, and is read from the page", () => {
  const press = decide("plain", [DETECTED, made("read-invitations")]);
  assert.equal(press.callId, "accept-first");
  assert.equal(press.input?.parameters?.target.handle, "t528");
  assert.deepEqual(press.input?.consequences, ["modify_existing"]);
  assert.equal(press.add, true);
});

test("a row with no Accept left refuses, never pressing the next row's", () => {
  const accepted = PAGE.replace('t527 button "Ignore"\nt528 button "Accept"', 't621 "Accepted"');
  assert.throws(() => decide("plain", [DETECTED, made("read-invitations")], accepted), /shows no Accept/u);
});

test("the reshaping form writes a read of other columns and a press for a later row, and adds neither hand step", () => {
  assert.notEqual(decide("reshape", [DETECTED]).add, true);
  assert.notEqual(decide("reshape", [DETECTED, made("read-invitations")]).add, true);
  const read = decide("reshape", [DETECTED, made("read-invitations"), made("accept-first")]);
  assert.equal(read.input?.write, true);
  assert.deepEqual(read.input?.parameters?.extractList.fields, { person: "strong_span", note: "x_blockquote", headline: "headline_div" });
  const press = decide("reshape", [DETECTED, made("read-invitations"), made("accept-first"), made("write-read")]);
  assert.equal(press.input?.write, true);
  assert.equal(press.input?.parameters?.target.handle, "t570");
});

test("it repeats over the read, runs forward from it, and says so when the forward run did not pass", () => {
  const steps = [{ step: 6, callId: "read-invitations", actionId: "web.output.dom-extract_list", disposition: "kept" }, { step: 7, callId: "accept-first", actionId: "web.output.dom-click", disposition: "kept" }];
  const hand = [DETECTED, made("read-invitations"), made("accept-first")];
  const amended = decide("plain", [...hand, made("draft", "core.flow_draft", { steps })]);
  assert.deepEqual(amended.amendments, [{ step: 7, change: "repeat", over: 6 }]);
  const repeating = [{ ...steps[0] }, { ...steps[1], runs: "repeats through step 7, over step 6" }];
  const forward = decide("plain", [...hand, made("draft", "core.flow_draft", { steps: repeating })]);
  assert.equal(forward.toolId, "core.run_flow");
  assert.equal(forward.input?.from, 6);
  assert.throws(() => decide("plain", [...hand, made("draft", "core.flow_draft", { steps: repeating }), made("forward", "core.run_flow", { passed: false })]), /did not pass/u);
});

test("the repeat goes on the press by hand even when a conversation closed after it is the last press in the draft", () => {
  // run-mwm2glmb-f6c5aed3: a conversation opened over the page right after the accept by hand, its Close was step 8,
  // and a repeat on the last press of its kind looked for that Close in every row.
  const steps = [
    { step: 6, callId: "read-invitations", actionId: "web.output.dom-extract_list", disposition: "kept" },
    { step: 7, callId: "accept-first", actionId: "web.output.dom-click", disposition: "kept" },
    { step: 8, callId: "close-7", actionId: "web.output.dom-click", disposition: "kept" },
  ];
  const hand = [DETECTED, made("read-invitations"), made("accept-first"), made("close-7")];
  assert.deepEqual(decide("notes-back", [...hand, made("draft", "core.flow_draft", { steps })]).amendments, [{ step: 7, change: "repeat", over: 6 }]);
  const repeating = [steps[0], { ...steps[1], runs: "repeats through step 7, over step 6" }, steps[2]];
  assert.equal(decide("notes-back", [...hand, made("draft", "core.flow_draft", { steps: repeating })]).input?.from, 6);
});

test("the reshaping form repeats the press it wrote over the read it wrote, not the steps by hand", () => {
  const steps = [
    { step: 6, callId: "read-invitations", actionId: "web.output.dom-extract_list", disposition: "taken" },
    { step: 7, callId: "accept-first", actionId: "web.output.dom-click", disposition: "taken" },
    { step: 8, callId: "write-read", actionId: "web.output.dom-extract_list", written: true },
    { step: 9, callId: "write-accept", actionId: "web.output.dom-click", written: true },
  ];
  const hand = [DETECTED, made("read-invitations"), made("accept-first"), made("write-read"), made("write-accept")];
  assert.deepEqual(decide("reshape", [...hand, made("draft", "core.flow_draft", { steps })]).amendments, [{ step: 9, change: "repeat", over: 8 }]);
});

test("a repeat is never put on a step the draft does not name by the script's own call", () => {
  const steps = [{ step: 6, actionId: "web.output.dom-extract_list", disposition: "kept" }, { step: 7, actionId: "web.output.dom-click", disposition: "kept" }];
  assert.throws(() => decide("plain", [DETECTED, made("read-invitations"), made("accept-first"), made("draft", "core.flow_draft", { steps })]), /no unique step for accept-first/u);
});

test("a form the script does not have is refused, and the default is the plain one", () => {
  assert.throws(() => scriptedModelScriptFor(TASK, "other"), /no form "other"/u);
  assert.equal(scriptedModelScriptFor(TASK).taskId, TASK);
});

const AFTER = ['PAGE "Received invitations | Guildline"', "URL ~/invitation-manager/", 't30 link "Messaging" ~/messaging/', 't31 "Pavel Novák"'].join("\n");
const MESSAGING = ['PAGE "Messaging | Guildline"', "URL ~/messaging/", 't40 "Ximena Ruiz"', 't41 "New connection"'].join("\n");
const OPENED = made("back-open-messaging-1");
const CONVERSATIONS = made("back-detect", "web.detect_repeating_structure", {
  extraction: "extraction.2",
  fields: [{ key: "row_div", sample: "Ximena Ruiz · Sep 21 · New connection · A note longer than every other field of the row" }, { key: "strong", sample: "Ximena Ruiz" }, { key: "date_span", sample: "Sep 21" }, { key: "tag_span", sample: "New connection" }, { key: "line_div", sample: "A note longer than every other field of the row" }],
});

const draft = (...steps: Record<string, unknown>[]) => made("draft", "core.flow_draft", { steps });
const resultStep = (callId: string, disposition: string, extra: Record<string, unknown> = {}) => ({ step: 14, callId, actionId: "web.output.dom-extract_list", disposition, ...extra });
const lookRead = (callId: string) => made(callId, "core.run_node", { ok: true, resultNote: "a look: the result is unchanged (step 6, 3 rows)." });
const accepted = [DETECTED, made("read-invitations"), made("accept-first"), made("write-read"), made("write-accept"), made("forward", "core.run_flow", { passed: true }), lookRead("read-accepted")];
const notesRead = [OPENED, CONVERSATIONS, lookRead("back-read")];

test("the notes-back form, finding the invitations answered, opens Messaging and presses no Accept", () => {
  const open = decide("notes-back", [], AFTER);
  assert.equal(open.callId?.startsWith("back-open-messaging"), true);
  assert.equal(open.input?.node, "web.output.dom-click");
  assert.equal(open.input?.parameters?.target.handle, "t30");
  assert.equal(decide("notes-back", [OPENED], MESSAGING).callId, "back-detect");
});

test("the notes-back form reads the tagged conversations' name and own message line, off the fields, and then finishes", () => {
  const read = decide("notes-back", [OPENED, CONVERSATIONS], MESSAGING);
  assert.equal(read.callId, "back-read");
  assert.deepEqual(read.input?.parameters?.extractList.fields, { name: "strong", message: "line_div" });
  assert.deepEqual(read.input?.parameters?.extractList.where, [{ field: "tag_span", contains: "New connection" }]);
  assert.equal(decide("notes-back", [...notesRead, draft(resultStep("back-read", "kept"))], MESSAGING).kind, "complete");
});

test("every form takes its deliberately selected accepted read before completing", () => {
  for (const form of ["plain", "reshape", "thin", "notes-back"]) {
    assert.deepEqual(decide(form, [...accepted, draft(resultStep("read-accepted", "taken"))]), { kind: "amend_draft", amendments: [{ step: 14, change: "result" }] });
    assert.equal(decide(form, [...accepted, draft(resultStep("read-accepted", "kept"))]).kind, "complete");
  }
});

test("a completed result read is authored before any unrelated page action or transient field lookup", () => {
  const moved = ['PAGE "Another view"', 't90 button "Not now"', 't91 button "Close your conversation"'].join("\n");
  for (const [form, call] of [["plain", "read-accepted"], ["notes-back", "back-read"]] as const) {
    for (const disposition of ["taken", "kept"]) {
      const extra = [lookRead(call), draft(resultStep(call, disposition))];
      const decision = decide(form, extra, moved);
      assert.equal(decision.kind, disposition === "taken" ? "amend_draft" : "complete");
      assert.equal(decision.toolId, undefined);
      if (disposition === "taken") assert.deepEqual(decision.amendments, [{ step: 14, change: "result" }]);
    }
  }
});

test("a later Messaging look is taken by actual call identity while earlier rows and other probes stay alone", () => {
  const otherSteps = [
    resultStep("read-invitations", "kept", { step: 6 }),
    resultStep("probe", "taken", { step: 20 }),
    resultStep("working", "kept", { step: 21, input: { parameters: { recordOutput: { purpose: "intermediate" } } } }),
    resultStep("discarded", "dropped", { step: 22 }),
  ];
  const extra = [...notesRead, made("probe"), made("result", "core.result", { result: "step 6, 3 rows" })];
  const before = draft(resultStep("back-read", "taken"), ...otherSteps);
  const unchanged = JSON.stringify(before);
  assert.deepEqual(decide("notes-back", [...extra, before], MESSAGING), { kind: "amend_draft", amendments: [{ step: 14, change: "result" }] });
  assert.equal(JSON.stringify(before), unchanged);
  assert.deepEqual(otherSteps.map((step) => step.disposition), ["kept", "taken", "kept", "dropped"]);
  assert.equal(decide("notes-back", [...extra, draft(resultStep("back-read", "kept"), ...otherSteps)], MESSAGING).kind, "complete");
});

test("the chosen result read is not inferred from an unnamed or ambiguous draft step", () => {
  for (const steps of [
    [{ step: 14, actionId: "web.output.dom-extract_list", disposition: "taken" }, resultStep("another-read", "kept")],
    [resultStep("back-read", "taken"), resultStep("back-read", "kept", { step: 15 })],
  ]) {
    assert.throws(() => decide("notes-back", [...notesRead, draft(...steps)], MESSAGING), /unique call identity/u);
  }
});

test("a replaced, withdrawn or intermediate result read is never silently restored", () => {
  for (const step of [
    resultStep("back-read", "taken", { replacedBy: 15 }),
    resultStep("back-read", "dropped"),
    resultStep("back-read", "exploratory"),
    resultStep("back-read", "taken", { input: { parameters: { recordOutput: { purpose: "intermediate" } } } }),
  ]) {
    assert.throws(() => decide("notes-back", [...notesRead, draft(step)], MESSAGING), /final read back-read/u);
  }
});

test("a failed final read cannot be taken as the result", () => {
  assert.throws(() => decide("notes-back", [OPENED, CONVERSATIONS, made("back-read", "core.run_node", { ok: false }), draft(resultStep("back-read", "taken"))], MESSAGING), /successful final read back-read/u);
});

test("a fresh attempt already on Messaging reads there without opening My Network again", () => {
  const detect = decide("notes-back", [], MESSAGING);
  assert.equal(detect.callId, "back-detect");
  assert.equal(detect.toolId, "web.detect_repeating_structure");
  assert.equal(detect.input?.node, undefined);
});

test("the notes-back form's first attempt is still the plain accept path, and its judge reads the rows it was shown", () => {
  assert.equal(decide("notes-back", [], PAGE).callId, "detect");
  const judge = (count: number) => (scriptedModelScriptFor(TASK, "notes-back").replies.loop_verification![0]!({ kind: "loop_verification", ordinal: 1, model: "m", jsonText: true, message: "", payload: { context: { resultSummary: { totalRecordCount: count } } } }) as { diagnosis: { answersRequest: string } }).diagnosis.answersRequest;
  assert.equal(judge(0), "no");
  assert.equal(judge(3), "yes");
});

test("the script keeps its decision and judge allowances, and every notes-back judge refuses zero rows", () => {
  for (const form of ["plain", "reshape", "thin", "notes-back"]) {
    const replies = scriptedModelScriptFor(TASK, form).replies;
    assert.equal(replies.evidence_tool_decision?.length, 24);
    assert.equal(replies.loop_verification?.length, form === "notes-back" ? 4 : 1);
    assert.equal(replies.panel_command?.length, form === "notes-back" ? 2 : 1);
  }
  for (const reply of scriptedModelScriptFor(TASK, "notes-back").replies.loop_verification!) {
    const verdict = reply({ kind: "loop_verification", ordinal: 1, model: "m", jsonText: true, message: "", payload: { context: { resultSummary: { totalRecordCount: 0 } } } }) as { diagnosis: { answersRequest: string } };
    assert.equal(verdict.diagnosis.answersRequest, "no");
  }
});

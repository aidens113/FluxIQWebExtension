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
  const steps = [{ step: 6, actionId: "web.output.dom-extract_list", disposition: "kept" }, { step: 7, actionId: "web.output.dom-click", disposition: "kept" }];
  const hand = [DETECTED, made("read-invitations"), made("accept-first")];
  const amended = decide("plain", [...hand, made("draft", "core.flow_draft", { steps })]);
  assert.deepEqual(amended.amendments, [{ step: 7, change: "repeat", over: 6 }]);
  const repeating = [{ ...steps[0] }, { ...steps[1], runs: "repeats through step 7, over step 6" }];
  const forward = decide("plain", [...hand, made("draft", "core.flow_draft", { steps: repeating })]);
  assert.equal(forward.toolId, "core.run_flow");
  assert.equal(forward.input?.from, 6);
  assert.throws(() => decide("plain", [...hand, made("draft", "core.flow_draft", { steps: repeating }), made("forward", "core.run_flow", { passed: false })]), /did not pass/u);
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
  assert.equal(decide("notes-back", [OPENED, CONVERSATIONS, made("back-read")], MESSAGING).kind, "complete");
});

test("the notes-back form's first attempt is still the plain accept path, and its judge reads the rows it was shown", () => {
  assert.equal(decide("notes-back", [], PAGE).callId, "detect");
  const judge = (count: number) => (scriptedModelScriptFor(TASK, "notes-back").replies.loop_verification![0]!({ kind: "loop_verification", ordinal: 1, model: "m", jsonText: true, message: "", payload: { context: { resultSummary: { totalRecordCount: count } } } }) as { diagnosis: { answersRequest: string } }).diagnosis.answersRequest;
  assert.equal(judge(0), "no");
  assert.equal(judge(3), "yes");
});

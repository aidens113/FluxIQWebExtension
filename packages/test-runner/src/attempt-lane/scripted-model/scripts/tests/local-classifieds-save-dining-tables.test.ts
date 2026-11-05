import assert from "node:assert/strict";
import test from "node:test";
import { scriptedModelScriptFor, type EvidenceEntry, type ScriptedModelRequest } from "../../index.js";

const TASK = "local-classifieds-save-dining-tables";
const BASE = "http://127.0.0.1:1/scenarios/local-classifieds";

const LIST = [
  `URL ~/search/?query=dining+table&radius=5&sortBy=price_ascend   (~ = ${BASE})`,
  't749 link "Sponsored · Oakhaus Furniture £299 6-seater oak dining table, free delivery Kelford" ~/ad/oh-dining/?utm_source=x',
  't762 link "£28 Dining table legs x4, hairpin, 71cm Kelford Harbour" ~/item/1072/',
  't772 link "£40 Set of 4 dining chairs, match any dining table Kelford Harbour" ~/item/1058/',
  't782 link "£45 Round pine dining table, 90cm Upper Kelford" ~/item/1003/',
  't792 link "£60£85 Glass dining table with chrome legs Kelford Harbour" ~/item/1054/',
  't803 link "£95 Dining table, industrial style, 160cm Saltmarsh Row" ~/item/1055/',
  't810 link "£180 Extending oak dining table, seats 6-8 Kelford Centre" ~/item/1008/',
].join("\n");

const FIELDS = [
  { key: "a_url", kind: "link", coverage: 1, sample: "/scenarios/local-classifieds/ad/oh-dini…", type: "url" },
  { key: "a_sponsored", kind: "text", coverage: 0.17, sample: "Sponsored", type: "text" },
  { key: "a_price_was", kind: "text", coverage: 0.17, sample: "£85", type: "currency" },
  { key: "a_price", kind: "text", coverage: 1, sample: "£299", type: "currency" },
  { key: "a_title", kind: "text", coverage: 1, sample: "6-seater oak dining table, free delivery", type: "text" },
  { key: "a_place", kind: "text", coverage: 1, sample: "Kelford", type: "text" },
];

const made = (callId: string, toolId = "core.run_node", value: Record<string, unknown> = { ok: true }): EvidenceEntry => ({ callId, toolId, value });
const DETECTED = made("detect", "web.detect_repeating_structure", { extraction: "extraction.1", location: `${BASE}/search/?query=dining+table&radius=5&sortBy=price_ascend`, fields: FIELDS });

function request(page: string, extra: readonly EvidenceEntry[]): ScriptedModelRequest {
  const evidence = [...extra, { callId: "core.current_view", toolId: "core.current_view", value: { groups: [{ group: "top", callId: "x", value: { page } }] } }];
  return { kind: "evidence_tool_decision", ordinal: 1, model: "m", jsonText: true, message: "", payload: { taskKind: "evidence_tool_decision", context: { evidenceLoop: { evidence } } } };
}

type Called = { decision: { kind: string; callId?: string; toolId?: string; add?: boolean; amendments?: Record<string, unknown>[]; input?: { node?: string; write?: boolean; from?: number; consequences?: string[]; parameters?: Record<string, any> } } };
const decide = (form: string, extra: readonly EvidenceEntry[], page = LIST) => (scriptedModelScriptFor(TASK, form).replies.evidence_tool_decision![0]!(request(page, extra)) as Called).decision;

const HAND = [made("search"), made("choose-radius"), made("apply-1"), made("open-radius"), made("open-sort"), made("sort-cheapest"), DETECTED];

test("it searches for the tables, and gets the site's swallowed first Apply through with a second, different call", () => {
  const home = ["URL ~/   (~ = " + BASE + ")", 't30 field[search] "Search Marketplace" =""'].join("\n");
  const search = decide("plain", [], home);
  assert.equal(search.input?.node, "web.output.dom-type");
  assert.deepEqual(search.input?.parameters, { target: { handle: "t30" }, text: "dining table", submit: true });
  const dialog = [`URL ~/search/?query=dining+table   (~ = ${BASE})`, 't453 select "Radius" ="20 miles" [5 miles]', 't456 button "Apply" marked', 't449 dialog "Change location"'].join("\n");
  assert.equal(decide("plain", [made("search")], dialog).input?.node, "web.output.dom-select");
  const first = decide("plain", [made("search"), made("choose-radius")], dialog);
  assert.equal(first.callId, "apply-1");
  assert.equal(first.input?.parameters?.timeoutMs, undefined);
  const second = decide("plain", [made("search"), made("choose-radius"), made("apply-1")], dialog);
  assert.equal(second.callId, "apply-2");
  assert.equal(second.input?.parameters?.timeoutMs, 12_000);
});

test("the read keeps the three cheapest tables: no advert, not the legs or chairs, and the glass table whose title merely says legs stays", () => {
  const read = decide("plain", HAND);
  assert.equal(read.callId, "read-tables");
  assert.equal(read.add, true);
  assert.deepEqual(read.input?.parameters?.extractList.fields, { title: "a_title", price: "a_price", url: "a_url" });
  assert.deepEqual(read.input?.parameters?.extractList.where, [
    { field: "a_sponsored", is: "present", not: true },
    { field: "a_title", contains: ["table legs", "chairs"], not: true },
    { field: "a_price", atMost: 95 },
  ]);
});

test("the cheapest table is opened by its own address, saved by hand with its act declared, and the list is come back to unadded", () => {
  const open = decide("plain", [...HAND, made("read-tables")]);
  assert.equal(open.callId, "open-first");
  assert.equal(open.input?.node, "web.output.browser-navigate");
  assert.equal(open.input?.parameters?.url, `${BASE}/item/1003/`);
  const item = [`URL ~/item/1003/   (~ = ${BASE})`, 't979 button "Save"'].join("\n");
  const save = decide("plain", [...HAND, made("read-tables"), made("open-first")], item);
  assert.equal(save.callId, "save-first");
  assert.equal(save.input?.parameters?.target.handle, "t979");
  assert.deepEqual(save.input?.consequences, ["modify_existing"]);
  assert.equal(save.add, true);
  const back = decide("plain", [...HAND, made("read-tables"), made("open-first"), made("save-first")], item);
  assert.equal(back.input?.parameters?.url, `${BASE}/search/?query=dining+table&radius=5&sortBy=price_ascend`);
  assert.notEqual(back.add, true);
});

test("a table's page with no Save refuses, never pressing another control", () => {
  assert.throws(() => decide("plain", [...HAND, made("read-tables"), made("open-first")], `URL ~/item/1003/   (~ = ${BASE})`), /shows no Save/u);
});

const steps = (...rest: Record<string, unknown>[]) => made("draft", "core.flow_draft", { steps: rest });
const READ = { step: 10, actionId: "web.output.dom-extract_list", disposition: "kept" };
const OPEN = { step: 11, actionId: "web.output.browser-navigate", disposition: "kept", input: { parameters: { url: `${BASE}/item/1003/` } } };
const SAVE = { step: 12, actionId: "web.output.dom-click", disposition: "kept" };
const BACK = { step: 13, actionId: "web.output.browser-navigate", disposition: "kept", input: { parameters: { url: `${BASE}/search/` } } };
const DONE = [...HAND, made("read-tables"), made("open-first"), made("save-first"), made("back-first"), made("detect-again")];

test("the plain form repeats the opening and the save over its own read, and binds the address to the row's", () => {
  const amended = decide("plain", [...DONE, steps(READ, OPEN, SAVE, BACK)]);
  assert.deepEqual(amended.amendments, [
    { step: 11, change: "repeat", through: 12, over: 10 },
    { step: 11, change: "bind", input: { url: { $row: "url" } } },
  ]);
});

test("the reshaping form writes a read of other columns, without the price, and moves it before the repeat", () => {
  const written = decide("reshape", [...DONE, steps(OPEN, SAVE, BACK)]);
  assert.equal(written.input?.write, true);
  assert.deepEqual(written.input?.parameters?.extractList.fields, { listing: "a_title", link: "a_url" });
  const read = { step: 14, actionId: "web.output.dom-extract_list", written: true };
  const amended = decide("reshape", [...DONE, made("write-read"), steps(OPEN, SAVE, BACK, read)]);
  assert.deepEqual(amended.amendments, [
    { step: 14, change: "reorder", to: 11 },
    { step: 11, change: "repeat", through: 12, over: 14 },
    { step: 11, change: "bind", input: { url: { $row: "link" } } },
  ]);
});

test("once the draft repeats, it runs forward from its read, and says so when the forward run did not pass", () => {
  const repeating = steps(READ, { ...OPEN, runs: "repeats through step 12, over step 10" }, SAVE);
  const forward = decide("plain", [...DONE, repeating]);
  assert.equal(forward.toolId, "core.run_flow");
  assert.equal(forward.input?.from, 10);
  assert.throws(() => decide("plain", [...DONE, repeating, made("forward", "core.run_flow", { passed: false })]), /did not pass/u);
});

test("the row-link form opens the first table by pressing its card, keeps the way back, and repeats all three with no binding", () => {
  const open = decide("row-link", [...HAND, made("read-tables")]);
  assert.equal(open.callId, "open-first");
  assert.equal(open.input?.node, "web.output.dom-click");
  assert.deepEqual(open.input?.parameters, { target: { handle: "t782" } });
  assert.equal(open.add, true);
  const item = [`URL ~/item/1003/   (~ = ${BASE})`, 't979 button "Save"'].join("\n");
  const back = decide("row-link", [...HAND, made("read-tables"), made("open-first"), made("save-first")], item);
  assert.equal(back.callId, "back-first");
  assert.equal(back.add, true);
  const card = { step: 11, actionId: "web.output.dom-click", disposition: "kept" };
  const save = { step: 12, actionId: "web.output.dom-click", disposition: "kept" };
  const again = { step: 13, actionId: "web.output.browser-navigate", disposition: "kept", input: { parameters: { url: `${BASE}/search/` } } };
  const amended = decide("row-link", [...DONE, steps(READ, card, save, again)]);
  assert.deepEqual(amended.amendments, [{ step: 11, change: "repeat", through: 13, over: 10 }]);
});

test("after the forward run it presses the Saved link the view shows, goes by the address only when that was refused, sorts, and reads title, price and status", () => {
  const forward = made("forward", "core.run_flow", { passed: true });
  const shown = [`URL ~/item/1055/   (~ = ${BASE})`, 't935 link "Saved 2" ~/saved/'].join("\n");
  const open = decide("plain", [...DONE, forward], shown);
  assert.equal(open.callId, "open-saved");
  assert.deepEqual(open.input?.parameters, { target: { handle: "t935" } });
  const byAddress = decide("plain", [...DONE, forward, made("open-saved")], shown);
  assert.equal(byAddress.callId, "open-saved-by-address");
  assert.equal(byAddress.input?.parameters?.url, `${BASE}/saved/`);
  const saved =[`URL ~/saved/   (~ = ${BASE})`, 't1132 select "Sort saved items" ="Recently saved"', 't1138 link "Lamp" ~/item/1030/'].join("\n");
  const sort = decide("plain", [...DONE, forward, made("open-saved")], saved);
  assert.deepEqual(sort.input?.parameters, { target: { handle: "t1132" }, value: "price_ascend" });
  const SAVED_FIELDS = [
    { key: "t", kind: "text", type: "text", coverage: 1, sample: "Lamp" },
    { key: "t_url", kind: "link", type: "url", coverage: 1 },
    { key: "p", kind: "text", type: "currency", coverage: 1, sample: "£22" },
    { key: "s", kind: "text", type: "text", coverage: 1, sample: "Available" },
    { key: "w", kind: "text", type: "currency", coverage: 0.2, sample: "£85" },
  ];
  const detected = made("detect-saved", "web.detect_repeating_structure", { extraction: "extraction.2", fields: SAVED_FIELDS });
  const so_far = [...DONE, forward, made("open-saved"), made("sort-saved"), detected];
  const read = decide("plain", so_far, saved);
  assert.equal(read.callId, "read-saved");
  assert.deepEqual(read.input?.parameters?.extractList.fields, { title: "t", price: "p", status: "s" });
  assert.equal(decide("plain", [...so_far, made("read-saved")], saved).kind, "complete");
});

test("the open-save-back form does what the paid run did, in its order, and its Save step is the one the model wrote", () => {
  const HOME = [...HAND];
  const open = decide("open-save-back", HOME);
  assert.equal(open.callId, "open-first");
  assert.deepEqual(open.input?.parameters, { target: { handle: "t782" } });
  assert.equal(open.add, undefined);
  const item = [`URL ~/item/1003/   (~ = ${BASE})`, 't979 button "Save"', 't980 button "Share"'].join("\n");
  const save = decide("open-save-back", [...HOME, made("open-first")], item);
  assert.equal(save.callId, "save-first");
  assert.deepEqual(save.input?.consequences, ["modify_existing"]);
  const savedPage = [`URL ~/item/1003/   (~ = ${BASE})`, 't979 button "Saved" pressed', 't980 button "Share"'].join("\n");
  const back = decide("open-save-back", [...HOME, made("open-first"), made("save-first")], savedPage);
  assert.equal(back.callId, "back-first");
  assert.equal(back.add, true);
  const again = [...HOME, made("open-first"), made("save-first"), made("back-first")];
  assert.equal(decide("open-save-back", again).callId, "detect-again");
  const deduped = decide("open-save-back", [...again, made("detect-again")]);
  assert.equal(deduped.callId, "read-deduped");
  assert.equal(deduped.input?.parameters?.extractList.dedupe, true);
  assert.equal(deduped.input?.parameters?.recordOutput.purpose, "intermediate");
  assert.equal(deduped.add, undefined);
  const read = decide("open-save-back", [...again, made("detect-again"), made("read-deduped")]);
  assert.equal(read.callId, "read-tables");
  assert.equal(read.input?.parameters?.extractList.dedupe, undefined);
  assert.deepEqual(Object.keys(read.input?.parameters?.extractList.fields), ["title", "price", "link"]);
  assert.deepEqual(read.input?.parameters?.extractList.where[0], { field: "a_sponsored", is: "absent" });
  assert.equal(read.add, true);
  const read2 = [...again, made("detect-again"), made("read-deduped"), made("read-tables")];
  const openAgain = decide("open-save-back", read2);
  assert.equal(openAgain.callId, "open-again");
  assert.equal(openAgain.add, true);
  const write = decide("open-save-back", [...read2, made("open-again")], savedPage);
  assert.equal(write.callId, "write-save");
  assert.equal(write.input?.node, "web.output.dom-check");
  assert.deepEqual(write.input?.parameters, { target: { handle: "t979" }, checked: true });
  assert.deepEqual(write.input?.consequences, ["modify_existing"]);
  assert.equal(write.input?.write, true);
});

test("the open-save-back form leaves out its hand presses, puts the way back after the save, repeats the first three rows, and asks for the loop by its first step from the saved items", () => {
  const before = [...HAND, made("open-first"), made("save-first"), made("back-first"), made("detect-again"), made("read-deduped"), made("read-tables"), made("open-again"), made("write-save")];
  const press = (step: number, target: string) => ({ step, actionId: "web.output.dom-click", disposition: "kept", does: { target } });
  const sort = press(7, "Price: lowest first");
  const firstOpen = press(8, "£45 Round pine dining table, 90cm Upper Kelford");
  const firstSave = press(9, "Save");
  const backStep = { step: 10, actionId: "web.output.browser-navigate", disposition: "kept", input: { parameters: { url: `${BASE}/search/` } } };
  const readStep = { step: 11, actionId: "web.output.dom-extract_list", disposition: "kept" };
  const loopOpen = press(12, "£45 Round pine dining table, 90cm Upper Kelford");
  const check = { step: 13, actionId: "web.output.dom-check", written: true, does: { target: "Saved" } };
  const amended = decide("open-save-back", [...before, steps(sort, firstOpen, firstSave, backStep, readStep, loopOpen, check)]);
  assert.deepEqual(amended.amendments, [
    { step: 8, change: "drop" },
    { step: 9, change: "drop" },
    { step: 10, change: "reorder", to: 13 },
    { step: 12, change: "repeat", over: 11, through: 10, most: 3 }
  ]);
  const looped = steps(sort, readStep, { ...loopOpen, runs: "repeats through step 13" }, check, { ...backStep, step: 14 });
  const see = decide("open-save-back", [...before, looped]);
  assert.equal(see.callId, "see-saved");
  assert.equal(see.input?.parameters?.url, `${BASE}/saved/`);
  assert.equal(see.add, true);
  const saved = [`URL ~/saved/   (~ = ${BASE})`, 't1259 link "Saved 3" current ~/saved/', 't1290 select "Sort saved items" ="Recently saved"', 't1296 link "Lamp" ~/item/1030/'].join("\n");
  const forward = decide("open-save-back", [...before, looped, made("see-saved")], saved);
  assert.equal(forward.toolId, "core.run_flow");
  assert.deepEqual(forward.input, { from: 12 });
  const after = decide("open-save-back", [...before, looped, made("see-saved"), made("forward", "core.run_flow", { passed: true })], saved);
  assert.equal(after.callId, "sort-saved");
  assert.throws(() => decide("open-save-back", [...before, looped, made("see-saved"), made("forward", "core.run_flow", { passed: false })], saved), /did not pass/u);
});

const itemPage = (saved: boolean) => [`URL ~/item/1003/   (~ = ${BASE})`, saved ? 't900 button "Saved"' : 't889 button "Save"'].join("\n");
/** One script across its decisions, as a run has: it remembers the list's addresses from when the list showed. */
const script = (form: string) => {
  const decision = scriptedModelScriptFor(TASK, form).replies.evidence_tool_decision![0]!;
  return (extra: readonly EvidenceEntry[], page = LIST) => (decision(request(page, extra)) as Called).decision;
};
const SORTED = [made("search"), made("choose-radius"), made("apply-1"), made("open-radius"), made("open-sort"), made("sort-cheapest")];

for (const [form, before] of [["by-hand", [...SORTED, DETECTED, made("read-tables")]], ["by-hand-unread", SORTED]] as const) {
  test(`the ${form} form presses each table's Save by hand, opening each by its own page, as a paid run did, with no forward run`, () => {
    const next = script(form);
    const open = next(before);
    assert.equal(open.callId, "open-1");
    assert.deepEqual(open.input, { node: "web.output.dom-click", parameters: { target: { handle: "t782" } }, consequences: [] });
    const first = next([...before, made("open-1")], itemPage(false));
    assert.equal(first.callId, "save-1");
    assert.deepEqual(first.input, { node: "web.output.dom-click", parameters: { target: { handle: "t889" } }, consequences: ["modify_existing"] });
    const second = next([...before, made("open-1"), made("save-1")], itemPage(true));
    assert.equal(second.callId, "open-2");
    assert.equal(second.input?.node, "web.output.browser-navigate");
    assert.equal(second.input?.parameters?.url, `${BASE}/item/1054/`);
    assert.equal(next([...before, made("open-1"), made("save-1"), made("open-2")], itemPage(false)).callId, "save-2");
    const third = next([...before, made("open-1"), made("save-1"), made("open-2"), made("save-2")], itemPage(true));
    assert.equal(third.input?.parameters?.url, `${BASE}/item/1055/`);
    const allThree = [...before, made("open-1"), made("save-1"), made("open-2"), made("save-2"), made("open-3"), made("save-3")];
    const saved = [`URL ~/saved/   (~ = ${BASE})`, 't1290 select "Sort saved items" ="Recently saved"'].join("\n");
    assert.equal(next(allThree, saved).callId, "sort-saved");
  });
}

test("the by-hand form reads the list first and the unread form does not", () => {
  assert.equal(script("by-hand")([...SORTED, DETECTED]).callId, "read-tables");
  assert.equal(script("by-hand")(SORTED).callId, "detect");
  assert.equal(script("by-hand-unread")(SORTED).callId, "open-1");
});

test("a form the script does not have is refused, and the default is the plain one", () => {
  assert.throws(() => scriptedModelScriptFor(TASK, "other"), /no form "other"/u);
  assert.equal(scriptedModelScriptFor(TASK).taskId, TASK);
});

const TABLES_PAGE = LIST;
const note = (flowRun: Record<string, unknown>): EvidenceEntry => ({ callId: "core.attempt_note.1", toolId: "core.attempt_note", value: { flowRun } });
const judge = (form: string, ordinal: number, recordSets: unknown) => scriptedModelScriptFor(TASK, form).replies.loop_verification![ordinal]!({ kind: "loop_verification", ordinal: ordinal + 1, model: "m", jsonText: true, message: "", payload: { context: { resultSummary: { recordSets } } } }) as { diagnosis: { answersRequest: string; defects: { row: string }[] } };
const SAVED_ROWS = [{ sampleRows: [{ title: "Round pine dining table, 90cm" }, { title: "Glass dining table with chrome legs" }, { title: "Dining table, industrial style, 160cm" }] }];

test("the same words a second time go to the same command, and there are replies for a second attempt", () => {
  const script = scriptedModelScriptFor(TASK, "again-check");
  assert.equal(script.replies.panel_command!.length, 2);
  const message = "Save the tables.";
  assert.deepEqual(script.replies.panel_command![1]!({ kind: "panel_command", ordinal: 2, model: "m", jsonText: false, message, payload: undefined }), { do: "flow.createHere", with: { instruction: message } });
  assert.ok(script.replies.loop_verification!.length >= 2);
});

test("the two-attempt form that saves by setting a state refuses any decision after the saved Flow's run: it never presses to get there", () => {
  const item = [`URL ~/item/1003/   (~ = ${BASE})`, 't987 button "Saved" pressed'].join("\n");
  assert.throws(() => decide("again-check", [note({ stoppedAt: 8, happened: "The step's control was not found on the page." })], item), /did not end the attempt, stopped at step 8: The step's control was not found/u);
});

test("its judge reads the real rows: the three saved tables are the answer, and one gone is a no naming it", () => {
  assert.equal(judge("again-check", 1, SAVED_ROWS).diagnosis.answersRequest, "yes");
  const short = judge("again-check", 1, [{ sampleRows: [{ title: "Round pine dining table, 90cm" }] }]);
  assert.equal(short.diagnosis.answersRequest, "no");
  assert.deepEqual(short.diagnosis.defects.map((defect) => defect.row), ["Glass dining table", "Dining table, industrial"]);
});

test("the form that presses again has a judge that says yes to whatever it is shown, so only the Lab's oracle can catch it", () => {
  assert.equal(judge("again-press", 1, [{ sampleRows: [] }]).diagnosis.answersRequest, "yes");
});

test("the Run again form keeps the state-setting form's Flow, refuses any decision after the saved Flow's run, and its judge reads the real rows", () => {
  const sorted = [`URL ~/search/?query=dining+table&radius=5&sortBy=price_ascend   (~ = ${BASE})`, ...TABLES_PAGE.split("\n").slice(1)].join("\n");
  const home = [`URL ~/   (~ = ${BASE})`, 't30 field[search] "Search Marketplace" =""'].join("\n");
  const searching = [made("search"), made("choose-radius"), made("apply-1"), made("open-radius"), made("open-sort"), made("sort-cheapest")];
  const item = [`URL ~/item/1003/   (~ = ${BASE})`, 't987 button "Saved" pressed'].join("\n");
  const checking = scriptedModelScriptFor(TASK, "again-check").replies.evidence_tool_decision![0]!;
  const again = scriptedModelScriptFor(TASK, "run-again").replies.evidence_tool_decision![0]!;
  assert.deepEqual((again(request(sorted, searching)) as Called).decision, (checking(request(sorted, searching)) as Called).decision);
  const written = [...searching, made("detect"), made("open-first"), made("save-first"), made("back-first")];
  assert.deepEqual((again(request(item, written)) as Called).decision, (checking(request(item, written)) as Called).decision);
  assert.equal((again(request(item, written)) as Called).decision.input?.node, "web.output.dom-check");
  const stopped = note({ stoppedAt: 5, happened: "The step's control was not found on the page." });
  assert.throws(() => again(request(home, [stopped])), /did not end the attempt, stopped at step 5/u);
  assert.equal(judge("run-again", 1, SAVED_ROWS).diagnosis.answersRequest, "yes");
  assert.equal(judge("run-again", 1, [{ sampleRows: [] }]).diagnosis.answersRequest, "no");
});

test("on the second attempt that form goes to each table the first saved and presses again, by what the page shows", () => {
  const reply = scriptedModelScriptFor(TASK, "again-press").replies.evidence_tool_decision![0]!;
  const sorted = [`URL ~/search/?query=dining+table&radius=5&sortBy=price_ascend   (~ = ${BASE})`, ...TABLES_PAGE.split("\n").slice(1)].join("\n");
  (reply(request(sorted, [made("search"), made("choose-radius"), made("apply-1"), made("open-radius"), made("open-sort"), made("sort-cheapest")])) as Called);
  const stopped = note({ stoppedAt: 5, happened: "The step's control was not found on the page." });
  const home = [`URL ~/   (~ = ${BASE})`, 't30 field[search] "Search Marketplace" =""'].join("\n");
  const open = (reply(request(home, [stopped])) as Called).decision;
  assert.equal(open.callId, "again-open-1");
  assert.equal(open.input?.parameters?.url, `${BASE}/item/1003/`);
  const item = [`URL ~/item/1003/   (~ = ${BASE})`, 't987 button "Saved" pressed'].join("\n");
  const press = (reply(request(item, [stopped, made("again-open-1")])) as Called).decision;
  assert.equal(press.callId, "again-save-1");
  assert.equal(press.input?.parameters?.target.handle, "t987");
  assert.deepEqual(press.input?.consequences, ["modify_existing"]);
});

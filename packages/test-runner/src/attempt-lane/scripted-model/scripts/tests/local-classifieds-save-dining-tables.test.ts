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

test("a form the script does not have is refused, and the default is the plain one", () => {
  assert.throws(() => scriptedModelScriptFor(TASK, "other"), /no form "other"/u);
  assert.equal(scriptedModelScriptFor(TASK).taskId, TASK);
});

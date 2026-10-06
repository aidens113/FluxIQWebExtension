// A replayed list read is compared by the read's own account, not by the
// longest array its payload happens to carry.
//
// A live `extract_list` payload always carries other lists -- the column names,
// the per-condition rejections, the snapshot's controls -- so the longest one
// was never 0. t227's run (`run-muq310ht-ab80eed0`) replayed a read on a "No
// results" page and the dry run said `replayed`; run 11's duplicate read
// (`run-muq4oaof-464f5bce`) passed the dry run answering with rows every
// condition had rejected (t194-d227).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { webNodeReplayStatement } from "../replay";
import { webNodeReplayReadRows } from "../replay-answer";
import { WEB_LLM_WITHHELD_TEXT } from "../../withheld";
import { WEB_NODE_REJECTED_ROWS_CHECK, WEB_NODE_REPLAY_READ_ROWS_NOTE } from "../rejected-rows";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const EXTRACT = "web.output.dom-extract_list";
const START = "https://example.test/start";
const PERMITTED = async () => ({ permitted: true as const });
const READ = { extractList: { item: ".card", fields: { name: { selector: ".name" } }, minItems: 0 } };

test("a list read's replay statement records the read's own counts, not the longest list in its payload", () => {
  const empty = webNodeReplayStatement({ location: START, payload: liveRead({ recordCount: 0, itemsSeen: 0 }), reads: true });
  assert.deepEqual(empty.produced, { records: 0, itemsSeen: 0 });
  const filtered = webNodeReplayStatement({ location: START, payload: liveRead({ recordCount: 10, itemsSeen: 94, unfiltered: false }), reads: true });
  assert.deepEqual(filtered.produced, { records: 10, itemsSeen: 94, unfiltered: false });
  // Any other payload is counted as it always was: the longest list it carries.
  assert.deepEqual(webNodeReplayStatement({ location: START, payload: { extracted: [1, 2, 3], other: [1] }, reads: true }).produced, { records: 3 });
});

test("a read that read rows and now reads none on a live-shaped payload has changed", async () => {
  const replayed = await replay(liveRead({ recordCount: 0, itemsSeen: 0 }), { records: 12, itemsSeen: 94 });
  assert.equal(replayed.resultCode, "core.replay.changed");
});

test("a read whose list was there and now is not has changed, even where its conditions kept no row", async () => {
  const replayed = await replay(liveRead({ recordCount: 0, itemsSeen: 0 }), { records: 0, itemsSeen: 11 });
  assert.equal(replayed.resultCode, "core.replay.changed");
});

test("a read whose conditions kept rows and now answer unfiltered has changed; the same read again has not", async () => {
  const unfiltered = await replay(liveRead({ recordCount: 11, itemsSeen: 11, unfiltered: true }), { records: 10, itemsSeen: 94, unfiltered: false });
  assert.equal(unfiltered.resultCode, "core.replay.changed");

  // Fewer rows, or a read that was unfiltered when the build ran it too, is the page and not the step.
  const fewer = await replay(liveRead({ recordCount: 4, itemsSeen: 40, unfiltered: false }), { records: 10, itemsSeen: 94, unfiltered: false });
  assert.equal(fewer.resultCode, "core.replay.replayed");
  const alreadyUnfiltered = await replay(liveRead({ recordCount: 11, itemsSeen: 11, unfiltered: true }), { records: 11, itemsSeen: 11, unfiltered: true });
  assert.equal(alreadyUnfiltered.resultCode, "core.replay.replayed");
});

// Run 15 (`run-muqj2bgb-d048ec37`): the judge of the build's test was told of
// this read only "the step ran again", was unsure, and then said the pagination
// never resolved. The replay now states the read's own account.
test("a replayed list read says what it read: rows kept, pages and why it stopped, items seen, and each condition's rejections", async () => {
  const where = [
    { field: "ad", is: "absent" },
    { field: "plus", is: "present" },
    { field: "rating", atLeast: 4 },
    { field: "price", lessThan: 50 },
    { field: "name", contains: ["ear tips", "charging case"], not: true }
  ];
  const payload = liveRead({ recordCount: 10, itemsSeen: 94, unfiltered: false });
  const extraction = payload.extraction as JsonObject;
  Object.assign(extraction, { pagesRead: 5, paginationStop: "control_disabled" });
  extraction.conditions = { applied: 94, kept: 12, rejected: [20, 37, 34, 40, 20], unfiltered: false, alone: [4, 6, 12, 3, 5] };
  const replayed = await replay(payload, { records: 10, itemsSeen: 94, unfiltered: false }, { extractList: { ...READ.extractList, where } });
  assert.equal(replayed.resultCode, "core.replay.replayed");
  assert.equal(
    (replayed.evidence as JsonObject).said,
    "the step ran again: kept 10 rows from 5 pages, stopped on control_disabled; 94 items seen; per condition rejected (removed alone): ad 20 (4), plus 37 (6), rating 34 (12), price 40 (3), name 20 (5)"
  );

  // A request that does not line up with the report names its conditions by position.
  const unaligned = await replay(payload, { records: 10, itemsSeen: 94, unfiltered: false });
  assert.match(String((unaligned.evidence as JsonObject).said), /per condition rejected \(removed alone\): condition 1 20 \(4\), condition 2 37 \(6\)/u);
});

test("a replayed step whose payload carries no read account still says only that it ran", async () => {
  const replayed = await replay({ clicked: true }, {});
  assert.equal(replayed.resultCode, "core.replay.replayed");
  assert.equal((replayed.evidence as JsonObject).said, "the step ran again");
});

/** Replay the read once against a page that answers with `payload`, as the build recorded `produced`. */
async function replay(payload: JsonObject, produced: JsonObject, parameters: JsonObject = READ) {
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page() } };
      return { status: "succeeded", payload };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  return await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.19", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: EXTRACT, parameters, consequences: [], produced }
  });
}

/**
 * A list read's payload as the extension sends it: the rows, the read's account
 * with its column names and per-condition rejections, and the page's snapshot,
 * whose controls outnumber the rows of any read here.
 */
function liveRead(account: { recordCount: number; itemsSeen: number; unfiltered?: boolean }): JsonObject {
  const rows = Array.from({ length: account.recordCount }, (_, index) => ({ name: `Row ${index}` }));
  const extraction: JsonObject = {
    recordCount: account.recordCount,
    pagesRead: 1,
    itemsSeen: account.itemsSeen,
    truncated: false,
    fieldNames: ["name", "price", "rating", "url", "plus", "ad"],
    missingFields: []
  };
  if (account.unfiltered !== undefined) {
    extraction.conditions = { applied: account.itemsSeen, kept: account.unfiltered ? 0 : account.recordCount, rejected: [4, 5, 4, 7, 3], unfiltered: account.unfiltered };
  }
  const snapshot = page();
  snapshot.interactiveElements = Array.from({ length: 40 }, (_, index) => ({ tagName: "a", selector: `#link-${index}`, visibleText: `Link ${index}` }));
  return { extracted: rows, extraction, snapshot };
}

function page(): JsonObject {
  return {
    url: START,
    title: "Fixture",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }]
  };
}

// t194 w55: a replayed list read names its rows to the judge of a build's test.
// Live run `run-muqk713g` (C3): the judge was told "name 20 (5)" of a read that
// kept 10 of the 13 earbuds asked for and passed it; the three missing pairs
// were rows the name condition removed by itself. The replay now asks the page
// for those rows, as a Flow's playback does, and its answer names them, with
// the rows it returned, by label (Core `result-verification/build-test/
// read-rows.ts` screens them).
const FIELDS = ["url", "name", "price"];
const WHERE = [
  { field: "price", lessThan: 50 },
  { field: "name", contains: ["ear tips", "charging case"], not: true }
];
const LUMO = "Lumo Audio Drift Pro Wireless Earbuds, Wireless Charging Case, Touch Control, White";
const AURELLE = "Aurelle Pods Fit Wireless Earbuds, Ivory with Wireless Charging Case";

test("a replayed read with conditions asks the page for the rows each removed by itself, and names them beside the rows it kept", async () => {
  const kept = [row("Trevio T5 Wireless Earbuds, Ivory", "$22.99"), row("Soundcrest Air Lite", "$19.99")];
  const replayed = await replaySent(readOf(kept, {
    rejected: [1, 3], alone: [1, 2],
    samples: [[row("Soundcrest Air Pro Max", "$89.99")], [row(LUMO, "$26.99"), row(AURELLE, "$39.99")]], leads: [1, 2]
  }), { extractList: { item: ".card", fields: fieldMap(), where: WHERE } });
  assert.equal(replayed.result.resultCode, "core.replay.replayed");
  assert.equal(replayed.sent?.rejectedSamples, "alone");
  // A row the price condition left out carries the price it tested (t195-w34, run
  // `run-murwcaj0-40e56557` R6); the name condition's rows carry none, since
  // the column it tested is their label.
  assert.deepEqual((replayed.result.evidence as JsonObject).readRows, {
    rows: [{ name: "Trevio T5 Wireless Earbuds, Ivory" }, { name: "Soundcrest Air Lite" }],
    leftOutOnlyByThis: [
      { condition: "price", rows: [{ name: "Soundcrest Air Pro Max", price: "$89.99" }] },
      { condition: "name", rows: [{ name: LUMO }, { name: AURELLE }] }
    ],
    // How to read the rows a condition removed by itself (t194 w68, below).
    note: WEB_NODE_REPLAY_READ_ROWS_NOTE
  });
  // The counts line is unchanged.
  assert.match(String((replayed.result.evidence as JsonObject).said), /per condition rejected \(removed alone\): price 1 \(1\), name 3 \(2\)$/u);
});

test("a replayed read names every row it returned, with no cap, and withholds a label shaped like a secret", async () => {
  const kept = Array.from({ length: 53 }, (_, index) => row(index === 0 ? "Gift card 4111 1111 1111 1111" : `Earbuds ${index}`, "$10.00"));
  const replayed = await replaySent(readOf(kept), { extractList: { item: ".card", fields: fieldMap() } });
  const rows = (replayed.result.evidence as JsonObject).readRows as JsonObject;
  // A read without conditions asks for no rejected rows.
  assert.equal(replayed.sent?.rejectedSamples, undefined);
  assert.equal((rows.rows as JsonObject[]).length, 53);
  assert.equal(rows.rowsNotShown, undefined);
  assert.deepEqual((rows.rows as JsonObject[])[0], { name: `Gift card ${WEB_LLM_WITHHELD_TEXT}` });
  assert.equal(rows.leftOutOnlyByThis, undefined);
});

test("a Flow whose read already says what rejected rows to ask for is replayed as it says", async () => {
  const replayed = await replaySent(readOf([row("Soundcrest Air Lite", "$19.99")], { rejected: [0, 1], alone: [0, 1] }), {
    extractList: { item: ".card", fields: fieldMap(), where: WHERE },
    rejectedSamples: false
  });
  assert.equal(replayed.sent?.rejectedSamples, false);
  assert.deepEqual((replayed.result.evidence as JsonObject).readRows, { rows: [{ name: "Soundcrest Air Lite" }] });
});

test("a replayed step that is not a list read names no rows", async () => {
  const replayed = await replaySent({ clicked: true }, { extractList: { item: ".card", fields: fieldMap(), where: WHERE } });
  assert.equal((replayed.result.evidence as JsonObject).readRows, undefined);
  assert.equal((replayed.result.evidence as JsonObject).said, "the step ran again");
});

/** One row as the page reads it: its address first, so the label is the first column that is text. */
function row(name: string, price: string): Record<string, string> {
  return { url: `https://example.test/p/${encodeURIComponent(name).slice(0, 12)}`, name, price };
}

function fieldMap(): JsonObject {
  return Object.fromEntries(FIELDS.map((field) => [field, `.${field}`]));
}

/** A list read's payload: the rows it kept, and its account with, when given, the rows each condition removed by itself. */
function readOf(kept: Array<Record<string, string>>, conditions?: { rejected: number[]; alone: number[]; samples?: Array<Array<Record<string, string>>>; leads?: number[] }): JsonObject {
  const extraction: JsonObject = { recordCount: kept.length, pagesRead: 1, itemsSeen: kept.length + 4, truncated: false, fieldNames: FIELDS, missingFields: [] };
  if (conditions) {
    extraction.conditions = { applied: kept.length + 4, kept: kept.length, rejected: conditions.rejected, unfiltered: false, alone: conditions.alone };
    if (conditions.samples) Object.assign(extraction, { rejectedSamples: conditions.samples, rejectedSamplesAlone: conditions.leads ?? [] });
  }
  return { extracted: kept, extraction };
}

/** Replay the read once against a page that answers with `payload`, keeping the parameters the read was sent with. */
async function replaySent(payload: JsonObject, parameters: JsonObject) {
  let sent: JsonObject | undefined;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page() } };
      sent = command.parameters as JsonObject;
      return { status: "succeeded", payload };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const result = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.19", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: EXTRACT, parameters, consequences: [], produced: { records: 1 } }
  });
  return { result, sent };
}


// t195-w34, live run `run-murwcaj0-40e56557` (cause R6): the friend-requests
// read kept "5 or more mutual friends" with a regex that dropped Jonas Weber
// ("Aisha Khan and 4 other mutual friends" is five), and the judge, shown only
// the names left out, called them "exactly the requests with fewer than five
// mutual friends". A left-out row now carries the value its condition tested.
const DETECTED = "div_x0531l50_x1r2vv8_x4q0id2_div_x1a4yqcp_xa73opb_xtlve1b";
const FRIEND_FIELDS = ["name", "mutualFriends"];
const FRIENDS_LEFT_OUT = [
  { name: "Tom Becker", mutualFriends: "2 mutual friends" },
  { name: "Jonas Weber", mutualFriends: "Aisha Khan and 4 other mutual friends" },
  { name: "Priya Nair", mutualFriends: null }
];

function friendsRead(): JsonObject {
  return {
    extracted: [{ name: "Amara Osei", mutualFriends: "12 mutual friends" }],
    extraction: {
      recordCount: 1, pagesRead: 1, itemsSeen: 4, truncated: false, fieldNames: FRIEND_FIELDS, missingFields: [],
      conditions: { applied: 4, kept: 1, rejected: [3], unfiltered: false, alone: [3] },
      rejectedSamples: [FRIENDS_LEFT_OUT], rejectedSamplesAlone: [3]
    }
  };
}

test("a left-out row carries the value its condition tested, from the column the page ran the condition on", () => {
  const written = [{ field: DETECTED, matches: "(?:[5-9]|[1-9][0-9]+) mutual friend" }];
  const ran = [{ field: "mutualFriends", matches: "(?:[5-9]|[1-9][0-9]+) mutual friend" }];
  const rows = webNodeReplayReadRows(friendsRead(), written, ran) as JsonObject;
  assert.deepEqual(rows.leftOutOnlyByThis, [{
    condition: DETECTED,
    rows: [
      { name: "Tom Becker", mutualFriends: "2 mutual friends" },
      { name: "Jonas Weber", mutualFriends: "Aisha Khan and 4 other mutual friends" },
      // A row with no value there says so: empty, not left without one.
      { name: "Priya Nair", mutualFriends: "" }
    ]
  }]);
  // The rows the read returned are labels only.
  assert.deepEqual(rows.rows, [{ name: "Amara Osei" }]);
});

test("a left-out row says no tested value where the condition tested its label, read a value of its own, or the call gave no ran conditions", () => {
  const leftOut = (ran: unknown) => ((webNodeReplayReadRows(friendsRead(), [{ field: DETECTED, matches: "x" }], ran) as JsonObject).leftOutOnlyByThis as JsonObject[])[0]!.rows;
  const labels = [{ name: "Tom Becker" }, { name: "Jonas Weber" }, { name: "Priya Nair" }];
  assert.deepEqual(leftOut([{ field: "name", contains: "x" }]), labels);
  assert.deepEqual(leftOut([{ read: { kind: "attribute", attribute: "data-x" }, is: "absent" }]), labels);
  assert.deepEqual(leftOut(undefined), labels);
  // Not one entry per condition: nothing lines up, so nothing is guessed.
  assert.deepEqual(leftOut([{ field: "mutualFriends", matches: "x" }, { field: "name", is: "present" }]), labels);
  // A column the read does not keep is not in the row.
  assert.deepEqual(leftOut([{ field: "seller", matches: "x" }]), labels);
});

test("a tested value shaped like a secret is written withheld, as a label is", () => {
  const payload = friendsRead();
  ((payload.extraction as JsonObject).rejectedSamples as JsonObject[][])[0]![0] = { name: "Tom Becker", mutualFriends: "token sk-live-4f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c" };
  const rows = webNodeReplayReadRows(payload, [{ field: DETECTED, matches: "x" }], [{ field: "mutualFriends", matches: "x" }]) as JsonObject;
  assert.deepEqual((rows.leftOutOnlyByThis as JsonObject[])[0]!.rows, [
    { name: "Tom Becker", mutualFriends: WEB_LLM_WITHHELD_TEXT },
    { name: "Jonas Weber", mutualFriends: "Aisha Khan and 4 other mutual friends" },
    { name: "Priya Nair", mutualFriends: "" }
  ]);
});

// A replayed read that names rows a condition removed by itself says how to read
// them, as an explored read does (t194 w68, live run `run-murwcmx2-a1c6edf7`
// C-E). Step 0044 of that run: `core.run_flow` replayed the list read, and its
// `readRows.leftOutOnlyByThis` came back to the explorer with no sentence, where
// the same alone rows through `core.run_node` carry `rejectedRowsNote`
// (1002-L C1). Every row is still named: the note adds a sentence and removes
// nothing (user rule: no caps).
const NOTE_PARAMETERS: JsonObject = { extractList: { item: ".card", fields: fieldMap(), where: WHERE } };

test("a replayed read whose conditions removed rows by themselves carries the note on reading them, and every row", async () => {
  const kept = Array.from({ length: 30 }, (_, index) => row(`Earbuds ${index}`, "$20.00"));
  const alone = Array.from({ length: 25 }, (_, index) => row(`Earbuds with Charging Case ${index}`, "$20.00"));
  const readRows = await replayedReadRows({
    extracted: kept,
    extraction: {
      recordCount: kept.length, pagesRead: 1, itemsSeen: 60, truncated: false, fieldNames: FIELDS, missingFields: [],
      conditions: { applied: 60, kept: kept.length, rejected: [0, 30], unfiltered: false, alone: [0, 25] },
      rejectedSamples: [[], [...alone, row("Ear tips", "$99.00")]],
      rejectedSamplesAlone: [0, 25]
    }
  });
  assert.equal(readRows.note, WEB_NODE_REPLAY_READ_ROWS_NOTE);
  assert.ok(WEB_NODE_REPLAY_READ_ROWS_NOTE.includes(WEB_NODE_REJECTED_ROWS_CHECK), "the same check an explored read's note asks for");
  assert.equal((readRows.rows as JsonObject[]).length, 30, "no kept row is cut");
  const leftOut = readRows.leftOutOnlyByThis as JsonObject[];
  assert.equal(leftOut.length, 1);
  assert.equal((leftOut[0]!.rows as JsonObject[]).length, 25, "no alone row is cut");
});

test("a replayed read whose conditions kept none says its rows are rows they rejected", async () => {
  const rejected = [row("Earbuds A", "$20.00"), row("Earbuds B", "$20.00")];
  const readRows = await replayedReadRows({
    extracted: rejected,
    extraction: {
      recordCount: 2, pagesRead: 1, itemsSeen: 2, truncated: false, fieldNames: FIELDS, missingFields: [],
      conditions: { applied: 2, kept: 0, rejected: [2, 0], unfiltered: true }
    }
  });
  assert.match(String(readRows.note), /kept no row/u);
  assert.equal((readRows.rows as JsonObject[]).length, 2);
});

test("a replayed read whose conditions removed nothing by themselves and kept rows carries no note", async () => {
  const readRows = await replayedReadRows({
    extracted: [row("Earbuds A", "$20.00")],
    extraction: {
      recordCount: 1, pagesRead: 1, itemsSeen: 3, truncated: false, fieldNames: FIELDS, missingFields: [],
      conditions: { applied: 3, kept: 1, rejected: [1, 1], unfiltered: false, alone: [0, 0] },
      rejectedSamples: [[row("X", "$90.00")], [row("X", "$90.00")]],
      rejectedSamplesAlone: [0, 0]
    }
  });
  assert.equal(readRows.note, undefined);
  assert.deepEqual(readRows, { rows: [{ name: "Earbuds A" }] });
});

/** Replay the read as `core.run_flow`'s dry run does, against a page that answers with `payload`; its `readRows`. */
async function replayedReadRows(payload: JsonObject): Promise<JsonObject> {
  const { result } = await replaySent(payload, NOTE_PARAMETERS);
  assert.equal(result.resultCode, "core.replay.replayed");
  return (result.evidence as JsonObject).readRows as JsonObject;
}

// Live run `run-muwao5n4-44977b2a` (lane D, cause D2-2): an amend decision
// dropped both navigations to the requests page, so the test ran the request
// listing on the home feed. Its list never appeared there and the replay
// answered `failed` ("rerun it with a corrected argument"), where the steps
// before it, not its argument, were the fault. A list that never appeared on a
// page other than the one the read read is answered as a missing control is:
// `unreproducible`. On its own page it still fails.
const FEED = "https://example.test/";
const REQUESTS = "https://example.test/friends/requests/";

test("a list read whose list never appeared, on a page other than the one it read, is unreproducible; on its own page it fails", async () => {
  const elsewhere = await replayNeverAppeared(FEED, { location: REQUESTS });
  assert.equal(elsewhere.resultCode, "core.replay.unreproducible");
  assert.equal((elsewhere.evidence as JsonObject).ok, false);
  assert.equal(elsewhere.resultReason, "list_never_appeared");
  assert.match(String((elsewhere.evidence as JsonObject).said), /not the page it read/u);

  const ownPage = await replayNeverAppeared(REQUESTS, { location: REQUESTS });
  assert.equal(ownPage.resultCode, "core.replay.failed");
  assert.equal(ownPage.resultReason, "list_never_appeared");

  // Where the read found the page unknown: nothing says it is elsewhere, so it fails as before.
  const unknown = await replayNeverAppeared(FEED, undefined);
  assert.equal(unknown.resultCode, "core.replay.failed");
});

/** Replay the read once on a page standing at `at`, where its list never appears. */
async function replayNeverAppeared(at: string, from: JsonObject | undefined) {
  const snapshot = page();
  snapshot.url = at;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot } };
      return {
        status: "failed",
        failure: { code: "web.validation.output_not_observed" },
        error: "no list",
        payload: { extraction: { recordCount: 0, pagesRead: 1, itemsSeen: 0, truncated: false, fieldNames: ["name"], missingFields: [], listPresence: "never_appeared" } }
      };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const value: JsonObject = { replay: "step", node: EXTRACT, parameters: READ, consequences: [], produced: { records: 8, itemsSeen: 8 } };
  if (from) value.from = from;
  return await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.3", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
}

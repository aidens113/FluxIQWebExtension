// t655: a replayed read names the rows two or more of its conditions left out
// together, each once with every condition that left it out, so its labels can
// name every row it saw (A8 frozen pair 5 `run-mva6mlm4-97fe42f9`: seen 23,
// kept 9, 12 left out alone, two named nowhere). A library catalogue.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webNodeReplayReadRows } from "../../replay-answer";
import { WEB_LLM_WITHHELD_TEXT } from "../../../withheld";

const FIELDS = ["title", "format", "price"];
const WHERE = [
  { field: "format", equals: "Hardcover" },
  { field: "price", lessThan: 30 }
];

function book(title: string, format: string, price: string): Record<string, string> {
  return { title, format, price };
}

function read(samples: Array<Array<Record<string, string>>>, leads: number[] | undefined): JsonObject {
  const payload = readWithout(samples);
  // A page that did not order its lists says no leads.
  if (leads) (payload.extraction as JsonObject).rejectedSamplesAlone = leads;
  return payload;
}

function readWithout(samples: Array<Array<Record<string, string>>>): JsonObject {
  return {
    extracted: [book("A Field Guide to Ferns", "Hardcover", "$24.00")],
    extraction: {
      recordCount: 1,
      pagesRead: 1,
      itemsSeen: 5,
      truncated: false,
      fieldNames: FIELDS,
      missingFields: [],
      conditions: { applied: 5, kept: 1, rejected: [3, 3], unfiltered: false, alone: [1, 1] },
      rejectedSamples: samples
    }
  };
}

const PAPERBACK_CHEAP = book("Notes on Bookbinding", "Paperback", "$12.00");
const HARDCOVER_DEAR = book("The Atlas of Old Maps", "Hardcover", "$65.00");
const BOTH = book("Collected Garden Essays", "Paperback", "$48.00");
const BOTH_TOO = book("A History of Clocks", "Audiobook", "$55.00");

test("a row left out by two conditions is listed once, with both conditions, and the rows left out alone stay where they were", () => {
  const rows = webNodeReplayReadRows(read([[PAPERBACK_CHEAP, BOTH, BOTH_TOO], [HARDCOVER_DEAR, BOTH, BOTH_TOO]], [1, 1]), WHERE, WHERE) as JsonObject;
  assert.deepEqual(rows.leftOutTogether, [
    { conditions: ["format", "price"], conditionIndexes: [0, 1], rows: [{ title: "Collected Garden Essays" }, { title: "A History of Clocks" }] }
  ]);
  const alone = rows.leftOutOnlyByThis as JsonObject[];
  assert.deepEqual(alone.map((entry) => entry.rows), [
    [{ title: "Notes on Bookbinding", format: "Paperback" }],
    [{ title: "The Atlas of Old Maps", price: "$65.00" }]
  ]);
  // Kept 1, alone 1 + 1, together 2: every one of the 5 rows seen is named.
  const named = (rows.rows as JsonObject[]).length + alone.reduce((total, entry) => total + (entry.rows as JsonObject[]).length, 0)
    + (rows.leftOutTogether as JsonObject[]).reduce((total, entry) => total + (entry.rows as JsonObject[]).length, 0);
  assert.equal(named, 5);
});

test("a row left out together is withheld as an alone row is", () => {
  const secret = book("Gift card 4111 1111 1111 1111", "Paperback", "$50.00");
  const rows = webNodeReplayReadRows(read([[PAPERBACK_CHEAP, secret], [HARDCOVER_DEAR, secret]], [1, 1]), WHERE, WHERE) as JsonObject;
  assert.deepEqual((rows.leftOutTogether as JsonObject[])[0]!.rows, [{ title: `Gift card ${WEB_LLM_WITHHELD_TEXT}` }]);
});

test("a read asked only for each condition's alone rows, or whose page did not order its lists, names no row left out together", () => {
  const aloneOnly = webNodeReplayReadRows(read([[PAPERBACK_CHEAP], [HARDCOVER_DEAR]], [1, 1]), WHERE, WHERE) as JsonObject;
  assert.equal(aloneOnly.leftOutTogether, undefined);
  const unordered = webNodeReplayReadRows(read([[PAPERBACK_CHEAP, BOTH], [HARDCOVER_DEAR, BOTH]], undefined), WHERE, WHERE) as JsonObject | undefined;
  assert.equal(unordered?.leftOutTogether, undefined);
});

test("a row found under one condition's list past its lead alone is not said: its conditions would be a guess", () => {
  const rows = webNodeReplayReadRows(read([[PAPERBACK_CHEAP, BOTH], [HARDCOVER_DEAR]], [1, 1]), WHERE, WHERE) as JsonObject;
  assert.equal(rows.leftOutTogether, undefined);
});

const OFFER = { kind: "outside", said: "Request access", entity: "Archive Readers" };

test("client marks reach both alone and grouped replay rows in the same positions", () => {
  const payload = read([[PAPERBACK_CHEAP, BOTH, BOTH_TOO], [HARDCOVER_DEAR, BOTH, BOTH_TOO]], [1, 1]);
  (payload.extraction as JsonObject).rejectedMarks = [[[OFFER], [OFFER], null], [null, [OFFER], null]];
  const rows = webNodeReplayReadRows(payload, WHERE, WHERE) as JsonObject;
  const alone = rows.leftOutOnlyByThis as JsonObject[];
  assert.deepEqual(alone.map((entry) => entry.marks), [[[OFFER]], [null]]);
  assert.deepEqual((rows.leftOutTogether as JsonObject[])[0]!.marks, [[OFFER], null]);
});

test("replay marks are screened before either alone or grouped rows leave the domain", () => {
  const payload = read([[PAPERBACK_CHEAP, BOTH], [HARDCOVER_DEAR, BOTH]], [1, 1]);
  const privateOffer = { kind: "outside", said: "Request access", entity: "Gift card 4111 1111 1111 1111" };
  (payload.extraction as JsonObject).rejectedMarks = [[[privateOffer], [privateOffer]], [null, [privateOffer]]];
  const rows = webNodeReplayReadRows(payload, WHERE, WHERE) as JsonObject;
  const expected = [{ ...privateOffer, entity: `Gift card ${WEB_LLM_WITHHELD_TEXT}` }];
  assert.deepEqual((rows.leftOutOnlyByThis as JsonObject[])[0]!.marks, [expected]);
  assert.deepEqual((rows.leftOutTogether as JsonObject[])[0]!.marks, [expected]);
  assert.doesNotMatch(JSON.stringify(rows), /4111 1111/u);
});

test("identical cells with conflicting item marks do not acquire another copy's outside evidence", () => {
  const payload = read([[PAPERBACK_CHEAP, BOTH], [HARDCOVER_DEAR, BOTH]], [1, 1]);
  (payload.extraction as JsonObject).rejectedMarks = [[null, [OFFER]], [null, null]];
  const rows = webNodeReplayReadRows(payload, WHERE, WHERE) as JsonObject;
  assert.deepEqual((rows.leftOutTogether as JsonObject[])[0]!.marks, [null]);
});

test("malformed or misaligned marks cost only the marks, never the replay's rows", () => {
  const payload = read([[PAPERBACK_CHEAP, BOTH], [HARDCOVER_DEAR, BOTH]], [1, 1]);
  const baseline = webNodeReplayReadRows(payload, WHERE, WHERE);
  (payload.extraction as JsonObject).rejectedMarks = [[[OFFER]], [null, [OFFER]]];
  assert.deepEqual(webNodeReplayReadRows(payload, WHERE, WHERE), baseline);
});

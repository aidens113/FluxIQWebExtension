// Every rejected row said once, links written from `~` (`../rejected-rows.ts`,
// run 13, F40).
//
// Live run 13 (`run-muqbzu32-8691a65e`, cause 1): the read `rerun.13` ran five
// conditions over 94 earbuds; the page sampled 72 distinct rejected rows, 46 of
// which more than one condition rejected, and the model was shown 134 rows --
// a row failing three conditions three times, every link a full address. Its
// `rejectedRows` was 40,928 characters of a 45,195-character read, and the
// request grew by a read each decision until the build ran out of money.
//
// The fixture below has run 13's shape and counts exactly: per condition how
// many it rejected and removed alone, which rows each sampled, which rows more
// than one condition rejected, and row values of the same lengths (names of
// about 120 characters, product links of about 115, ad-redirect links of about
// 190). The text is synthetic.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webNodeReadWithRejectedRows } from "../rejected-rows";

const ORIGIN = "http://127.0.0.1:56906";
const STORE = `${ORIGIN}/scenarios/everything-store`;

/**
 * Run 13's rows by the conditions that rejected them: a one-condition set is
 * that condition's alone rows; `ad` rows link through the store's ad redirect.
 */
const MEMBERSHIP: ReadonlyArray<{ failed: number[]; count: number; ad?: true }> = [
  { failed: [0], count: 2, ad: true },
  { failed: [0, 3], count: 3, ad: true },
  { failed: [0, 1], count: 3, ad: true },
  { failed: [0, 1, 3], count: 2, ad: true },
  { failed: [0, 1, 4], count: 1, ad: true },
  { failed: [0, 2], count: 1, ad: true },
  { failed: [1], count: 6 },
  { failed: [1, 3], count: 7 },
  { failed: [1, 2, 3], count: 8 },
  { failed: [1, 3, 4], count: 1 },
  { failed: [1, 4], count: 2 },
  { failed: [1, 2], count: 2 },
  { failed: [1, 2, 3, 4], count: 1 },
  { failed: [2], count: 10 },
  { failed: [2, 3], count: 5 },
  { failed: [2, 4], count: 3 },
  { failed: [2, 3, 4], count: 2 },
  { failed: [3], count: 3 },
  { failed: [3, 4], count: 5 },
  { failed: [4], count: 5 }
];
/** `conditions.rejected` and `conditions.alone` as the page counted them on run 13. */
const REJECTED = [20, 37, 34, 40, 20];
const ALONE = [4, 6, 12, 3, 5];
const FIELDS = ["name", "price", "rating", "url"];

type Row = { name: string; price: string; rating: string; url: string };

function syntheticRow(index: number, ad: boolean): Row {
  const slug = `Brand${index}-Model-Wireless-Earbuds-Bluetooth-5-3-Headphones`;
  const name = `Brand${index} Model Wireless Earbuds, Bluetooth 5.3 Headphones with ${20 + index}H Playtime, IPX7 Waterproof, Touch Control, Black`.padEnd(120, ".");
  const product = `B0SYN${String(index).padStart(5, "0")}`;
  const url = ad
    ? `${STORE}/sspa/click?ie=UTF8&adId=sp-${product}&url=%2Fscenarios%2Feverything-store%2F${slug}%2Fdp%2F${product}`
    : `${STORE}/${slug}/dp/${product}`;
  return { name, price: `$${20 + (index % 60)}.99`, rating: `4.${index % 10}`, url };
}

/** Each condition's sampled list as the page sends it -- its alone rows, then the rest -- and every row with the conditions that rejected it. */
function run13(): { payload: JsonObject; rows: Array<{ row: Row; failed: number[] }> } {
  const rows: Array<{ row: Row; failed: number[] }> = [];
  for (const { failed, count, ad } of MEMBERSHIP) {
    for (let copy = 0; copy < count; copy += 1) rows.push({ row: syntheticRow(rows.length, ad === true), failed });
  }
  const alone = REJECTED.map((_unused, condition) => rows.filter((entry) => entry.failed.length === 1 && entry.failed[0] === condition).map((entry) => entry.row));
  const others = REJECTED.map((_unused, condition) => rows.filter((entry) => entry.failed.length > 1 && entry.failed.includes(condition)).map((entry) => entry.row));
  const payload: JsonObject = {
    url: `${STORE}/s?k=wireless+earbuds&page=5`,
    extracted: [],
    extraction: {
      recordCount: 10, pagesRead: 5, truncated: false, missingFields: [], fieldNames: FIELDS,
      conditions: { applied: 94, kept: 12, rejected: REJECTED, unfiltered: false, alone: ALONE },
      rejectedSamples: alone.map((lead, condition) => [...lead, ...(others[condition] ?? [])]),
      rejectedSamplesAlone: alone.map((lead) => lead.length)
    }
  };
  return { payload, rows };
}

/** What the model was shown until run 13: each condition with every row it rejected, split, in full. */
function shownUntilRun13(payload: JsonObject): JsonObject[] {
  const extraction = payload.extraction as { rejectedSamples: Row[][]; rejectedSamplesAlone: number[] };
  return extraction.rejectedSamples.map((sampled, condition) => ({
    where: condition, rejected: REJECTED[condition] ?? 0, alone: ALONE[condition] ?? 0,
    rowsAlone: sampled.slice(0, extraction.rejectedSamplesAlone[condition]),
    rowsWithOthers: sampled.slice(extraction.rejectedSamplesAlone[condition])
  }));
}

type Shown = {
  "~": string;
  fields: string[];
  conditions: Array<{ where: number; rejected: number; alone: number; rowsAlone?: string[][] }>;
  rowsWithOthers: Array<{ failed: number[]; rows: string[][] }>;
};

test("run 13's rejected rows are each said once, every count kept, in well under half the characters", () => {
  const { payload, rows } = run13();
  const shown = (webNodeReadWithRejectedRows(payload).read as { rejectedRows: Shown }).rejectedRows;
  const before = JSON.stringify(shownUntilRun13(payload)).length;
  const after = JSON.stringify(shown).length;
  // 134 rows said until run 13, 72 distinct.
  assert.equal(shownUntilRun13(payload).reduce((total, entry) => total + (entry.rowsAlone as unknown[]).length + (entry.rowsWithOthers as unknown[]).length, 0), 134);
  assert.ok(after * 2 < before, `${after} characters against ${before} until run 13`);
  // Every count, every condition.
  assert.deepEqual(shown.conditions.map(({ where, rejected, alone }) => ({ where, rejected, alone })), REJECTED.map((rejected, where) => ({ where, rejected, alone: ALONE[where] })));
  // Every row exactly once: the alone rows under their condition, the rest in one list with the conditions they failed.
  const said = [
    ...shown.conditions.flatMap((entry) => (entry.rowsAlone ?? []).map((values) => ({ values, failed: [entry.where] }))),
    ...shown.rowsWithOthers.flatMap((group) => group.rows.map((values) => ({ values, failed: group.failed })))
  ];
  assert.equal(said.length, rows.length);
  assert.equal(shown.rowsWithOthers.reduce((total, group) => total + group.rows.length, 0), 46);
  assert.deepEqual(shown.fields, FIELDS);
  for (const { row, failed } of rows) {
    const matching = said.filter(({ values }) => values[0] === row.name);
    assert.equal(matching.length, 1, row.name);
    assert.deepEqual(matching[0]?.failed, failed, row.name);
    // The other values whole; the link read back from `~` is the exact address.
    const [, price, rating, written] = matching[0]?.values ?? [];
    assert.deepEqual([price, rating], [row.price, row.rating]);
    assert.ok(written?.startsWith("~/"), written);
    assert.equal(`${shown["~"]}${written?.slice(1)}`, row.url);
  }
});

test("`~` is what the page view would choose: the store's own directory, and links on another origin stay whole", () => {
  const { payload } = run13();
  const elsewhere = structuredClone(payload) as { extraction: { rejectedSamples: Row[][] } };
  const first = elsewhere.extraction.rejectedSamples[0]?.[0];
  assert.ok(first);
  first.url = "https://cdn.example.net/earbuds/B0SYN00000";
  const shown = (webNodeReadWithRejectedRows(elsewhere as unknown as JsonObject).read as { rejectedRows: Shown }).rejectedRows;
  assert.equal(shown["~"], STORE);
  assert.equal(shown.conditions[0]?.rowsAlone?.[0]?.[3], "https://cdn.example.net/earbuds/B0SYN00000");
  // A read with no address of its own writes every link whole and declares no `~`.
  const nowhere = structuredClone(payload) as JsonObject;
  delete nowhere.url;
  const whole = (webNodeReadWithRejectedRows(nowhere).read as { rejectedRows: Partial<Shown> }).rejectedRows;
  assert.equal(whole["~"], undefined);
  assert.ok(whole.conditions?.[0]?.rowsAlone?.[0]?.[3]?.startsWith(STORE));
});

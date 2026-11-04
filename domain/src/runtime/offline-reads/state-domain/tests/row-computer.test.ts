// The row computer: a changed filter on columns already read, computed from recorded rows
// through the one condition function, and every read that would need the page left a gap.

import assert from "node:assert/strict";
import test from "node:test";
import { readClientGatewayTraceOperation, type ClientGatewayTraceStateRecordedRead } from "fluxiq/client-gateway";
import { sanitizeWebLlmSnapshotWithBindings } from "../../../llm-evidence";
import { webTraceStateCanonicalKey, webTraceStateComputeRead, webTraceStateReadAnswer, webTraceStateRecordedAnswerFits, webTraceStateUnansweredCall } from "../index";

const FIELDS = { name: ".name", price: ".price" };
const ROWS = [{ name: "Red lamp", price: "$5" }, { name: "Blue lamp", price: "$12" }, { name: "Blue desk", price: "$90" }];

const list = (extractList: Record<string, unknown>, extra: Record<string, unknown> = {}) => readClientGatewayTraceOperation({ actionType: "web.dom.extract_list", parameters: { extractList: { item: ".row", fields: FIELDS, ...extractList }, ...extra } });

function answered(rows: readonly unknown[], extraction: Record<string, unknown> = {}) {
  return { status: "succeeded", payload: { url: "https://shop.example/a", extracted: rows, extraction: { recordCount: rows.length, pagesRead: 1, itemsSeen: rows.length, truncated: false, missingFields: [], fieldNames: ["name", "price"], ...extraction }, finishedAt: 1_000 } };
}

const recorded = (operation = list({}), answer: ClientGatewayTraceStateRecordedRead["answer"] = answered(ROWS), entry = 4): ClientGatewayTraceStateRecordedRead => ({ entry, operation, answer });
const rowsOf = (computed: ReturnType<typeof webTraceStateComputeRead>) => (computed?.answer.payload as { extracted: readonly unknown[] }).extracted;

test("computes a changed filter on a column already read, from the same read with none", () => {
  const computed = webTraceStateComputeRead(list({ where: [{ field: "name", contains: "lamp" }, { field: "price", lessThan: 10 }] }), [recorded()]);
  assert.deepEqual(rowsOf(computed), [ROWS[0]]);
  assert.equal(computed?.from, 4);
  assert.deepEqual(computed?.rows, webTraceStateReadAnswer(computed!.answer).rows);
  const summary = (computed?.answer.payload as { extraction: Record<string, unknown> }).extraction;
  assert.equal(summary.recordCount, 1);
  assert.deepEqual(summary.conditions, { applied: 3, kept: 1, rejected: [1, 2], unfiltered: false, alone: [0, 1] });
});

test("answers the same rows the page's own condition function would keep, with a negation", () => {
  assert.deepEqual(rowsOf(webTraceStateComputeRead(list({ where: [{ field: "name", contains: "desk", not: true }] }), [recorded()])), [ROWS[0], ROWS[1]]);
});

test("leaves a filter that reads its own value as a gap: it needs the page", () => {
  assert.equal(webTraceStateComputeRead(list({ where: [{ read: ".badge", is: "present" }] }), [recorded()]), null);
});

test("leaves another column, item or parameter as a gap: it is another read of the page", () => {
  const where = [{ field: "name", contains: "lamp" }];
  assert.equal(webTraceStateComputeRead(list({ where, item: ".other" }), [recorded()]), null);
  assert.equal(webTraceStateComputeRead(list({ where, fields: { name: ".name" } }), [recorded()]), null);
  assert.equal(webTraceStateComputeRead(list({ where }, { browserFrameUrlPath: "/x" }), [recorded()]), null);
});

test("leaves a read that was cut short, paged or folded as a gap: it does not hold the page's rows", () => {
  const where = [{ field: "name", contains: "lamp" }];
  assert.equal(webTraceStateComputeRead(list({ where }), [recorded(list({}), answered(ROWS, { truncated: true }))]), null);
  assert.equal(webTraceStateComputeRead(list({ where }), [recorded(list({}), answered(ROWS, { pagesRead: 2 }))]), null);
  assert.equal(webTraceStateComputeRead(list({ where }), [recorded(list({}), answered(ROWS, { order: { duplicates: 1 } }))]), null);
  assert.equal(webTraceStateComputeRead(list({ where }), [recorded(list({}), { status: "failed", payload: {} })]), null);
});

test("from a filtered read with only its kept rows, computes only what narrows them", () => {
  const blue = [{ field: "name", contains: "Blue" }];
  const source = recorded(list({ where: blue }), answered([ROWS[1], ROWS[2]], { conditions: { applied: 3, kept: 2, rejected: [1], unfiltered: false } }));
  assert.deepEqual(rowsOf(webTraceStateComputeRead(list({ where: [...blue, { field: "price", lessThan: 20 }] }), [source])), [ROWS[1]]);
  assert.equal(webTraceStateComputeRead(list({ where: [{ field: "name", contains: "Red" }] }), [source]), null, "its rejected rows were not recorded");
});

test("from an exploring read that kept every rejected row, computes any filter on its columns", () => {
  const blue = [{ field: "name", contains: "Blue" }];
  const source = recorded(list({ where: blue }, { rejectedSamples: true }), answered([ROWS[1], ROWS[2]], { conditions: { applied: 3, kept: 2, rejected: [1], unfiltered: false }, rejectedSamples: [[ROWS[0]]], rejectedSamplesAlone: [1] }));
  assert.deepEqual(rowsOf(webTraceStateComputeRead(list({ where: [{ field: "name", contains: "Red" }] }), [source])), [ROWS[0]]);
});

test("reads a Flow's own run the same way: its rejected rows are all there", () => {
  const blue = [{ field: "name", contains: "Blue" }];
  const source = recorded(list({ where: blue, answer: "kept" }, { rejectedSamples: "alone" }), answered([ROWS[1], ROWS[2]], { conditions: { applied: 3, kept: 2, rejected: [1], unfiltered: false }, rejectedSamples: [[ROWS[0]]], rejectedSamplesAlone: [1] }));
  assert.deepEqual(rowsOf(webTraceStateComputeRead(list({ where: [{ field: "name", contains: "Red" }], answer: "kept" }, { rejectedSamples: "alone" }), [source])), [ROWS[0]]);
});

test("does not trust rejected rows the counts say are not all there", () => {
  const blue = [{ field: "name", contains: "Blue" }];
  const short = recorded(list({ where: blue }, { rejectedSamples: true }), answered([ROWS[1], ROWS[2]], { conditions: { applied: 9, kept: 2, rejected: [7], unfiltered: false }, rejectedSamples: [[ROWS[0]]] }));
  assert.equal(webTraceStateComputeRead(list({ where: [{ field: "name", contains: "Red" }] }), [short]), null);
});

test("reads an exploration's answer of rejected rows as rejected, so a kept read is told none of them", () => {
  const red = [{ field: "name", contains: "Green" }];
  const unfiltered = answered(ROWS, { conditions: { applied: 3, kept: 0, rejected: [3], unfiltered: true }, rejectedSamples: [ROWS], rejectedSamplesAlone: [3] });
  const read = list({ where: red, answer: "kept" }, { rejectedSamples: "alone" });
  assert.equal(webTraceStateRecordedAnswerFits(read, unfiltered), false);
  assert.equal(webTraceStateRecordedAnswerFits(list({ where: red }), unfiltered), true);
  assert.deepEqual(webTraceStateReadAnswer(unfiltered).rows, []);
  assert.deepEqual(rowsOf(webTraceStateComputeRead(read, [recorded(list({ where: red }, { rejectedSamples: true }), unfiltered)])), []);
});

test("judges a date on the recording's own clock, and refuses a read that asks about another time", () => {
  const dated = [{ name: "New", when: "2026-11-02" }, { name: "Old", when: "2026-01-02" }];
  const fields = { name: ".name", when: ".when" };
  const read = (now?: number) => readClientGatewayTraceOperation({ actionType: "web.dom.extract_list", parameters: { extractList: { item: ".row", fields, where: [{ field: "when", within: "7 days" }], ...(now === undefined ? {} : { now }) } } });
  const source = (finishedAt: number): ClientGatewayTraceStateRecordedRead => {
    const recorded = answered(dated);
    return { entry: 1, operation: readClientGatewayTraceOperation({ actionType: "web.dom.extract_list", parameters: { extractList: { item: ".row", fields } } }), answer: { ...recorded, payload: { ...recorded.payload, finishedAt } } };
  };
  assert.deepEqual(rowsOf(webTraceStateComputeRead(read(), [source(Date.UTC(2026, 10, 3))])), [dated[0]]);
  assert.deepEqual(rowsOf(webTraceStateComputeRead(read(), [source(Date.UTC(2026, 0, 3))])), [dated[1]]);
  assert.equal(webTraceStateComputeRead(read(Date.UTC(2026, 10, 3)), [source(Date.UTC(2026, 10, 3))]), null);
});

test("tells a read or a move it cannot answer that nothing was there, and an act nothing", () => {
  const answer = (actionType: string, parameters: Record<string, unknown> = {}) => webTraceStateUnansweredCall(readClientGatewayTraceOperation({ actionType, parameters }));
  assert.deepEqual(webTraceStateReadAnswer(answer("web.dom.extract_list", { extractList: { item: ".row", fields: FIELDS } })).rows, []);
  assert.equal((answer("web.dom.next_page")?.payload as { route?: string }).route, "ended");
  assert.equal((answer("web.browser.navigate", { url: "https://shop.example/a" })?.payload as { url?: string }).url, "https://shop.example/a");
  const look = answer("web.dom.capture_snapshot");
  assert.equal(webTraceStateReadAnswer(look).outcome, "succeeded");
  // A look the rest of the run can read as a page with nothing on it: Core's state capture needs one on both sides of a step.
  const snapshot = (look?.payload as { snapshot: Record<string, unknown> }).snapshot;
  assert.deepEqual(sanitizeWebLlmSnapshotWithBindings(snapshot).evidence.elements, []);
});

test("the asks a Flow's read adds change nothing in its key, except a now with a date to judge", () => {
  const plain = list({ where: [{ field: "name", contains: "lamp" }] });
  const flow = list({ where: [{ field: "name", contains: "lamp" }], answer: "kept", now: 5 }, { rejectedSamples: "alone", recordOutput: { datasetId: "items" } });
  assert.equal(webTraceStateCanonicalKey(flow), webTraceStateCanonicalKey(plain));
  const dated = (now?: number) => list({ where: [{ field: "name", within: "7 days" }], ...(now === undefined ? {} : { now }) });
  assert.notEqual(webTraceStateCanonicalKey(dated(5)), webTraceStateCanonicalKey(dated(6)));
  assert.notEqual(webTraceStateCanonicalKey(list({ where: [{ field: "name", contains: "lamp" }] })), webTraceStateCanonicalKey(list({ where: [{ field: "name", contains: "desk" }] })));
});

test("is not asked of any other action", () => {
  assert.equal(webTraceStateComputeRead(readClientGatewayTraceOperation({ actionType: "web.dom.extract", parameters: {} }), [recorded()]), null);
});

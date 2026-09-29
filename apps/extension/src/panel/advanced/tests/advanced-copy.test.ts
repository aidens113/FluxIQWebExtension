// The Advanced view's words, as pure functions: relative times, the pager's
// label and buttons, recording rows, and the Current step rows (UI audit,
// section 4, "What moves to Advanced").

import assert from "node:assert/strict";
import test from "node:test";
import type { CoreRecordingSummary, RuntimeCommandStatus } from "../../../shared/protocol";
import { pageCount, recordingRowCopy, recordingsSourceLine, relativeTime, stepRows } from "..";

const NOW = 1_800_000_000_000;
const DATE = (at: number) => `date(${at})`;

test("relativeTime reads recent moments in seconds, minutes and hours, and older ones as a date", () => {
  assert.equal(relativeTime(NOW - 1_000, NOW), "just now");
  assert.equal(relativeTime(NOW + 3_000, NOW), "just now", "a clock slightly ahead is not the future");
  assert.equal(relativeTime(NOW - 12_000, NOW), "12s ago");
  assert.equal(relativeTime(NOW - 3 * 60_000, NOW), "3m ago");
  assert.equal(relativeTime(NOW - 2 * 3_600_000, NOW), "2h ago");
  assert.equal(relativeTime(NOW - 2 * 86_400_000, NOW, DATE), `date(${NOW - 2 * 86_400_000})`);
});

test("pageCount says 'Page n of m' when the total is known", () => {
  assert.deepEqual(pageCount({ page: 1, pageSize: 25, shown: 25, total: 60 }), { label: "Page 1 of 3", hasPrevious: false, hasNext: true });
  assert.deepEqual(pageCount({ page: 3, pageSize: 25, shown: 10, total: 60 }), { label: "Page 3 of 3", hasPrevious: true, hasNext: false });
  assert.deepEqual(pageCount({ page: 1, pageSize: 25, shown: 0, total: 0 }), { label: "Page 1 of 1", hasPrevious: false, hasNext: false });
});

test("pageCount keeps Next while pages come back full when Core gives no total", () => {
  assert.deepEqual(pageCount({ page: 2, pageSize: 10, shown: 10 }), { label: "Page 2", hasPrevious: true, hasNext: true });
  assert.deepEqual(pageCount({ page: 2, pageSize: 10, shown: 4 }), { label: "Page 2", hasPrevious: true, hasNext: false });
});

function recording(extra: Partial<CoreRecordingSummary>): CoreRecordingSummary {
  return { id: "rec_0123456789", title: "Checkout", ...extra };
}

test("recordingRowCopy writes 'n steps · date' and puts the status in words", () => {
  assert.deepEqual(recordingRowCopy(recording({ eventCount: 7, endedAt: 5, status: "saved" }), DATE), { title: "Checkout", pill: "Saved", line: "7 steps · date(5)" });
  assert.deepEqual(recordingRowCopy(recording({ eventCount: 1, startedAt: 9, status: "recording" }), DATE), { title: "Checkout", pill: "Recording", line: "1 step · date(9)" });
  assert.equal(recordingRowCopy(recording({ status: "needs_review" }), DATE).pill, "Needs review");
  assert.equal(recordingRowCopy(recording({}), DATE).pill, "Saved", "no status reads as saved");
});

test("recordingRowCopy never falls back to the raw id or 'events unknown'", () => {
  const copy = recordingRowCopy(recording({ title: "  " }), DATE);
  assert.deepEqual(copy, { title: "Untitled recording", pill: "Saved" });
  assert.equal(JSON.stringify(copy).includes("rec_0123456789"), false);
});

test("recordingsSourceLine names the host the list came from", () => {
  assert.equal(recordingsSourceLine("http://127.0.0.1:3000/api/programs/x"), "From 127.0.0.1:3000");
  assert.equal(recordingsSourceLine(undefined), undefined);
  assert.equal(recordingsSourceLine("not an address"), undefined);
});

function runtime(extra: Partial<RuntimeCommandStatus>): RuntimeCommandStatus {
  return { state: "running", actionType: "web.dom.click", ...extra };
}

test("stepRows is empty before anything has run", () => {
  assert.equal(stepRows(undefined, NOW), undefined);
  assert.equal(stepRows({ state: "idle" }, NOW), undefined);
});

test("stepRows shows a running step with its selector, tab and start time", () => {
  const rows = stepRows(runtime({ targetName: "Search", target: "#search > button", tabId: 12, url: "https://shop.example.com/a", startedAt: NOW - 3_000 }), NOW);
  assert.deepEqual(rows, [
    { label: "Step", value: "Clicking \"Search\"" },
    { label: "Page element", value: "#search > button" },
    { label: "Browser tab", value: "Tab 12 · shop.example.com" },
    { label: "Outcome", value: "Still running" },
    { label: "Started", value: "just now" }
  ]);
});

test("stepRows gives a finished step in the past tense and keeps the raw failure", () => {
  const failed = stepRows(runtime({ state: "failed", actionType: "web.dom.type", error: "Element not found: #email", startedAt: NOW - 120_000 }), NOW)!;
  assert.equal(failed[0]!.value, "Typed into a field");
  assert.equal(failed[1]!.value, "None");
  assert.equal(failed[2]!.value, "None");
  assert.equal(failed[3]!.value, "Didn't work: Element not found: #email");
  assert.equal(failed[4]!.value, "2m ago");
  const done = stepRows(runtime({ state: "succeeded", message: "5 rows", startedAt: NOW }), NOW)!;
  assert.equal(done[3]!.value, "Done: 5 rows");
  assert.equal(stepRows(runtime({ state: "succeeded" }), NOW)![3]!.value, "Done");
});

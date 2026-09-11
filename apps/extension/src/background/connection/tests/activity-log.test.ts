// T1 coverage of activity-log.ts: the panel's recent-activity list and the
// paged recording log.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ActivityLog } from "../activity-log";

function filled(count: number): ActivityLog {
  const log = new ActivityLog();
  for (let index = 0; index < count; index += 1) log.record("event", `Event ${index}`);
  return log;
}

test("entries are kept newest first, and an entry without a detail has none", (t) => {
  t.mock.method(Date, "now", () => 42_000);
  const log = new ActivityLog();
  assert.equal(log.lastActivityAt(), undefined);
  log.record("recording", "Recording started");
  log.record("dom.click", "Click", "#submit", "success");

  const [latest, earliest, ...rest] = log.recentEntries();
  assert.equal(rest.length, 0);
  assert.ok(latest && earliest);
  assert.equal(latest.kind, "dom.click");
  assert.equal(latest.label, "Click");
  assert.equal(latest.detail, "#submit");
  assert.equal(latest.tone, "success");
  assert.equal(latest.timestamp, 42_000);
  assert.match(latest.id, /^dom\.click\.42000\./);
  assert.equal(earliest.tone, "neutral");
  assert.equal("detail" in earliest, false);
  assert.equal(log.lastActivityAt(), 42_000);
});

test("recentEntries hands out a copy", () => {
  const log = filled(2);
  log.recentEntries().length = 0;
  assert.equal(log.recentEntries().length, 2);
});

test("the recent list keeps 20 entries and the recording log 500", () => {
  const log = filled(501);
  const recent = log.recentEntries();
  assert.equal(recent.length, 20);
  assert.equal(recent[0]?.label, "Event 500");
  assert.equal(recent[19]?.label, "Event 481");
  const lastPage = log.page(5, 100);
  assert.equal(lastPage.total, 500);
  assert.equal(lastPage.items.at(-1)?.label, "Event 1", "the oldest entry is dropped first");
});

test("paging clamps the page size to 5..100 and the page to at least 1", () => {
  const log = filled(12);
  const labels = (page: number, pageSize: number) => log.page(page, pageSize).items.map((entry) => entry.label);
  assert.deepEqual(labels(2, 5), ["Event 6", "Event 5", "Event 4", "Event 3", "Event 2"]);
  assert.deepEqual(labels(3, 5), ["Event 1", "Event 0"]);
  assert.deepEqual(labels(4, 5), []);

  const shape = (page: number, pageSize: number) => {
    const result = log.page(page, pageSize);
    return { page: result.page, pageSize: result.pageSize, total: result.total };
  };
  assert.deepEqual(shape(1, 1), { page: 1, pageSize: 5, total: 12 });
  assert.deepEqual(shape(1, 1_000), { page: 1, pageSize: 100, total: 12 });
  assert.deepEqual(shape(1, 0), { page: 1, pageSize: 25, total: 12 });
  assert.deepEqual(shape(1, Number.NaN), { page: 1, pageSize: 25, total: 12 });
  assert.deepEqual(shape(0, 10), { page: 1, pageSize: 10, total: 12 });
  assert.deepEqual(shape(-3, 10), { page: 1, pageSize: 10, total: 12 });
  assert.deepEqual(shape(2.7, 10), { page: 2, pageSize: 10, total: 12 });
});

test("clearRecent empties only the recent list; reset empties everything", () => {
  const log = filled(3);
  log.clearRecent();
  assert.equal(log.recentEntries().length, 0);
  assert.equal(log.page(1, 25).total, 3);
  assert.notEqual(log.lastActivityAt(), undefined);
  log.reset();
  assert.equal(log.page(1, 25).total, 0);
  assert.equal(log.lastActivityAt(), undefined);
});

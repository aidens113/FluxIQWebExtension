// The fold's one line: how long the work took by Core's own times, how many
// steps, how many failed, and "so far" while it is still going.

import assert from "node:assert/strict";
import test from "node:test";
import { activityEvent, eventTime } from "../../tests/activity-fixture";
import { buildChatStream } from "../stream-items";
import { buildChatThread } from "../thread-entries";
import { duration, workSummary } from "../work-summary";

function group(statuses: Array<"succeeded" | "failed" | "started">, spanSeconds: number) {
  const recent = statuses.map((status, index) => activityEvent(index + 1, {
    detail: { kind: "tool", title: `tool ${index}`, ref: `ref.${index}`, status },
    at: new Date(eventTime(0) + (index === statuses.length - 1 ? spanSeconds * 1000 : index)).toISOString()
  }));
  return buildChatThread(buildChatStream([], recent), true).live[0]!;
}

test("a finished group says how long it worked and how many steps", () => {
  assert.equal(workSummary(group(["succeeded", "succeeded"], 125), false), "Worked for 2m 5s · 2 steps");
  assert.equal(workSummary(group(["succeeded"], 0), false), "Worked for 1s · 1 step");
  assert.equal(workSummary(group(["succeeded", "failed", "failed"], 30), false), "Worked for 30s · 3 steps · 2 failed");
});

test("a group still under way counts its steps so far", () => {
  assert.equal(workSummary(group(["succeeded", "started"], 40), true), "2 steps so far");
});

test("durations read as a person says them, and unreadable spans are left out", () => {
  assert.equal(duration(400), "1s");
  assert.equal(duration(45_000), "45s");
  assert.equal(duration(120_000), "2m");
  assert.equal(duration(200_000), "3m 20s");
  assert.equal(duration(12 * 60_000 + 5_000), "12m");
  assert.equal(duration(64 * 60_000), "1h 4m");
  assert.equal(duration(Number.NaN), undefined);
  assert.equal(duration(Number.POSITIVE_INFINITY), undefined);
  assert.equal(duration(-5), undefined);
});

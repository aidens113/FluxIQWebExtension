// The fold's one line: how long the work took by Core's own times, how many
// steps when every step is known, no count when the start is gone, "so far"
// while it is still going, and "didn't finish" only when the work itself
// failed.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayActivity } from "../../../../shared/activity/index";
import { activityEvent, eventTime } from "../../tests/activity-fixture";
import { buildChatStream } from "../stream-items";
import { buildChatThread, type WorkFold } from "../thread-entries";
import { duration, workSummary } from "../work-summary";

type Status = "succeeded" | "failed" | "started";

function fold(statuses: Status[], spanSeconds: number, extra: ClientGatewayActivity[] = [], limit?: number): WorkFold {
  const recent = statuses.map((status, index) => activityEvent(index + 1, {
    phase: "exploring",
    detail: { kind: "tool", title: `Step ${index}`, ref: `ref.${index}`, status },
    at: new Date(eventTime(0) + (index === statuses.length - 1 ? spanSeconds * 1000 : index)).toISOString()
  }));
  return buildChatThread(buildChatStream([], [...recent, ...extra], limit), true).live!;
}

test("a finished fold says how long it worked and how many steps", () => {
  assert.equal(workSummary(fold(["succeeded", "succeeded"], 125), false), "Worked for 2m 5s · 2 steps");
  assert.equal(workSummary(fold(["succeeded"], 0), false), "Worked for 1s · 1 step");
});

test("steps that failed along the way are not a failure of the work; a failed build is", () => {
  assert.equal(workSummary(fold(["succeeded", "failed", "failed"], 30), false), "Worked for 30s · 3 steps");
  const failed = activityEvent(10, { phase: "failed", detail: { kind: "step", title: "Build failed", status: "failed" }, at: new Date(eventTime(40)).toISOString(), final: true });
  assert.equal(workSummary(fold(["succeeded", "succeeded"], 30, [failed]), false), "Worked for 40s · 2 steps · didn't finish", "the marker is listed, not counted");
});

test("with its first steps gone, a fold gives its time but no count", () => {
  assert.equal(workSummary(fold(["succeeded", "succeeded", "succeeded"], 180, [], 2), false), "Worked for 3m");
  assert.equal(workSummary(fold(["succeeded", "started"], 40, [], 1), true), "Show the work so far");
});

test("a fold still under way counts its steps so far", () => {
  assert.equal(workSummary(fold(["succeeded", "started"], 40), true), "2 steps so far");
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

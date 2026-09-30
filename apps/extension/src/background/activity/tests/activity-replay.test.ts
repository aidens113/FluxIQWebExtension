// The flicker, measured on a real build: t174's live run
// `run-munmmj5n-52d8a67d` (crossborder-marketplace), whose Core log holds 259
// `[FluxIQ build-trace]` lines. Each is mapped to the event Core's observer
// emits at that seam (`build-trace-events.ts`) and replayed at its real time
// through
//
//   (a) the t185 behaviour: every event drawn as it came -- the phase word as
//       the overlay's heading, Core's sentence under it; and
//   (b) the pacer and the relay: what the page is actually sent.
//
// It reports visible text changes per second (mean, the most in any one-second
// window, and the total) for the heading and the detail, and makes (b)'s bound
// a test.

import assert from "node:assert/strict";
import test from "node:test";

import { ACTIVITY_MESSAGES, type ActivityContentMessage } from "../../../shared/activity/index";
import { ACTIVITY_PHASE_APPEARANCE } from "../../../content/activity-overlay/index";
import { ActivityRelay } from "../activity-relay";
import { buildTraceEvents, type TimedActivity } from "./build-trace-events";
import { FakeClock } from "./fake-clock";
import { T174_BUILD_TRACE } from "./fixtures/t174-build-trace";

type Change = { at: number };
type Rate = { total: number; meanPerSecond: number; maxInAnySecond: number };

function rate(changes: readonly Change[], start: number, end: number): Rate {
  const times = changes.map((change) => change.at).sort((a, b) => a - b);
  let maxInAnySecond = 0;
  for (let first = 0, last = 0; last < times.length; last += 1) {
    while (times[last]! - times[first]! >= 1_000) first += 1;
    maxInAnySecond = Math.max(maxInAnySecond, last - first + 1);
  }
  const seconds = Math.max(1, (end - start) / 1_000);
  return { total: times.length, meanPerSecond: Math.round((times.length / seconds) * 100) / 100, maxInAnySecond };
}

/** Times at which `text` of successive renders differs from the one before. */
function changesOf<T>(renders: ReadonlyArray<{ at: number; value: T }>, text: (value: T) => string): Change[] {
  const changes: Change[] = [];
  let previous: string | undefined;
  for (const render of renders) {
    const now = text(render.value);
    if (now !== previous) changes.push({ at: render.at });
    previous = now;
  }
  return changes;
}

const events: TimedActivity[] = buildTraceEvents(T174_BUILD_TRACE);
const start = events[0]!.at;
const end = events.at(-1)!.at;

/** (a) t185: the overlay drew every event it was sent. */
function t185Renders() {
  return events.map(({ at, event }) => ({ at, value: event }));
}

/** (b) the relay with its pacer, on a clock that follows the log; what reached the page. */
async function pacedRenders() {
  const clock = new FakeClock(start);
  const renders: Array<{ at: number; value: ActivityContentMessage }> = [];
  const relay = new ActivityRelay({
    readOverlay: async () => undefined,
    writeOverlay: async () => undefined,
    broadcast: async () => undefined,
    automationTabId: async () => 7,
    deliverToTab: async (_tabId, message) => {
      renders.push({ at: clock.now(), value: message });
    },
    live: () => true,
    clock
  });
  // Timer by timer, letting each send finish before the clock moves on, so a
  // send is stamped with the moment the relay made it.
  const flush = async () => {
    for (let round = 0; round < 4; round += 1) await new Promise((resolve) => setImmediate(resolve));
  };
  const runUntil = async (time: number) => {
    for (let due = clock.nextDue(); due !== undefined && due <= time; due = clock.nextDue()) {
      clock.advanceTo(due);
      await flush();
    }
    clock.advanceTo(time);
    await flush();
  };
  for (const { at, event } of events) {
    await runUntil(at);
    await relay.accept(event);
    await flush();
  }
  await runUntil(end + 5_000);
  return renders;
}

test("the fixture is the whole t174 build: 259 trace lines, mapped at their real times", () => {
  assert.equal(T174_BUILD_TRACE.length, 259);
  assert.equal(events.length, 1 + 62 + 65 * 2 + 4 * 2 + 1, "loop start, 62 decisions, 65 tool calls started and ended, 4 checks started and ended, and the settle");
  assert.ok(end - start > 190_000, `about 200 s of build: ${end - start} ms`);
});

test("measurement: the t185 behaviour against the pacer, and the pacer's bound", async (t) => {
  const before = t185Renders();
  const beforeHeading = rate(changesOf(before, (event) => ACTIVITY_PHASE_APPEARANCE[event.phase].name), start, end);
  const beforeDetail = rate(changesOf(before, (event) => event.label), start, end);
  const beforeAny = rate(changesOf(before, (event) => `${event.phase}|${event.label}|${event.detail?.title ?? ""}`), start, end);

  const after = await pacedRenders();
  const afterHeadline = rate(changesOf(after, (message) => message.display?.headline ?? ""), start, end);
  const afterDetail = rate(changesOf(after, (message) => message.display?.detail ?? ""), start, end);
  const afterSends = rate(after.map((render) => ({ at: render.at })), start, end);

  t.diagnostic(`t185 heading (phase word): ${JSON.stringify(beforeHeading)}`);
  t.diagnostic(`t185 detail (Core sentence): ${JSON.stringify(beforeDetail)}`);
  t.diagnostic(`t185 any visible text: ${JSON.stringify(beforeAny)}`);
  t.diagnostic(`paced headline: ${JSON.stringify(afterHeadline)}`);
  t.diagnostic(`paced detail: ${JSON.stringify(afterDetail)}`);
  t.diagnostic(`paced page sends: ${JSON.stringify(afterSends)}`);

  // The bound. The headline changes only when the work does: once to show the
  // build, once when it settles.
  assert.equal(afterHeadline.total, 2);
  assert.deepEqual([...new Set(after.map((render) => render.value.display?.headline))], ["Building your Flow", "Flow ready"]);
  // The detail changes at most once per 1.2 s, so never twice in one second
  // except when a settling event, which is never held back, follows a change.
  assert.ok(afterDetail.maxInAnySecond <= 2, `detail changes in one second: ${afterDetail.maxInAnySecond}`);
  assert.ok(afterSends.maxInAnySecond <= 4, `page sends in one second: ${afterSends.maxInAnySecond}`);
  // Between two detail changes there are always 1.2 s, except before the
  // settling event, which is shown the moment it arrives.
  const detailTimes = changesOf(after, (message) => message.display?.detail ?? "").map((change) => change.at);
  const gaps = detailTimes.slice(1).map((at, index) => at - detailTimes[index]!);
  t.diagnostic(`paced detail: shortest gap ${Math.min(...gaps.slice(0, -1))} ms between working sentences; last gap (to the settle) ${gaps.at(-1)} ms`);
  assert.ok(gaps.slice(0, -1).every((gap) => gap >= 1_200), "no two working sentences closer than 1.2 s");
  assert.ok(afterDetail.total < beforeDetail.total, "fewer sentences reach the page than Core sent");
  // Nothing stale is left: the last thing on the page is the build's own end.
  assert.equal(after.at(-1)?.value.display?.detail, "Build finished: a Flow is proposed");
  assert.equal(after.at(-1)?.value.type, ACTIVITY_MESSAGES.content);
});

test("the bound, stated plainly: N events inside one second give at most one detail change and four page sends", async () => {
  for (const count of [2, 5, 20, 100]) {
    const clock = new FakeClock(0);
    const renders: ActivityContentMessage[] = [];
    const relay = new ActivityRelay({
      readOverlay: async () => undefined,
      writeOverlay: async () => undefined,
      broadcast: async () => undefined,
      automationTabId: async () => 7,
      deliverToTab: async (_tabId, message) => {
        renders.push(message);
      },
      live: () => true,
      clock
    });
    for (let index = 0; index < count; index += 1) {
      clock.advanceTo(Math.floor((index * 999) / count));
      await relay.accept({ activityId: "build:b", sequence: index + 1, subject: { kind: "build", id: "b", projectId: "p" }, phase: index % 2 ? "thinking" : "exploring", label: `Sentence ${index + 1}`, at: "2026-09-29T00:00:00.000Z" });
      await new Promise((resolve) => setImmediate(resolve));
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(renders.length <= 4, `${count} events: ${renders.length} page sends`);
    assert.equal(new Set(renders.map((message) => message.display?.detail)).size, 1, `${count} events: one sentence inside the second`);
  }
});

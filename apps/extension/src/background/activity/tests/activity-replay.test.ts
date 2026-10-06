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

import { ACTIVITY_MESSAGES, activityWording, type ActivityContentMessage } from "../../../shared/activity/index";
import { ACTIVITY_PHASE_APPEARANCE, activityOverlayView } from "../../../content/activity-overlay/index";
import { ActivityRelay } from "../activity-relay";
import { ACTIVITY_FAN_OUT_INTERVAL_MS } from "../fan-out-gate";
import { ACTIVITY_DETAIL_INTERVAL_MS } from "../pacer";
import { buildTraceEvents, type TimedActivity } from "./build-trace-events";
import { FakeClock } from "./fake-clock";
import { T174_BUILD_TRACE } from "./fixtures/t174-build-trace";

/** A dotted id such as `core.run_node` or `web.action.succeeded`: never in visible text. */
const RAW_ID = /\b[a-z]+\.[a-z_]+/u;

/** The status while a decision is being made, which a step starting replaces at once. */
const DECIDING: ReadonlySet<string> = new Set(["Deciding the next step", "Thinking about the next step"]);

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

/** The event of `sequence` in the trace. */
function eventOf(sequence: number | undefined) {
  return events.find(({ event }) => event.sequence === sequence)?.event;
}

/**
 * The display folded in up to `sequence` came from a step starting. A step
 * that ended well reads as it did when it started (D6), so a display sent a
 * moment later may carry the sequence of the row that ended the step: it is
 * walked back to the start.
 */
function startsStep(sequence: number | undefined): boolean {
  let index = events.findIndex(({ event }) => event.sequence === sequence);
  const title = events[index]?.event.detail?.title;
  const sameStep = (at: number) => events[at]?.event.detail?.kind === "tool" && events[at]!.event.detail!.title === title;
  while (index > 0 && events[index]!.event.detail?.status !== "started" && sameStep(index) && sameStep(index - 1)) index -= 1;
  const event = events[index]?.event;
  return event?.detail?.kind === "tool" && event.detail.status === "started";
}

/** The display of `sequence` came from Core's row opening a decision, whatever line it held. */
function fromDecision(sequence: number | undefined): boolean {
  const event = eventOf(sequence);
  return event?.detail?.kind === "thought" && event.detail.status === "started";
}

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
  // The detail changes at most once per interval, so never twice in one second
  // except when a settling event, or a step starting after "Deciding the next
  // step" (D7), neither of which is held back, follows a change.
  assert.ok(afterDetail.maxInAnySecond <= 2, `detail changes in one second: ${afterDetail.maxInAnySecond}`);
  assert.ok(afterSends.maxInAnySecond <= 4, `page sends in one second: ${afterSends.maxInAnySecond}`);
  // Between two detail changes there is always the interval, except before
  // the settling event and a step that ends a decision, each shown the moment
  // it arrives.
  // A decision holds the line before it (U9), so a step shown at once after
  // one is known as the pacer knows it -- a step starting while the display
  // up came from Core's row opening a decision -- not by the line it replaced.
  const details: Array<{ at: number; detail: string; afterDecision: boolean }> = [];
  let upFrom: number | undefined;
  for (const render of after) {
    const detail = render.value.display?.detail ?? "";
    const sequence = render.value.display?.sequence;
    if (details.at(-1)?.detail !== detail) details.push({ at: render.at, detail, afterDecision: startsStep(sequence) && fromDecision(upFrom) });
    upFrom = sequence;
  }
  const held = details.slice(1, -1).filter((change, index) => !DECIDING.has(details[index]!.detail) && !change.afterDecision);
  const gaps = held.map((change) => change.at - details[details.indexOf(change) - 1]!.at);
  t.diagnostic(`paced detail: shortest gap ${Math.min(...gaps)} ms between paced working sentences; ${details.length - 2 - held.length} steps shown at once after a decision`);
  // Measured at the page, so a send the page gate held back can shorten the gap after it by up to one gate interval.
  const floor = ACTIVITY_DETAIL_INTERVAL_MS - ACTIVITY_FAN_OUT_INTERVAL_MS;
  assert.ok(gaps.every((gap) => gap >= floor), `no two paced working sentences closer than ${floor} ms`);
  assert.ok(afterDetail.total < beforeDetail.total, "fewer sentences reach the page than Core sent");
  // Every word that reached the page, and every line the overlay drew from it, is a person's words.
  for (const { value } of after) {
    for (const text of [value.display?.headline ?? "", value.display?.detail ?? ""]) assert.doesNotMatch(text, RAW_ID, `display: "${text}"`);
    for (const preference of ["expanded", "collapsed"] as const) {
      const view = activityOverlayView(value.display, preference);
      for (const text of [view?.headline ?? "", view?.detail ?? "", view?.step ?? ""]) assert.doesNotMatch(text, RAW_ID, `overlay (${preference}): "${text}"`);
    }
  }
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

test("every event of the real build reads in a person's words, and the whole build in a few sentences", () => {
  const sentences = new Set<string>();
  for (const { event } of events) {
    const wording = activityWording(event);
    for (const text of [wording.action, wording.outcome ?? "", wording.sentence]) assert.doesNotMatch(text, RAW_ID, `${event.label}: "${text}"`);
    sentences.add(wording.sentence);
  }
  assert.deepEqual([...sentences].sort(), [
    "Build finished: a Flow is proposed",
    "Building the Flow",
    "Checking the Flow does what you asked",
    "Checking the Flow does what you asked — done",
    "Checking the Flow does what you asked — not yet, trying another way",
    "Looking at the page — done",
    "Looking for the list of items",
    "Looking for the list of items — done",
    "Deciding the next step",
    "Trying a step on the page",
    "Trying a step on the page — done",
    // Both of the build's rejected calls were declined unsent (R2-U-6): `not_at_start_location` says no more,
    // `target_unobserved` says what the step named (Core's words, t277).
    "Trying a step on the page — not tried",
    "Trying a step on the page — not tried: the step named something it hadn't seen on the page",
    "Trying the Flow out — done"
  ].sort());
});

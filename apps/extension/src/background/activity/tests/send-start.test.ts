// Coverage of the starting status (`send-start.ts`, `ActivityRelay.sending`).
// D14 of the run-musp4h2f-72e8ed99 UI review: at the first build moment the
// overlay was on the page in 9 of 16 samples, because between the person's
// send and Core's first activity there was nothing to draw. The overlay is on
// the page whenever FluxIQ is working: from the send, "Starting…", until
// Core's first activity replaces it, or the send fails, or Core answers
// without starting work.

import assert from "node:assert/strict";
import test from "node:test";

import { ACTIVITY_MESSAGES, type ActivityContentMessage, type ActivityOverlayPreference, type ClientGatewayActivity, type ExtensionActivityState } from "../../../shared/activity/index";
import { ActivityRelay } from "../activity-relay";
import { STARTING_HEADLINE, STARTING_HOLD_MS } from "../send-start";
import { FakeClock } from "./fake-clock";

async function settle(): Promise<void> {
  for (let round = 0; round < 10; round += 1) await new Promise((resolve) => setImmediate(resolve));
}

function harness(options: { live?: boolean; stored?: ActivityOverlayPreference } = {}) {
  const clock = new FakeClock(10_000);
  const pages: ActivityContentMessage[] = [];
  const panels: ExtensionActivityState[] = [];
  const relay = new ActivityRelay({
    readOverlay: async () => options.stored,
    writeOverlay: async () => {},
    broadcast: async (message) => {
      panels.push(message.state);
    },
    automationTabId: async () => 7,
    deliverToTab: async (_tabId, message) => {
      assert.equal(message.type, ACTIVITY_MESSAGES.content);
      pages.push(message);
    },
    live: () => options.live ?? true,
    clock
  });
  return { relay, clock, pages, panels, drawn: () => pages.at(-1)?.display ?? null };
}

function activity(sequence: number, overrides: Partial<ClientGatewayActivity> = {}): ClientGatewayActivity {
  return { activityId: "build:b1", sequence, subject: { kind: "build", id: "b1", projectId: "p" }, phase: "building", label: "Reading your request", at: "2026-10-03T00:00:00.000Z", ...overrides };
}

const started = { ok: true, payload: { turn: { turnId: "t1" }, response: { execution: { capabilityId: "build", status: "started", summary: "Building" } } } };
const wordsOnly = { ok: true, payload: { turn: { turnId: "t1" }, response: { execution: null } } };

/** A send the test answers when it chooses. */
function pendingSend() {
  let answer!: (value: unknown) => void;
  let fail!: (error: Error) => void;
  const promise = new Promise<unknown>((resolve, reject) => {
    answer = resolve;
    fail = reject;
  });
  return { send: () => promise, answer, fail };
}

test("a send puts the starting status on the page and in the panels at once, and Core's first activity replaces it", async () => {
  const h = harness();
  const send = pendingSend();
  const answered = h.relay.sending(send.send);
  await settle();
  assert.equal(h.drawn()?.headline, STARTING_HEADLINE, "on the page before Core has answered");
  assert.deepEqual([h.drawn()?.working, h.drawn()?.kind, h.drawn()?.detail], [true, "starting", null]);
  assert.equal(h.panels.at(-1)?.display?.headline, STARTING_HEADLINE, "the panels show the same status");
  send.answer(started);
  assert.deepEqual(await answered, started, "the answer is handed back as it came");
  h.clock.advance(700);
  await settle();
  assert.equal(h.drawn()?.headline, STARTING_HEADLINE, "held after Core said it started, until its first activity");
  await h.relay.accept(activity(1));
  h.clock.advance(300);
  await settle();
  assert.deepEqual([h.drawn()?.headline, h.drawn()?.detail, h.drawn()?.kind], ["Building your Flow", "Reading your request", "action"]);
  assert.equal(h.relay.state().display?.headline, "Building your Flow");
  h.clock.advance(STARTING_HOLD_MS * 2);
  await settle();
  assert.equal(h.drawn()?.headline, "Building your Flow", "nothing of the start is left to expire");
});

test("Core answering in words only, a failed send, and a send that throws each take the starting status down", async () => {
  for (const ending of ["words", "failed", "threw"] as const) {
    const h = harness();
    const send = pendingSend();
    const answered = h.relay.sending(send.send);
    await settle();
    assert.equal(h.drawn()?.headline, STARTING_HEADLINE, ending);
    if (ending === "words") send.answer(wordsOnly);
    if (ending === "failed") send.answer({ ok: false, code: "failed", error: "Core is down" });
    if (ending === "threw") send.fail(new Error("worker gone"));
    if (ending === "threw") await assert.rejects(answered, /worker gone/u);
    else await answered;
    h.clock.advance(300);
    await settle();
    assert.equal(h.drawn(), null, `${ending}: the overlay leaves the page`);
    assert.equal(h.relay.state().display, null, `${ending}: the panels no longer say FluxIQ is working`);
  }
});

test("a start Core never follows with activity is taken down after the hold, not left up for good", async () => {
  const h = harness();
  await h.relay.sending(async () => started);
  await settle();
  assert.equal(h.drawn()?.headline, STARTING_HEADLINE);
  h.clock.advance(STARTING_HOLD_MS - 1);
  await settle();
  assert.equal(h.drawn()?.headline, STARTING_HEADLINE);
  h.clock.advance(1);
  await settle();
  assert.equal(h.drawn(), null);
});

test("activity that arrives before Core's answer is kept: the answer takes nothing down", async () => {
  const h = harness();
  const send = pendingSend();
  const answered = h.relay.sending(send.send);
  await settle();
  await h.relay.accept(activity(1));
  send.answer(wordsOnly);
  await answered;
  h.clock.advance(300);
  await settle();
  assert.equal(h.drawn()?.headline, "Building your Flow");
});

test("work already running or waiting on the person keeps its own status; a settled one gives way to the start", async () => {
  const running = harness();
  await running.relay.accept(activity(1));
  await running.relay.sending(async () => wordsOnly);
  running.clock.advance(300);
  await settle();
  assert.equal(running.drawn()?.headline, "Building your Flow", "running: not replaced, and not taken down by the answer");

  const waiting = harness();
  await waiting.relay.accept(activity(1, { phase: "waiting_permission", label: "Waiting for your answer" }));
  await waiting.relay.sending(async () => started);
  waiting.clock.advance(300);
  await settle();
  assert.equal(waiting.drawn()?.outcome, "waiting", "the question stays in front of the person");

  const settled = harness();
  await settled.relay.accept(activity(1, { phase: "done", label: "Build finished", final: true }));
  settled.clock.advance(5_000);
  const send = pendingSend();
  void settled.relay.sending(send.send);
  await settle();
  assert.equal(settled.drawn()?.headline, STARTING_HEADLINE);
  send.answer(started);
});

test("no start without a live session to carry Core's activity, and a hidden overlay stays hidden", async () => {
  const offline = harness({ live: false });
  await offline.relay.sending(async () => started);
  offline.clock.advance(300);
  await settle();
  assert.equal(offline.relay.state().display, null);
  assert.equal(offline.pages.length, 0);

  const hidden = harness({ stored: "hidden" });
  const send = pendingSend();
  void hidden.relay.sending(send.send);
  await settle();
  assert.equal(hidden.pages.at(-1)?.overlay, "hidden", "the stored preference is read before the first send");
  send.answer(started);
});

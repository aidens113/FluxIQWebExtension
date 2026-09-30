// The activity feed's rules: the relay's `{ ok: true, state }` read and its
// `changed` pushes, "Unknown FluxIQ extension message." as offline for good,
// a read older than a push dropped, a failed read retried, and the overlay
// preference sent and taken back from the relay's answer.

import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_MESSAGES } from "../../../../shared/activity/index";
import type { PanelMessage, PanelResult } from "../../../state";
import { activityEvent, relayState } from "../../tests/activity-fixture";
import { createActivityFeed, type ActivityPushListener } from "../activity-feed";

const UNSUPPORTED: PanelResult<unknown> = { ok: false, sentence: "This extension doesn't support that yet.", detail: "Unknown FluxIQ extension message.", unsupported: true };
const RESTARTED: PanelResult<unknown> = { ok: false, sentence: "The extension restarted." };

function harness(answer: (message: PanelMessage) => PanelResult<unknown> | Promise<PanelResult<unknown>>) {
  const sent: PanelMessage[] = [];
  const listeners = new Set<ActivityPushListener>();
  let changes = 0;
  const feed = createActivityFeed({
    request: async <T>(message: PanelMessage) => {
      sent.push(message);
      return (await answer(message)) as PanelResult<T>;
    },
    listen: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  }, () => (changes += 1));
  const push = (message: unknown) => {
    for (const listener of [...listeners]) listener(message);
  };
  return { feed, sent, listeners, push, changes: () => changes };
}

test("a read takes the relay's state, including an empty one after a worker restart", async () => {
  const empty = { current: null, recent: [], overlay: "collapsed" as const, live: false };
  const { feed, sent } = harness(() => ({ ok: true, value: { ok: true, state: empty } }));
  assert.equal(feed.snapshot().reach, "loading");
  await feed.read();
  assert.deepEqual(sent, [{ type: ACTIVITY_MESSAGES.read }]);
  assert.equal(feed.snapshot().reach, "ready");
  assert.deepEqual(feed.snapshot().state, empty);
});

test("pushes replace the state; other runtime messages and malformed states are ignored", () => {
  const { feed, push, changes } = harness(() => RESTARTED);
  feed.start();
  const state = relayState([activityEvent(1)]);
  push({ type: "fluxiq.statusChanged", state });
  push({ type: ACTIVITY_MESSAGES.changed, state: { recent: "no" } });
  assert.equal(changes(), 0);
  push({ type: ACTIVITY_MESSAGES.changed, state });
  assert.equal(feed.snapshot().reach, "ready");
  assert.equal(feed.snapshot().state.current?.sequence, 1);
  assert.equal(changes(), 1);
});

test("start subscribes once and stop unsubscribes", () => {
  const { feed, listeners } = harness(() => RESTARTED);
  feed.start();
  feed.start();
  assert.equal(listeners.size, 1);
  feed.stop();
  assert.equal(listeners.size, 0);
});

test("a read asked for before a push is older than it and is dropped", async () => {
  let release: (result: PanelResult<unknown>) => void = () => undefined;
  const { feed, push } = harness(() => new Promise((resolve) => (release = resolve)));
  feed.start();
  const reading = feed.read();
  push({ type: ACTIVITY_MESSAGES.changed, state: relayState([activityEvent(7)]) });
  release({ ok: true, value: { ok: true, state: relayState([activityEvent(3)]) } });
  await reading;
  assert.equal(feed.snapshot().state.current?.sequence, 7);
});

test("Unknown FluxIQ extension message. is offline for good: no more reads, no overlay changes", async () => {
  const { feed, sent } = harness(() => UNSUPPORTED);
  await feed.read();
  assert.equal(feed.snapshot().reach, "unsupported");
  await feed.read();
  await feed.setOverlay("hidden");
  assert.equal(sent.length, 1);
});

test("a failed read says why and the next read tries again", async () => {
  let fail = true;
  const { feed } = harness(() => (fail ? RESTARTED : { ok: true, value: { ok: true, state: relayState([]) } }));
  await feed.read();
  assert.deepEqual([feed.snapshot().reach, feed.snapshot().readError], ["failed", "The extension restarted."]);
  fail = false;
  await feed.read();
  assert.deepEqual([feed.snapshot().reach, feed.snapshot().readError], ["ready", undefined]);
});

test("a failed re-read keeps the state it had", async () => {
  let fail = false;
  const { feed } = harness(() => (fail ? RESTARTED : { ok: true, value: { ok: true, state: relayState([activityEvent(2)]) } }));
  await feed.read();
  fail = true;
  await feed.read();
  assert.equal(feed.snapshot().reach, "ready");
  assert.equal(feed.snapshot().state.current?.sequence, 2);
});

test("the overlay preference is sent, and the relay's answer is what shows", async () => {
  const { feed, sent } = harness((message) => message.type === ACTIVITY_MESSAGES.setOverlay
    ? { ok: true, value: { ok: true, state: relayState([], { overlay: message.overlay as "hidden" }) } }
    : { ok: true, value: { ok: true, state: relayState([]) } });
  await feed.read();
  await feed.setOverlay("expanded");
  assert.equal(sent.length, 1, "the preference already showing is not sent");
  const saving = feed.setOverlay("hidden");
  assert.equal(feed.snapshot().overlaySaving, true);
  await saving;
  assert.deepEqual(sent[1], { type: ACTIVITY_MESSAGES.setOverlay, overlay: "hidden" });
  assert.equal(feed.snapshot().state.overlay, "hidden");
  assert.equal(feed.snapshot().overlaySaving, false);
});

test("a failed overlay change says so and keeps the old preference", async () => {
  const { feed } = harness((message) => message.type === ACTIVITY_MESSAGES.setOverlay ? RESTARTED : { ok: true, value: { ok: true, state: relayState([]) } });
  await feed.read();
  await feed.setOverlay("collapsed");
  assert.equal(feed.snapshot().overlayError, "Couldn't change the on-page status. Try again.");
  assert.equal(feed.snapshot().state.overlay, "expanded");
});

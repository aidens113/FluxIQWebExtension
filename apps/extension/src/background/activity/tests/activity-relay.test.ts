// Coverage of activity-relay.ts: which events are kept, what the panel pages
// and the automation tab's top frame are sent, and that no delivery failure
// escapes. The load-bearing cases are the stale-event drop (an event that
// arrives out of order must not overwrite a newer status), its reset on a new
// session (a Core restart counts from the start again), and that a page which
// cannot take the overlay never breaks the stream.

import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVITY_MESSAGES,
  ACTIVITY_RECENT_LIMIT,
  type ActivityContentMessage,
  type ActivityOverlayPreference,
  type ClientGatewayActivity,
  type ExtensionActivityState
} from "../../../shared/activity/index";
import { ActivityRelay, type ActivityRelayDeps } from "../activity-relay";

function activity(sequence: number, overrides: Partial<ClientGatewayActivity> = {}): ClientGatewayActivity {
  return {
    activityId: "run-1",
    sequence,
    subject: { kind: "run", id: "run-1", projectId: "project-1" },
    phase: "running",
    label: `Running step ${sequence}`,
    at: "2026-09-29T00:00:00.000Z",
    ...overrides
  };
}

function harness(options: { stored?: ActivityOverlayPreference; tabId?: number | undefined; deliver?: ActivityRelayDeps["deliverToTab"]; broadcast?: ActivityRelayDeps["broadcast"] } = {}) {
  const broadcasts: ExtensionActivityState[] = [];
  const delivered: Array<{ tabId: number; message: ActivityContentMessage }> = [];
  const written: ActivityOverlayPreference[] = [];
  let reads = 0;
  const tabId: number | undefined = "tabId" in options ? options.tabId : 7;
  const deps: ActivityRelayDeps = {
    readOverlay: async () => {
      reads += 1;
      return options.stored;
    },
    writeOverlay: async (overlay) => {
      written.push(overlay);
    },
    broadcast: options.broadcast ?? (async (message) => {
      assert.equal(message.type, ACTIVITY_MESSAGES.changed);
      broadcasts.push(message.state);
    }),
    automationTabId: () => tabId,
    deliverToTab: options.deliver ?? (async (target, message) => {
      delivered.push({ tabId: target, message });
    }),
    live: () => true
  };
  return {
    relay: new ActivityRelay(deps),
    broadcasts,
    delivered,
    written,
    reads: () => reads
  };
}

test("an event is kept, broadcast to the panel pages, and sent to the automation tab's top frame", async () => {
  const h = harness();
  const event = activity(1);
  assert.equal(await h.relay.accept(event), true);

  assert.deepEqual(h.broadcasts, [{ current: event, recent: [event], overlay: "expanded", live: true }]);
  assert.deepEqual(h.delivered, [{
    tabId: 7,
    message: { type: ACTIVITY_MESSAGES.content, activity: event, overlay: "expanded", topFrameOnly: true }
  }]);
});

test("an event not newer than the last kept one is dropped, and nothing is sent for it", async () => {
  const h = harness();
  await h.relay.accept(activity(5));
  assert.equal(await h.relay.accept(activity(5)), false);
  assert.equal(await h.relay.accept(activity(3)), false);
  assert.equal(h.relay.state().current?.sequence, 5);
  assert.equal(h.broadcasts.length, 1);
  assert.equal(h.delivered.length, 1);
});

test("a new session accepts Core's count from the start again", async () => {
  const h = harness();
  await h.relay.accept(activity(40));
  h.relay.noteSessionReady();
  assert.equal(await h.relay.accept(activity(1)), true);
  assert.equal(h.relay.state().current?.sequence, 1);
  assert.deepEqual(h.relay.state().recent.map((entry) => entry.sequence), [40, 1]);
});

test("a malformed payload is dropped", async () => {
  const h = harness();
  for (const payload of [undefined, null, "x", {}, { ...activity(1), sequence: "2" }, { ...activity(1), sequence: Number.NaN }, { ...activity(1), label: undefined }]) {
    assert.equal(await h.relay.accept(payload), false, JSON.stringify(payload));
  }
  assert.equal(h.relay.state().current, null);
  assert.deepEqual(h.broadcasts, []);
});

test("recent keeps the newest events, oldest first, up to the limit", async () => {
  const h = harness();
  const total = ACTIVITY_RECENT_LIMIT + 5;
  for (let sequence = 1; sequence <= total; sequence += 1) await h.relay.accept(activity(sequence));
  const recent = h.relay.state().recent.map((entry) => entry.sequence);
  assert.equal(recent.length, ACTIVITY_RECENT_LIMIT);
  assert.equal(recent[0], 6);
  assert.equal(recent.at(-1), total);
});

test("the overlay preference defaults to expanded, is read from storage once, and a set one is stored and sent", async () => {
  const fresh = harness();
  assert.equal((await fresh.relay.read()).overlay, "expanded");

  const h = harness({ stored: "collapsed" });
  assert.equal((await h.relay.read()).overlay, "collapsed");
  await h.relay.accept(activity(1));
  assert.equal(h.reads(), 1);
  assert.equal(h.delivered[0]?.message.overlay, "collapsed");

  const state = await h.relay.setOverlay("hidden");
  assert.equal(state.overlay, "hidden");
  assert.deepEqual(h.written, ["hidden"]);
  assert.equal(h.broadcasts.at(-1)?.overlay, "hidden");
  assert.equal(h.delivered.at(-1)?.message.overlay, "hidden");
});

test("a storage failure leaves the default preference, and a write failure keeps the new one in memory", async () => {
  const relay = new ActivityRelay({
    readOverlay: async () => {
      throw new Error("storage unavailable");
    },
    writeOverlay: async () => {
      throw new Error("quota");
    },
    broadcast: async () => undefined,
    automationTabId: () => undefined,
    deliverToTab: async () => undefined,
    live: () => false
  });
  assert.equal((await relay.read()).overlay, "expanded");
  assert.equal((await relay.setOverlay("collapsed")).overlay, "collapsed");
  assert.equal(relay.state().live, false);
});

test("no panel open and a page that refuses the overlay are both absorbed", async () => {
  const h = harness({
    broadcast: async () => {
      throw new Error("Could not establish connection. Receiving end does not exist.");
    },
    deliver: async () => {
      throw new Error("Cannot access contents of the page.");
    }
  });
  assert.equal(await h.relay.accept(activity(1)), true);
  assert.equal(h.relay.state().current?.sequence, 1);
});

test("with no automation tab nothing is sent to a page, but the panel still hears", async () => {
  const h = harness({ tabId: undefined });
  await h.relay.accept(activity(1));
  assert.equal(h.broadcasts.length, 1);
  assert.deepEqual(h.delivered, []);
});

test("events that arrive during a slow delivery are coalesced: the page gets the latest, in order", async () => {
  const seen: number[] = [];
  let release: (() => void) | undefined;
  const h = harness({
    deliver: async (_tabId, message) => {
      seen.push(message.activity?.sequence ?? -1);
      if (seen.length === 1) await new Promise<void>((resolve) => { release = resolve; });
    }
  });
  const first = h.relay.accept(activity(1));
  await new Promise((resolve) => setImmediate(resolve));
  await h.relay.accept(activity(2));
  await h.relay.accept(activity(3));
  release?.();
  await first;
  assert.deepEqual(seen, [1, 3]);
});

test("a top frame that reports ready on the automation tab gets the current state again; other frames and tabs do not", async () => {
  const h = harness();
  await h.relay.noteContentReady(7, 0);
  assert.equal(h.delivered.length, 0, "nothing to re-send before any activity");

  await h.relay.accept(activity(1));
  h.delivered.length = 0;
  await h.relay.noteContentReady(7, 3);
  await h.relay.noteContentReady(8, 0);
  await h.relay.noteContentReady(undefined, 0);
  assert.equal(h.delivered.length, 0);

  await h.relay.noteContentReady(7, 0);
  await h.relay.noteContentReady(7, undefined);
  assert.equal(h.delivered.length, 2);
  assert.equal(h.delivered[0]?.message.activity?.sequence, 1);
});

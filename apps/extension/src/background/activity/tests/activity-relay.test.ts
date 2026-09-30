// Coverage of activity-relay.ts: which events are kept, what the panel pages
// and the automation tab's top frame are sent and how often, and that no
// delivery failure escapes. The load-bearing cases are the stale-event drop
// (an event that arrives out of order must not overwrite a newer status), its
// reset on a new session (a Core restart counts from the start again), that
// the page is reached whether or not a panel is open -- a panel send that
// fails or never settles must not hold it back -- and the rate bound.

import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVITY_DONE_VISIBLE_MS,
  ACTIVITY_MESSAGES,
  ACTIVITY_RECENT_LIMIT,
  type ActivityContentMessage,
  type ActivityOverlayPreference,
  type ClientGatewayActivity,
  type ExtensionActivityState
} from "../../../shared/activity/index";
import { ActivityRelay, PAGE_SEND_TIMEOUT_MS, type ActivityRelayDeps } from "../activity-relay";
import { OverlayTarget } from "../overlay-target";
import { FakeClock } from "./fake-clock";

function activity(sequence: number, overrides: Partial<ClientGatewayActivity> = {}): ClientGatewayActivity {
  return {
    activityId: "run:run-1",
    sequence,
    subject: { kind: "run", id: "run-1", projectId: "project-1" },
    phase: "running",
    label: `Running step ${sequence}`,
    at: "2026-09-29T00:00:00.000Z",
    ...overrides
  };
}

/** Lets every promise the relay started settle. */
async function settle(): Promise<void> {
  for (let round = 0; round < 10; round += 1) await new Promise((resolve) => setImmediate(resolve));
}

type HarnessOptions = {
  stored?: ActivityOverlayPreference;
  tabId?: number | undefined;
  automationTabId?: ActivityRelayDeps["automationTabId"];
  deliver?: ActivityRelayDeps["deliverToTab"];
  broadcast?: ActivityRelayDeps["broadcast"];
};

function harness(options: HarnessOptions = {}) {
  const clock = new FakeClock(0);
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
    automationTabId: options.automationTabId ?? (async () => tabId),
    deliverToTab: options.deliver ?? (async (target, message) => {
      delivered.push({ tabId: target, message });
    }),
    live: () => true,
    clock
  };
  return { relay: new ActivityRelay(deps), clock, broadcasts, delivered, written, reads: () => reads };
}

test("an event is kept, paced into a display, broadcast to the panel pages, and sent to the automation tab's top frame", async () => {
  const h = harness();
  const event = activity(1);
  assert.equal(await h.relay.accept(event), true);
  await settle();

  assert.equal(h.broadcasts.length, 1);
  assert.deepEqual(h.broadcasts[0]?.current, event);
  assert.deepEqual(h.broadcasts[0]?.recent, [event]);
  assert.equal(h.broadcasts[0]?.display?.headline, "Running your Flow");
  assert.equal(h.broadcasts[0]?.display?.detail, "Running step 1");
  assert.equal(h.delivered.length, 1);
  assert.equal(h.delivered[0]?.tabId, 7);
  assert.deepEqual(h.delivered[0]?.message, {
    type: ACTIVITY_MESSAGES.content,
    activity: event,
    display: h.relay.state().display,
    overlay: "expanded",
    topFrameOnly: true
  });
});

test("an event not newer than the last kept one is dropped, and nothing is sent for it", async () => {
  const h = harness();
  await h.relay.accept(activity(5));
  await settle();
  assert.equal(await h.relay.accept(activity(5)), false);
  assert.equal(await h.relay.accept(activity(3)), false);
  h.clock.advance(1_000);
  await settle();
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
  await settle();
  assert.equal(h.relay.state().current, null);
  assert.equal(h.relay.state().display, null);
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
  await settle();
  assert.equal(h.reads(), 1);
  assert.equal(h.delivered[0]?.message.overlay, "collapsed");

  h.clock.advance(1_000);
  const state = await h.relay.setOverlay("hidden");
  await settle();
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
    automationTabId: async () => undefined,
    deliverToTab: async () => undefined,
    live: () => false,
    clock: new FakeClock(0)
  });
  assert.equal((await relay.read()).overlay, "expanded");
  assert.equal((await relay.setOverlay("collapsed")).overlay, "collapsed");
  assert.equal(relay.state().live, false);
});

test("no panel open: the broadcast fails and the page is still sent the display", async () => {
  const h = harness({
    broadcast: async () => {
      throw new Error("Could not establish connection. Receiving end does not exist.");
    }
  });
  assert.equal(await h.relay.accept(activity(1)), true);
  await settle();
  assert.equal(h.delivered.length, 1);
  assert.equal(h.delivered[0]?.message.display?.detail, "Running step 1");
});

test("a panel send that never settles does not hold the page back", async () => {
  const h = harness({ broadcast: () => new Promise<void>(() => undefined) });
  await h.relay.accept(activity(1));
  await settle();
  h.clock.advance(1_300);
  await h.relay.accept(activity(2));
  await settle();
  h.clock.advance(300);
  await settle();
  assert.deepEqual(h.delivered.map((entry) => entry.message.display?.detail), ["Running step 1", "Running step 2"]);
});

test("a page that refuses the overlay is absorbed", async () => {
  const h = harness({
    deliver: async () => {
      throw new Error("Cannot access contents of the page.");
    }
  });
  assert.equal(await h.relay.accept(activity(1)), true);
  await settle();
  assert.equal(h.relay.state().current?.sequence, 1);
  assert.equal(h.broadcasts.length, 1);
});

test("with no automation tab nothing is sent to a page, but the panel still hears", async () => {
  const h = harness({ tabId: undefined });
  await h.relay.accept(activity(1));
  await settle();
  assert.equal(h.broadcasts.length, 1);
  assert.deepEqual(h.delivered, []);
});

test("when the automation moves to another tab, the overlay is taken down in the one it left", async () => {
  let tab = 7;
  const h = harness({ automationTabId: async () => tab });
  await h.relay.accept(activity(1));
  await settle();
  tab = 9;
  h.clock.advance(1_300);
  await h.relay.accept(activity(2));
  await settle();
  assert.deepEqual(h.delivered.map((entry) => [entry.tabId, entry.message.display?.detail ?? null]), [[7, "Running step 1"], [7, null], [9, "Running step 2"]]);
});

test("displays that change during a slow delivery are coalesced: the page gets the latest, in order", async () => {
  const seen: Array<string | null> = [];
  let release: (() => void) | undefined;
  const h = harness({
    deliver: async (_tabId, message) => {
      seen.push(message.display?.detail ?? null);
      if (seen.length === 1) await new Promise<void>((resolve) => { release = resolve; });
    }
  });
  await h.relay.accept(activity(1));
  await settle();
  for (const sequence of [2, 3]) {
    h.clock.advance(1_300);
    await h.relay.accept(activity(sequence));
    await settle();
  }
  release?.();
  await settle();
  assert.deepEqual(seen, ["Running step 1", "Running step 3"]);
});

test("a top frame that reports ready on the automation tab gets the current display again; other frames and tabs do not", async () => {
  const h = harness();
  await h.relay.noteContentReady(7, 0);
  assert.equal(h.delivered.length, 0, "nothing to re-send before any activity");

  await h.relay.accept(activity(1));
  await settle();
  h.delivered.length = 0;
  await h.relay.noteContentReady(7, 3);
  await h.relay.noteContentReady(8, 0);
  await h.relay.noteContentReady(undefined, 0);
  assert.equal(h.delivered.length, 0);

  await h.relay.noteContentReady(7, 0);
  await h.relay.noteContentReady(7, undefined);
  assert.equal(h.delivered.length, 2);
  assert.equal(h.delivered[0]?.message.display?.detail, "Running step 1");
});

test("a navigation's new document gets the display at once: not paced by the page gate, not queued behind a send to the old document", async () => {
  const sends: Array<{ at: number; detail: string | null }> = [];
  let hangFirst = true;
  const h = harness({
    deliver: async (_tabId, message) => {
      sends.push({ at: h.clock.now(), detail: message.display?.detail ?? null });
      if (hangFirst) {
        hangFirst = false;
        await new Promise<void>(() => {
          /* the old document went away mid-send: this send never settles */
        });
      }
    }
  });
  await h.relay.accept(activity(1));
  await settle();
  h.clock.advance(10);
  await h.relay.accept(activity(2, { label: "Running step 2" }));
  await settle();
  // The page gate sent at 0, so a paced send could go no sooner than 250 ms;
  // the send at 0 has not settled, so a queued one could go no sooner than its timeout.
  h.clock.advance(20);
  await h.relay.noteContentReady(7, 0);
  assert.deepEqual(sends.map((send) => send.at), [0, 30], "the ready document is answered at 30 ms, the moment it asks");
  assert.equal(sends[1]?.detail, "Running step 1", "with what the person was already reading: the pacer still holds step 2");
});

test("a page send that never settles is given up, so the next display still reaches the page", async () => {
  const seen: Array<string | null> = [];
  const h = harness({
    deliver: async (_tabId, message) => {
      seen.push(message.display?.detail ?? null);
      if (seen.length === 1) await new Promise<void>(() => {
        /* never settles */
      });
    }
  });
  await h.relay.accept(activity(1));
  await settle();
  h.clock.advance(1_300);
  await h.relay.accept(activity(2));
  await settle();
  assert.deepEqual(seen, ["Running step 1"], "held while the first send is in flight");
  h.clock.advance(PAGE_SEND_TIMEOUT_MS);
  await settle();
  assert.deepEqual(seen, ["Running step 1", "Running step 2"]);
  assert.equal(h.clock.pending(), 0, "no timer is left behind");
});

test("a finished status is re-drawn on a new page while it is still showing, not after it has faded", async () => {
  const h = harness();
  await h.relay.accept(activity(1));
  await h.relay.accept(activity(2, { phase: "done", label: "Run finished", final: true }));
  h.clock.advance(300);
  await settle();
  assert.equal(h.delivered.at(-1)?.message.display?.outcome, "done");
  h.delivered.length = 0;
  h.clock.advance(ACTIVITY_DONE_VISIBLE_MS - 1_300);
  await h.relay.noteContentReady(7, 0);
  assert.equal(h.delivered.at(-1)?.message.display?.headline, "Run finished");
  h.clock.advance(2_000);
  await h.relay.noteContentReady(7, 0);
  assert.equal(h.delivered.length, 1, "the person already saw it go");
});

test("a failure is re-drawn on every new page, however long ago it came", async () => {
  const h = harness();
  await h.relay.accept(activity(1, { phase: "failed", label: "Run failed", final: true }));
  await settle();
  h.delivered.length = 0;
  h.clock.advance(60_000);
  await h.relay.noteContentReady(7, 0);
  assert.equal(h.delivered.at(-1)?.message.display?.outcome, "failed");
});

test("the bound: forty events in one second give at most four panel sends, four page sends and one detail change after the first", async () => {
  const h = harness();
  for (let index = 0; index < 40; index += 1) {
    h.clock.advanceTo(index * 25);
    await h.relay.accept(activity(index + 1, { phase: index % 2 ? "verifying" : "exploring", label: `Sentence ${index + 1}` }));
    await settle();
  }
  assert.ok(h.broadcasts.length <= 4, `panel sends: ${h.broadcasts.length}`);
  assert.ok(h.delivered.length <= 4, `page sends: ${h.delivered.length}`);
  assert.equal(new Set(h.delivered.map((entry) => entry.message.display?.detail)).size, 1, "only the first sentence inside the detail interval");
  h.clock.advance(2_000);
  await settle();
  assert.equal(h.delivered.at(-1)?.message.display?.detail, "Sentence 40", "the newest sentence reaches the page once the interval ends");
});

// The Lab's own topology, through the real target resolver: an extension page
// open as a tab, FluxIQ's web panel, and the scenario tab, with the extension
// holding whichever was activated last.
function labTopology(options: { active: number; driven: number | undefined }) {
  const tabs: Record<number, string> = {
    1: "chrome-extension://abcdefghijklmnop/sidepanel/index.html",
    2: "http://127.0.0.1:51000/scenarios/company-website/",
    3: "http://127.0.0.1:58202/"
  };
  return new OverlayTarget({
    drivenTabId: () => options.driven,
    activeTabId: () => options.active,
    activeTabs: async () => [{ id: options.active, url: tabs[options.active] }, { id: 2, url: tabs[2] }],
    tabUrl: async (tabId) => tabs[tabId],
    ownOrigins: () => ["http://127.0.0.1:58202", "ws://127.0.0.1:58203/client"]
  });
}

for (const panel of ["open", "closed"] as const) {
  test(`the scenario tab gets the display with the panel ${panel}, whichever Lab tab the extension holds as active`, async () => {
    for (const setup of [{ active: 1, driven: undefined }, { active: 3, driven: undefined }, { active: 1, driven: 2 }, { active: 3, driven: 2 }]) {
      const target = labTopology(setup);
      const h = harness({
        automationTabId: () => target.resolve(),
        ...(panel === "closed" ? { broadcast: async () => { throw new Error("Receiving end does not exist."); } } : {})
      });
      await h.relay.accept(activity(1));
      await settle();
      assert.deepEqual(h.delivered.map((entry) => entry.tabId), [2], JSON.stringify(setup));
      if (panel === "open") assert.equal(h.broadcasts.length, 1);
    }
  });
}

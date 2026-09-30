// Coverage of the worker's side of pacing: `withPagePace` answers a read's own
// page-load messages from the pace, at once, keyed by the sender's origin, and
// no one else's; `paceNavigation` waits out a navigation's booking itself; and
// `withPaceNote` names in the result what the pace held, and nothing when it
// held nothing. The chrome API is stubbed and every listener is read back.

import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_LOAD_PACE_MESSAGE, type BrowserActionResult } from "../../../shared/protocol";
import { OriginPace } from "../origin-pace";
import { PAGE_LOAD_PACE_SETTINGS } from "../pace-settings";
import { PaceTally } from "../pace-tally";
import { withPagePace } from "../paced-page-loads";
import { withPaceNote } from "../paced-result";
import { paceNavigation } from "../navigation-pace";

const TAB_ID = 7;
const PAGE = "http://127.0.0.1:4173/everything-store/s?k=kettle&page=2";
const STORE = "http://127.0.0.1:4173";
const { spacingMs } = PAGE_LOAD_PACE_SETTINGS;

type Sender = { tab?: { id?: number }; frameId?: number; url?: string };
type Listener = (message: unknown, sender: Sender, sendResponse: (response?: unknown) => void) => boolean;

/** Installs a chrome stub for the length of one test; every test file shares one process, so the one before it comes back afterwards. */
function installChromeStub(t: { after(fn: () => void): void }): Set<Listener> {
  const listeners = new Set<Listener>();
  const global = globalThis as { chrome?: unknown };
  const before = global.chrome;
  t.after(() => { global.chrome = before; });
  global.chrome = {
    runtime: {
      onMessage: {
        addListener: (listener: Listener) => void listeners.add(listener),
        removeListener: (listener: Listener) => void listeners.delete(listener)
      }
    }
  };
  return listeners;
}

/** Delivers `message` to every listener as the browser would and answers the first response given synchronously. */
function deliver(listeners: Set<Listener>, message: unknown, sender: Sender): unknown {
  let answer: unknown;
  let answered = false;
  for (const listener of listeners) {
    listener(message, sender, (response) => {
      if (answered) return;
      answered = true;
      answer = response;
    });
  }
  return answered ? answer : "unanswered";
}

const READ_RESULT: BrowserActionResult = {
  commandId: "c-list",
  actionType: "web.dom.extract_list",
  status: "succeeded",
  message: "List extracted.",
  validation: { status: "passed", expected: "at least 1 record", actual: "13 records from 5 pages" },
  startedAt: 1,
  finishedAt: 2
};

test("a read's own page loads are booked on the pace by the sender's origin and answered at once with the wait", async (t) => {
  const listeners = installChromeStub(t);
  const clock = { now: 5_000 };
  const pace = new OriginPace(PAGE_LOAD_PACE_SETTINGS, () => clock.now);
  const sender = { tab: { id: TAB_ID }, frameId: 0, url: PAGE };
  const { value, tally } = await withPagePace(pace, TAB_ID, 0, async () => {
    const answers = [
      deliver(listeners, { type: PAGE_LOAD_PACE_MESSAGE, kind: "load" }, sender),
      deliver(listeners, { type: PAGE_LOAD_PACE_MESSAGE, kind: "load" }, sender),
      deliver(listeners, { type: PAGE_LOAD_PACE_MESSAGE, kind: "load" }, { ...sender, tab: { id: TAB_ID + 1 } }),
      deliver(listeners, { type: PAGE_LOAD_PACE_MESSAGE, kind: "load" }, { ...sender, frameId: 3 }),
      deliver(listeners, { type: "fluxiq.extraction.checkpoint" }, sender)
    ];
    return answers;
  });
  assert.deepEqual(value, [{ ok: true, waitMs: 0 }, { ok: true, waitMs: spacingMs }, "unanswered", "unanswered", "unanswered"]);
  assert.equal(tally.loads, 2);
  assert.equal(tally.waits, 1);
  assert.equal(tally.waitedMs, spacingMs);
  assert.equal(listeners.size, 0, "the listener goes when the read ends");
  assert.equal(pace.reserve(STORE), 2 * spacingMs, "the bookings were the origin's, keyed without its path");
});

test("a refused document slows its origin through the pace, and a status that is no refusal does not", async (t) => {
  const listeners = installChromeStub(t);
  const clock = { now: 0 };
  const pace = new OriginPace(PAGE_LOAD_PACE_SETTINGS, () => clock.now);
  const sender = { tab: { id: TAB_ID }, frameId: 0, url: PAGE };
  const { tally } = await withPagePace(pace, TAB_ID, 0, async () => {
    deliver(listeners, { type: PAGE_LOAD_PACE_MESSAGE, kind: "refused", status: 200 }, sender);
    assert.equal(pace.spacingOf(STORE), spacingMs);
    deliver(listeners, { type: PAGE_LOAD_PACE_MESSAGE, kind: "refused", status: 429 }, sender);
  });
  assert.equal(tally.refusals, 1);
  assert.equal(pace.spacingOf(STORE), 2 * spacingMs);
  assert.equal(pace.refusalsOf(STORE), 1);
});

test("a read that throws still takes its listener away", async (t) => {
  const listeners = installChromeStub(t);
  await assert.rejects(withPagePace(new OriginPace(), TAB_ID, 0, () => Promise.reject(new Error("tab closed"))), /tab closed/u);
  assert.equal(listeners.size, 0);
});

test("a navigation waits out its booking in the worker, and a page that is not on the web is not paced", async () => {
  const clock = { now: 0 };
  const pace = new OriginPace(PAGE_LOAD_PACE_SETTINGS, () => clock.now);
  const pauses: number[] = [];
  const pause = (ms: number): Promise<void> => { pauses.push(ms); return Promise.resolve(); };
  assert.equal((await paceNavigation(pace, PAGE, pause)).waits, 0);
  const second = await paceNavigation(pace, `${STORE}/everything-store/`, pause);
  assert.equal(second.waitedMs, spacingMs);
  assert.equal((await paceNavigation(pace, "https://elsewhere.test/", pause)).waits, 0, "another origin goes at once");
  assert.equal((await paceNavigation(pace, "chrome://extensions", pause)).loads, 0);
  assert.deepEqual(pauses, [spacingMs]);
});

test("the result names what the pace held, in counts and seconds, and is unchanged when it held nothing", () => {
  const idle = new PaceTally();
  idle.booked(0, spacingMs);
  assert.equal(withPaceNote(READ_RESULT, idle), READ_RESULT);

  const held = new PaceTally();
  held.booked(0, spacingMs);
  held.booked(1_250, spacingMs);
  held.refused(2 * spacingMs);
  held.booked(8_500, 2 * spacingMs);
  const noted = withPaceNote(READ_RESULT, held);
  assert.equal(
    noted.validation?.status === "none" ? undefined : noted.validation?.actual,
    "13 records from 5 pages; FluxIQ spaced its page loads on this site, waiting before 2 of 3 loads (9.8 s in all); the site refused 1 load, so FluxIQ now keeps 5.0 s between its loads there"
  );
  assert.equal(READ_RESULT.validation?.status === "none" ? undefined : READ_RESULT.validation?.actual, "13 records from 5 pages", "the result it was given is not changed");
});

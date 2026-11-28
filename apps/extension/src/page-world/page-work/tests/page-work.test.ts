// The page world's count of the work a page schedules for itself (task speed
// S10): timers within the horizon, animation frames, fetches and XHRs, each
// until it is done, with recurring work left out. The two pages it was built
// for are here as the shapes their scripts take: local-classifieds' sort, which
// rewrites the address, waits a short delay and then requests the results; and
// its listing, whose panel is drawn by a timer that requests it. And since t1094,
// the background traffic every real site makes, which changes nothing and holds
// nothing: a long poll, a beacon chained by fresh closures, an animation loop of
// them. The runner is Node: the window, its timers, frames, resource timeline,
// XHR, document observer and clock are stand-ins.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { installPageWorkWatch } from "..";
import { PAGE_QUIET_WINDOW_MS, PAGE_WORK_BUSY_EVENT, PAGE_WORK_DRAINED_EVENT, PAGE_WORK_HORIZON_MS, PAGE_WORK_PENDING_EVENT, PAGE_WORK_WATCHED_EVENT } from "../../../shared/scheduled-work-event";

type Entry = { initiatorType: string; name: string };
type Host = EventTarget & {
  setTimeout(callback: () => void, delay?: number): unknown;
  clearTimeout(token: unknown): void;
  setInterval(callback: () => void, delay?: number): unknown;
  clearInterval(token: unknown): void;
  requestAnimationFrame(callback: () => void): unknown;
  cancelAnimationFrame(token: unknown): void;
  fetch(input: string): unknown;
};

/** Where the stand-in clock is set once the page world has installed: long after the document's first change. */
const SETTLED_AT = 60_000;

const PAGE_GLOBALS = ["window", "chrome", "document", "PerformanceObserver", "MutationObserver", "performance"] as const;

/** The tests whose globals are already stood in, so a second page in one test does not take the first page's stand-ins as the originals. */
const standingIn = new WeakSet<TestContext>();

/**
 * Stands the page globals in for the rest of `t`, and puts back what was there before its first page once it ends.
 * node:test runs a test's `after` hooks in the order they were added, so a restore per page would end on the first
 * page's stand-ins whenever a test opens two, leaving `performance` without `getEntriesByType` for every later file.
 */
function standIn(t: TestContext): void {
  if (standingIn.has(t)) return;
  standingIn.add(t);
  const globals = globalThis as Record<string, unknown>;
  const previous = PAGE_GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globals, name), globals[name]] as const);
  t.after(() => {
    for (const [name, descriptor, value] of previous) {
      if (!descriptor) {
        delete globals[name];
        continue;
      }
      Object.defineProperty(globals, name, descriptor);
      // Node's `performance` is an accessor that keeps whatever was last set in it, so the value goes back through it too.
      if (descriptor.set) globals[name] = value;
    }
  });
}

function page(t: TestContext, options: { hidden?: boolean; observer?: boolean } = {}) {
  const globals = globalThis as Record<string, unknown>;
  standIn(t);
  let deliver: (entries: Entry[]) => void = () => undefined;
  class TimelineStandin {
    constructor(private readonly callback: (list: { getEntries(): Entry[] }) => void) {}
    observe(): void { deliver = (entries) => this.callback({ getEntries: () => entries }); }
  }
  let changed: () => void = () => undefined;
  class ObserverStandin {
    constructor(private readonly callback: () => void) {}
    observe(): void { changed = this.callback; }
  }
  const clock = { at: 0 };
  class Xhr extends EventTarget { send(): void {} }
  const fetched: string[] = [];
  const host = Object.assign(new EventTarget(), {
    setTimeout: (callback: () => void, delay?: number) => setTimeout(callback, delay),
    clearTimeout: (token: ReturnType<typeof setTimeout>) => clearTimeout(token),
    setInterval: (callback: () => void, delay?: number) => setInterval(callback, delay),
    clearInterval: (token: ReturnType<typeof setInterval>) => clearInterval(token),
    requestAnimationFrame: (callback: (at: number) => void) => setTimeout(() => callback(Date.now()), 5),
    cancelAnimationFrame: (token: ReturnType<typeof setTimeout>) => clearTimeout(token),
    fetch: (input: string) => { fetched.push(input);
      return "response"; },
    XMLHttpRequest: Xhr
  }) as unknown as Host;
  Object.assign(globals, {
    window: host,
    chrome: undefined,
    document: { baseURI: "https://kerbfind.test/search/", visibilityState: options.hidden ? "hidden" : "visible" },
    PerformanceObserver: TimelineStandin,
    MutationObserver: options.observer === false ? undefined : ObserverStandin,
    performance: { now: () => clock.at }
  });
  const installed = installPageWorkWatch();
  clock.at = SETTLED_AT;
  let drained = 0;
  host.addEventListener(PAGE_WORK_DRAINED_EVENT, () => { drained += 1; });
  const asked = (type: string): boolean => !host.dispatchEvent(new Event(type, { cancelable: true }));
  return {
    host, Xhr, fetched, installed,
    busy: () => asked(PAGE_WORK_BUSY_EVENT),
    pending: () => asked(PAGE_WORK_PENDING_EVENT),
    watched: () => asked(PAGE_WORK_WATCHED_EVENT),
    answer: (url: string) => deliver([{ initiatorType: "fetch", name: url }]),
    drained: () => drained,
    /** The document changed now. */
    mutate: () => changed(),
    /** The stand-in clock moves on `ms`; real timers are untouched. */
    advance: (ms: number) => { clock.at += ms; }
  };
}

const later = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test("a page world that counts says so, and a page with nothing scheduled is not busy", (t) => {
  const p = page(t);
  assert.equal(p.installed, true);
  assert.equal(p.watched(), true);
  assert.equal(p.busy(), false);
});

test("a page world that cannot see its document change says it is not counting, and readiness keeps the old second", (t) => {
  const p = page(t, { observer: false });
  assert.equal(p.installed, false);
  assert.equal(p.watched(), false);
});

test("a document that changed is busy for the quiet window, then still", (t) => {
  const p = page(t);
  p.mutate();
  assert.equal(p.busy(), true, "just changed");
  p.advance(PAGE_QUIET_WINDOW_MS - 1);
  assert.equal(p.busy(), true);
  p.advance(1);
  assert.equal(p.busy(), false, "unchanged for the quiet window");
  assert.equal(p.pending(), false, "a change is not work: command readiness is not held by it");
});

test("a timer due within the horizon keeps the page busy until its callback has run; one due later never does", async (t) => {
  const p = page(t);
  const due = p.host.setTimeout((() => undefined), (PAGE_WORK_HORIZON_MS + 500));
  assert.equal(p.busy(), false, "a timer due later is the page acting in its own time");
  p.host.setTimeout((() => undefined), 30);
  assert.equal(p.busy(), true);
  await later(60);
  assert.equal(p.busy(), false);
  assert.equal(p.drained(), 1, "the count falling to none is announced");
  // Not left to fire after the test, when this page's window is no longer the global one.
  p.host.clearTimeout(due);
});

test("a deferred one-shot is visible to command readiness without holding ordinary navigation readiness", (t) => {
  const p = page(t);
  const token = p.host.setTimeout(() => undefined, PAGE_WORK_HORIZON_MS + 500);
  assert.equal(p.busy(), false);
  assert.equal(p.pending(), true, "hydration remains known work even beyond the navigation horizon");
  p.host.clearTimeout(token);
  assert.equal(p.pending(), false);
});

test("an unrelated long interval never becomes deferred one-shot work", (t) => {
  const p = page(t);
  const token = p.host.setInterval(() => undefined, PAGE_WORK_HORIZON_MS + 500);
  assert.equal(p.busy(), false);
  assert.equal(p.pending(), false);
  p.host.clearInterval(token);
});

test("the sort: an address rewritten in place, a short delay, then the results requested -- busy until they answer", async (t) => {
  const p = page(t);
  // feed-script's \`restart\`: \`await delay(feedLatency)\`, then \`fetch(feedUrl)\`, then the grid is drawn.
  void (async () => {
    await new Promise<void>((resolve) => p.host.setTimeout(() => resolve(), 40));
    p.host.fetch("feed.json?sortBy=price_ascend");
  })();
  assert.equal(p.busy(), true, "the delay is counted");
  await later(70);
  assert.equal(p.busy(), true, "the request it led to is counted");
  p.answer("https://kerbfind.test/search/feed.json?sortBy=price_ascend");
  assert.equal(p.busy(), false);
});

test("the listing: a panel drawn by a timer that requests it -- busy through the timer and the request", async (t) => {
  const p = page(t);
  // listing-script: \`setTimeout(async () => { await (await fetch(detailUrl + 'detail.json')).json(); ... }, detailDelay)\`.
  p.host.setTimeout((() => { p.host.fetch("detail.json"); }), 40);
  assert.equal(p.busy(), true);
  await later(70);
  assert.equal(p.busy(), true, "the timer ran and its request is out");
  p.answer("https://kerbfind.test/search/detail.json");
  assert.equal(p.busy(), false);
});

test("a callback that schedules itself again recurs: it is counted once, and what it begins after is not", async (t) => {
  const p = page(t);
  let runs = 0;
  // The fourth run is awaited itself: each run is scheduled only once the one before it has run, so no fixed wait is sure to cover four on a busy machine.
  let fourth: () => void = () => undefined;
  const ranFourTimes = new Promise<void>((resolve) => { fourth = resolve; });
  const poll = (): void => {
    runs += 1;
    p.host.fetch("poll.json");
    if (runs < 4) p.host.setTimeout(poll, 10);
    else fourth();
  };
  p.host.setTimeout(poll, 10);
  await ranFourTimes;
  assert.equal(runs, 4);
  p.answer("https://kerbfind.test/search/poll.json");
  assert.equal(p.busy(), false, "only the first run's request was counted, and it answered");
  assert.equal(p.pending(), false, "recurring work cannot hold command readiness either");
});

test("an interval counts until its first run, an animation-frame loop its first frame, and frames not at all in a hidden document", async (t) => {
  const p = page(t);
  const interval = p.host.setInterval((() => undefined), 20);
  assert.equal(p.busy(), true);
  await later(35);
  assert.equal(p.busy(), false, "an interval that has fired recurs");
  p.host.clearInterval(interval);
  let frames = 0;
  const tick = (): void => { frames += 1;
    if (frames < 5) p.host.requestAnimationFrame(tick); };
  p.host.requestAnimationFrame(tick);
  assert.equal(p.busy(), true);
  await later(30);
  assert.equal(p.busy(), false, "an animation loop is the page's heartbeat");

  const hidden = page(t, { hidden: true });
  const frame = hidden.host.requestAnimationFrame((() => undefined));
  assert.equal(hidden.busy(), false, "a hidden document draws no frames");
  // Not left to draw after the test, when this page's window is no longer the global one.
  hidden.host.cancelAnimationFrame(frame);
});

test("an XHR is counted until its loadend, and a cleared timer is done", (t) => {
  const p = page(t);
  const request = new p.Xhr();
  (request as unknown as { send(): void }).send();
  assert.equal(p.busy(), true);
  request.dispatchEvent(new Event("loadend"));
  assert.equal(p.busy(), false);
  const token = p.host.setTimeout((() => undefined), 50);
  p.host.clearTimeout(token);
  assert.equal(p.busy(), false);
});

// t1094: which work holds the page. A request that is still out holds it until it answers, or until the document
// has gone the horizon unchanged since it began; each change starts the horizon again.

test("a long poll holds the page only until the document has gone the horizon unchanged since it began (t1094)", (t) => {
  const p = page(t);
  p.host.fetch("updates.json?since=0&wait=25");
  assert.equal(p.busy(), true, "a request just begun may be what the page is waiting to draw");
  p.advance(PAGE_WORK_HORIZON_MS - 1);
  assert.equal(p.busy(), true);
  p.advance(1);
  assert.equal(p.busy(), false, "a horizon out with nothing drawn: a connection the page holds open, not the page drawing");
  assert.equal(p.pending(), false, "nor does it hold command readiness");
});

test("a request whose page keeps changing around it keeps holding: a list fetched and then drawn is waited for (t1094)", (t) => {
  const p = page(t);
  p.host.fetch("feed.json?batch=0");
  p.advance(PAGE_WORK_HORIZON_MS - 200);
  p.mutate();
  p.advance(PAGE_WORK_HORIZON_MS - 1);
  assert.equal(p.busy(), true, "the horizon starts again at each change");
  p.advance(1);
  assert.equal(p.busy(), false);
});

test("an XHR the server never answers stops holding the page the same way (t1094)", (t) => {
  const p = page(t);
  const request = new p.Xhr();
  (request as unknown as { send(): void }).send();
  p.advance(PAGE_WORK_HORIZON_MS);
  assert.equal(p.busy(), false);
});

test("a beacon chained by fresh closures, each sent after the last answered, is one chain that stops holding a horizon after it began (t1094)", async (t) => {
  const p = page(t);
  // background-script's beacon: \`await fetch(collect)\`, then \`setTimeout(() => beacon('heartbeat'), interval)\`. The
  // continuation runs outside any counted callback, so the timer is a fresh closure from nowhere each time.
  let beats = 0;
  let stop = false;
  // The third beat is awaited itself: each is scheduled only once the one before answered, so no fixed wait covers three on a busy machine.
  let third: () => void = () => undefined;
  const beatThreeTimes = new Promise<void>((resolve) => { third = resolve; });
  const beacon = (): void => {
    beats += 1;
    if (beats === 3) third();
    const url = `collect?ev=heartbeat&n=${beats}`;
    p.host.fetch(url);
    setTimeout(() => {
      p.answer(`https://kerbfind.test/search/${url}`);
      if (!stop) p.host.setTimeout(() => beacon(), 15);
    }, 2);
  };
  beacon();
  await beatThreeTimes;
  assert.equal(p.busy(), true, "within the horizon of the chain beginning, a beat may still be drawing");
  p.advance(PAGE_WORK_HORIZON_MS);
  assert.equal(p.busy(), false, "a horizon of beats with nothing drawn: the chain holds nothing");
  await later(40);
  assert.equal(p.busy(), false, "and later beats, each a fresh closure, are the same chain");
  stop = true;
  await later(30);
});

test("an animation loop of fresh closures that changes nothing stops holding a horizon after it began (t1094)", async (t) => {
  const p = page(t);
  let frames = 0;
  let stop = false;
  const loop = { tick(): void { frames += 1;
    if (!stop) p.host.requestAnimationFrame(() => loop.tick()); } };
  p.host.requestAnimationFrame(() => loop.tick());
  // Waited for itself, frame by frame: a busy machine draws no frame on a fixed clock.
  while (frames < 2) await later(5);
  assert.equal(p.busy(), true);
  p.advance(PAGE_WORK_HORIZON_MS);
  assert.equal(p.busy(), false);
  stop = true;
  await later(20);
});

test("the same work begun again well after the last ended is new work: a panel opened a second time is waited for (t1094)", async (t) => {
  const p = page(t);
  const open = (): void => { p.host.setTimeout(() => { p.host.fetch("detail.json"); }, 20); };
  open();
  await later(40);
  p.answer("https://kerbfind.test/search/detail.json");
  assert.equal(p.busy(), false);
  p.advance(PAGE_WORK_HORIZON_MS * 5);
  open();
  p.advance(PAGE_WORK_HORIZON_MS * 5);
  assert.equal(p.busy(), true, "a timer that begins new work holds until it has run, however long the clock says");
  await later(40);
  assert.equal(p.busy(), true, "and its request, begun now, holds");
  p.answer("https://kerbfind.test/search/detail.json");
  assert.equal(p.busy(), false);
});

test("a long poll that already went a horizon with nothing drawn stays let go: a later change does not wake it (t1094)", (t) => {
  const p = page(t);
  p.host.fetch("updates.json?since=0&wait=25");
  p.advance(PAGE_WORK_HORIZON_MS);
  assert.equal(p.busy(), false);
  p.mutate();
  p.advance(PAGE_QUIET_WINDOW_MS);
  assert.equal(p.busy(), false, "a sort drawing its results, later, is waited for by its own work alone");
});

test("a beacon chain that was let go stays let go, its later beats included, whatever the page draws (t1094)", (t) => {
  const p = page(t);
  p.host.fetch("collect?n=1");
  p.answer("https://kerbfind.test/search/collect?n=1");
  p.host.fetch("collect?n=2");
  p.advance(PAGE_WORK_HORIZON_MS);
  assert.equal(p.busy(), false);
  p.mutate();
  p.answer("https://kerbfind.test/search/collect?n=2");
  p.host.fetch("collect?n=3");
  p.advance(PAGE_QUIET_WINDOW_MS);
  assert.equal(p.busy(), false, "the next beat is the same chain, already let go");
});

test("a chain that draws between its pieces keeps holding: a change while none of its pieces is out still counts (t1094)", (t) => {
  const p = page(t);
  p.host.fetch("feed.json?batch=1");
  p.advance(PAGE_WORK_HORIZON_MS - 100);
  p.answer("https://kerbfind.test/search/feed.json?batch=1");
  p.advance(50);
  p.mutate();
  p.advance(PAGE_WORK_HORIZON_MS - 200);
  p.host.fetch("feed.json?batch=2");
  p.advance(100);
  assert.equal(p.busy(), true, "the next batch of a feed that drew the last one may be drawing too");
});

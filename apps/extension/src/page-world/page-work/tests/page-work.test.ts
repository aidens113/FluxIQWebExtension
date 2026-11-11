// The page world's count of the work a page schedules for itself (task speed
// S10): timers within the horizon, animation frames, fetches and XHRs, each
// until it is done, with recurring work left out. The two pages it was built
// for are here as the shapes their scripts take: local-classifieds' sort, which
// rewrites the address, waits a short delay and then requests the results; and
// its listing, whose panel is drawn by a timer that requests it. The runner is
// Node: the window, its timers, frames, resource timeline and XHR are stand-ins.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { installPageWorkWatch } from "..";
import { PAGE_WORK_BUSY_EVENT, PAGE_WORK_DRAINED_EVENT, PAGE_WORK_HORIZON_MS, PAGE_WORK_WATCHED_EVENT } from "../../../shared/scheduled-work-event";

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

function page(t: TestContext, options: { hidden?: boolean } = {}) {
  const globals = globalThis as Record<string, unknown>;
  const names = ["window", "chrome", "document", "PerformanceObserver"];
  const previous = Object.fromEntries(names.map((name) => [name, globals[name]]));
  let deliver: (entries: Entry[]) => void = () => undefined;
  class TimelineStandin {
    constructor(private readonly callback: (list: { getEntries(): Entry[] }) => void) {}
    observe(): void { deliver = (entries) => this.callback({ getEntries: () => entries }); }
  }
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
  Object.assign(globals, { window: host, chrome: undefined, document: { baseURI: "https://kerbfind.test/search/", visibilityState: options.hidden ? "hidden" : "visible" }, PerformanceObserver: TimelineStandin });
  t.after(() => { Object.assign(globals, previous); });
  assert.equal(installPageWorkWatch(), true);
  let drained = 0;
  host.addEventListener(PAGE_WORK_DRAINED_EVENT, () => { drained += 1; });
  const asked = (type: string): boolean => !host.dispatchEvent(new Event(type, { cancelable: true }));
  return {
    host, Xhr, fetched,
    busy: () => asked(PAGE_WORK_BUSY_EVENT),
    watched: () => asked(PAGE_WORK_WATCHED_EVENT),
    answer: (url: string) => deliver([{ initiatorType: "fetch", name: url }]),
    drained: () => drained
  };
}

const later = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test("a page world that counts says so, and a page with nothing scheduled is not busy", (t) => {
  const p = page(t);
  assert.equal(p.watched(), true);
  assert.equal(p.busy(), false);
});

test("a timer due within the horizon keeps the page busy until its callback has run; one due later never does", async (t) => {
  const p = page(t);
  p.host.setTimeout((() => undefined), (PAGE_WORK_HORIZON_MS + 500));
  assert.equal(p.busy(), false, "a timer due later is the page acting in its own time");
  p.host.setTimeout((() => undefined), 30);
  assert.equal(p.busy(), true);
  await later(60);
  assert.equal(p.busy(), false);
  assert.equal(p.drained(), 1, "the count falling to none is announced");
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
  hidden.host.requestAnimationFrame((() => undefined));
  assert.equal(hidden.busy(), false, "a hidden document draws no frames");
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

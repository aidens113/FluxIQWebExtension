// Only the press's own requests answer for it (t1094, `../request-starts.ts`): a beacon the page set going before the
// press is not its answer, the press's own fetch is, and a request whose cause cannot be ruled out is the press's, so
// a press that may have landed is never pressed again. The window, its requests, the press-work watch and the origin
// clock's lineages are stand-ins driven directly.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { REQUEST_MARK_EVENT, REQUEST_PENDING_EVENT, REQUEST_SINCE_EVENT } from "../../shared/request-start-event";
import { installRequestStartWatch } from "../request-starts";
import { pressOwners, workOrigins, type PressOwnersReader } from "../work-cause";

class Probe extends Event {
  constructor(type: string, private readonly pressed: EventTarget) { super(type, { cancelable: true }); }
  override composedPath(): EventTarget[] { return [this.pressed]; }
}

type Entry = { initiatorType: string; name: string };

function page(t: TestContext) {
  const globals = globalThis as Record<string, unknown>;
  const names = ["window", "chrome", "XMLHttpRequest", "Navigator", "WebSocket", "document", "PerformanceObserver"];
  const previous = Object.fromEntries(names.map((name) => [name, globals[name]]));
  let deliver: (entries: Entry[]) => void = () => undefined;
  class TimelineStandin {
    constructor(private readonly callback: (list: { getEntries(): Entry[] }) => void) {}
    observe(): void { deliver = (entries) => this.callback({ getEntries: () => entries }); }
  }
  const host = Object.assign(new EventTarget(), { fetch: (..._args: unknown[]) => 1 });
  class Xhr { send(): void {} }
  class NavigatorStandin { sendBeacon(): boolean { return true; } }
  class Socket { send(): void {} }
  Object.assign(globals, {
    window: host, chrome: undefined, XMLHttpRequest: Xhr, Navigator: NavigatorStandin, WebSocket: Socket,
    document: { baseURI: "https://kerbfind.test/search/" }, PerformanceObserver: TimelineStandin
  });
  // The press-work watch, as it registers itself: the armed press's mark, and whose work is running.
  const pressed = new EventTarget();
  const ownMark = {};
  let running: readonly object[] = [];
  let followed = true;
  const reader: PressOwnersReader = { owners: () => running, markOf: (target) => (target === pressed ? ownMark : undefined), followed: () => followed };
  pressOwners.register(reader);
  t.after(() => {
    Object.assign(globals, previous);
    pressOwners.register({ owners: () => [], markOf: () => undefined, followed: () => false });
  });
  assert.equal(installRequestStartWatch(), true);
  const ask = (name: string): boolean => !host.dispatchEvent(new Probe(name, pressed));
  return {
    host,
    mark: () => assert.equal(ask(REQUEST_MARK_EVENT), true),
    since: () => ask(REQUEST_SINCE_EVENT),
    pending: () => ask(REQUEST_PENDING_EVENT),
    /** Runs `run` as the armed press's own work (its click handler, or what that handler chained into). */
    asPress: (run: () => void) => { running = [ownMark];
      try { run(); } finally { running = []; } },
    /** Runs `run` as another armed press's work. */
    asOtherPress: (run: () => void) => { running = [{}];
      try { run(); } finally { running = []; } },
    setFollowed: (value: boolean) => { followed = value; },
    answer: (url: string) => deliver([{ initiatorType: "fetch", name: url }])
  };
}

test("a beacon from a timer loop set going before the press is not its answer; the press's own fetch is", (t) => {
  const p = page(t);
  // The beacon's loop was scheduled before the press: its lineage's origin is older than the mark.
  const beaconLoop = workOrigins.scheduled();
  p.mark();
  workOrigins.enter(beaconLoop, () => { p.host.fetch("https://kerbfind.test/search/collect?ev=heartbeat&n=7", { method: "POST", keepalive: true }); });
  assert.equal(p.since(), false, "the beacon began inside the press's window, and is not the press reaching the server");
  assert.equal(p.pending(), false, "nor is it a request of the press's still out");
  p.asPress(() => { p.host.fetch("https://kerbfind.test/api/save", { method: "POST" }); });
  assert.equal(p.since(), true, "the press's own fetch answers for it");
  assert.equal(p.pending(), true);
  p.answer("https://kerbfind.test/api/save");
  assert.equal(p.pending(), false, "and once it answered, the press's requests are all in");
});

test("a request whose cause cannot be ruled out is the press's: a press that may have landed is never pressed again", (t) => {
  const p = page(t);
  p.mark();
  // A promise continuation, an event, a message: nothing says who began it.
  p.host.fetch("https://kerbfind.test/api/offer", { method: "POST" });
  assert.equal(p.since(), true);
});

test("the press's own work counts even when it runs inside a lineage older than the press", (t) => {
  const p = page(t);
  const older = workOrigins.scheduled();
  p.mark();
  workOrigins.enter(older, () => p.asPress(() => { p.host.fetch("https://kerbfind.test/api/save", { method: "POST" }); }));
  assert.equal(p.since(), true);
});

test("another press's work is not this press's answer", (t) => {
  const p = page(t);
  p.mark();
  p.asOtherPress(() => { p.host.fetch("https://kerbfind.test/api/other", { method: "POST" }); });
  assert.equal(p.since(), false);
});

test("a GET the page's background already asked for is that background running on, but only while the press was wholly followed", (t) => {
  const p = page(t);
  // The beacon before the press, begun outside any armed press's work.
  p.host.fetch("https://kerbfind.test/search/collect?ev=page_view&n=1");
  p.mark();
  // Its next beat, scheduled from the last answer's continuation after the mark: no lineage says where it came from.
  p.host.fetch("https://kerbfind.test/search/collect?ev=heartbeat&n=2");
  assert.equal(p.since(), false, "the same GET address the background asked for before the press");
  p.setFollowed(false);
  assert.equal(p.since(), true, "a press whose work was not wholly followed (an async handler) may have begun it");
});

test("a request that can change something is never excused by an address the background asked for", (t) => {
  const p = page(t);
  p.host.fetch("https://kerbfind.test/api/cart");
  p.mark();
  p.host.fetch("https://kerbfind.test/api/cart", { method: "POST" });
  assert.equal(p.since(), true, "a POST to the polled address may be the press adding to the cart");
});

test("a new GET address with no known cause is the press's", (t) => {
  const p = page(t);
  p.host.fetch("https://kerbfind.test/search/collect?n=1");
  p.mark();
  p.host.fetch("https://kerbfind.test/search/feed.json?batch=1");
  assert.equal(p.since(), true);
});

test("an XHR, a sendBeacon and a socket message with no known cause are the press's; begun in an older loop they are not", (t) => {
  const p = page(t);
  const loop = workOrigins.scheduled();
  p.mark();
  workOrigins.enter(loop, () => {
    new (globalThis as unknown as { XMLHttpRequest: new () => { send(): void } }).XMLHttpRequest().send();
    new (globalThis as unknown as { WebSocket: new () => { send(): void } }).WebSocket().send();
  });
  assert.equal(p.since(), false);
  assert.equal(p.pending(), false, "a socket message of the page's own loop is not a press's request still out");
  new (globalThis as unknown as { WebSocket: new () => { send(): void } }).WebSocket().send();
  assert.equal(p.since(), true);
  assert.equal(p.pending(), true, "a socket message no one can place may be the press's, and never answers");
});

test("a fetch method the page wrote as an accessor is never called, and that request stays counted", (t) => {
  const p = page(t);
  p.host.fetch("https://kerbfind.test/api/cart");
  p.mark();
  let reads = 0;
  p.host.fetch("https://kerbfind.test/api/cart", { get method() { reads += 1;
    return "GET"; } });
  assert.equal(reads, 0, "the page world ran none of the page's code");
  assert.equal(p.since(), true, "a method it could not read may change something");
});

test("a Request's own method is read: a GET Request to the background's address is that background", (t) => {
  const p = page(t);
  p.host.fetch("https://kerbfind.test/search/collect?n=1");
  p.mark();
  p.host.fetch(new Request("https://kerbfind.test/search/collect?n=2"));
  assert.equal(p.since(), false);
  p.host.fetch(new Request("https://kerbfind.test/search/collect?n=3", { method: "POST" }));
  assert.equal(p.since(), true);
});

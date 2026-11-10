// Whether the requests a press began have answered (task speed S10): a fetch
// when its resource entry arrives, an XMLHttpRequest at its own `loadend`, a
// beacon never awaited, a WebSocket message never told. The content script
// asks by dispatching REQUEST_PENDING_EVENT on the marked element, and each
// answer is announced on `window` as REQUEST_ANSWERED_EVENT; a window.open call
// is announced as WINDOW_OPEN_EVENT. The runner is Node: the window, the
// resource timeline and the request classes are stand-ins.

import assert from "node:assert/strict";
import test from "node:test";
import { installRequestStartWatch } from "../request-starts";
import { installWindowOpenWatch } from "../window-opens";
import { REQUEST_ANSWERED_EVENT, REQUEST_MARK_EVENT, REQUEST_PENDING_EVENT, WINDOW_OPEN_EVENT } from "../../shared/request-start-event";

class Probe extends Event {
  constructor(type: string, private readonly pressed: EventTarget) { super(type, { cancelable: true }); }
  override composedPath(): EventTarget[] { return [this.pressed]; }
}

type Entry = { initiatorType: string; name: string };

function page() {
  const globals = globalThis as Record<string, unknown>;
  const names = ["window", "chrome", "document", "XMLHttpRequest", "Navigator", "WebSocket", "PerformanceObserver"];
  const previous = Object.fromEntries(names.map((name) => [name, globals[name]]));
  let deliver: (entries: Entry[]) => void = () => undefined;
  class TimelineStandin {
    constructor(private readonly callback: (list: { getEntries(): Entry[] }) => void) {}
    observe(): void { deliver = (entries) => this.callback({ getEntries: () => entries }); }
  }
  const opened: unknown[] = [];
  const host = Object.assign(new EventTarget(), { fetch: (_input?: unknown) => "response", open: (...args: unknown[]) => { opened.push(args);
    return "the new window"; } });
  class Xhr extends EventTarget { send(): void {} }
  class NavigatorStandin { sendBeacon(): boolean { return true; } }
  class Socket { send(): void {} }
  Object.assign(globals, { window: host, chrome: undefined, document: { baseURI: "https://shop.test/cart/" }, XMLHttpRequest: Xhr, Navigator: NavigatorStandin, WebSocket: Socket, PerformanceObserver: TimelineStandin });
  assert.equal(installRequestStartWatch(), true);
  const pressed = new EventTarget();
  let answers = 0;
  let opens = 0;
  host.addEventListener(REQUEST_ANSWERED_EVENT, () => { answers += 1; });
  host.addEventListener(WINDOW_OPEN_EVENT, () => { opens += 1; });
  return {
    host, Xhr, NavigatorStandin, Socket, pressed, opened,
    mark: () => host.dispatchEvent(new Probe(REQUEST_MARK_EVENT, pressed)),
    pending: (): boolean => !host.dispatchEvent(new Probe(REQUEST_PENDING_EVENT, pressed)),
    resource: (entries: Entry[]) => deliver(entries),
    answers: () => answers,
    opens: () => opens,
    restore: () => Object.assign(globals, previous)
  };
}

test("a press's fetch is pending until its resource entry arrives, and its answer is announced", () => {
  const p = page();
  try {
    p.host.fetch("/before");
    p.mark();
    assert.equal(p.pending(), false, "a request begun before the mark is not the press's");
    p.host.fetch("../save?listing=1");
    assert.equal(p.pending(), true);
    p.resource([{ initiatorType: "img", name: "https://shop.test/save?listing=1" }, { initiatorType: "fetch", name: "https://shop.test/elsewhere" }]);
    assert.equal(p.pending(), true, "another resource is not its answer");
    p.resource([{ initiatorType: "fetch", name: "https://shop.test/save?listing=1" }]);
    assert.equal(p.pending(), false);
    assert.equal(p.answers(), 1);
  } finally { p.restore(); }
});

test("an XMLHttpRequest is pending until its own loadend", () => {
  const p = page();
  try {
    p.mark();
    const request = new p.Xhr();
    request.send();
    assert.equal(p.pending(), true);
    request.dispatchEvent(new Event("loadend"));
    assert.equal(p.pending(), false);
    assert.equal(p.answers(), 1);
  } finally { p.restore(); }
});

test("a beacon is never awaited, and a WebSocket message is never told answered", () => {
  const p = page();
  try {
    p.mark();
    new p.NavigatorStandin().sendBeacon();
    assert.equal(p.pending(), false);
    new p.Socket().send();
    assert.equal(p.pending(), true);
    p.mark();
    assert.equal(p.pending(), false, "a message sent before the next mark is not that press's");
  } finally { p.restore(); }
});

test("a window.open call is announced before it is made, and answers what the page's own would", () => {
  const p = page();
  try {
    assert.equal(installWindowOpenWatch(), true);
    const result = (p.host as unknown as { open: (...args: unknown[]) => unknown }).open("/compare", "_blank");
    assert.equal(result, "the new window");
    assert.deepEqual(p.opened, [["/compare", "_blank"]]);
    assert.equal(p.opens(), 1);
  } finally { p.restore(); }
});

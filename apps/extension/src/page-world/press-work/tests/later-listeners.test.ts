// A listener for another event that a press's own work registers stops the press being followed only when its event
// fires, on a target the window hears (t1094): local-classifieds' radius picker re-wires its Apply on the first
// press, and that alone made every such press unknown. Anything the window may not hear is unknown at once, as before.
// The window, the document, nodes and the shadow root are stand-ins.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { watchLaterListeners } from "../later-listeners";
import { createPressWorkTracker } from "../tracker";

class PathEvent extends Event {
  constructor(type: string, private readonly path: EventTarget[]) { super(type); }
  override composedPath(): EventTarget[] { return this.path; }
}

function page(t: TestContext) {
  const globals = globalThis as Record<string, unknown>;
  const names = ["window", "document", "Node", "ShadowRoot"];
  const previous = Object.fromEntries(names.map((name) => [name, globals[name]]));
  const view = new EventTarget();
  const doc = new EventTarget();
  class ShadowRootStandin extends EventTarget {
    constructor(readonly mode: "open" | "closed", readonly host: NodeStandin) { super(); }
  }
  class NodeStandin extends EventTarget {
    constructor(readonly isConnected: boolean, private readonly root: unknown = doc) { super(); }
    getRootNode(): unknown { return this.root; }
  }
  Object.assign(globals, { window: view, document: doc, Node: NodeStandin, ShadowRoot: ShadowRootStandin });
  t.after(() => { Object.assign(globals, previous); });
  const tracker = createPressWorkTracker();
  const later = watchLaterListeners(tracker, EventTarget.prototype.addEventListener);
  const pressed = new EventTarget();
  tracker.arm(pressed);
  const click = new PathEvent("click", [pressed]);
  tracker.capture(click, true);
  /** Registers a `type` listener on `target` from inside the press's own click handler. */
  const registerFromPress = (target: EventTarget, type: string): void => {
    tracker.run(tracker.forEvent(click), () => later.registered(target, type, tracker.current()));
  };
  return { view, doc, tracker, pressed, registerFromPress, NodeStandin, ShadowRootStandin };
}

test("a keydown listener the press re-wires leaves the press followed until a keydown reaches it", (t) => {
  const p = page(t);
  const button = new p.NodeStandin(true);
  p.registerFromPress(button, "keydown");
  assert.equal(p.tracker.state(p.pressed), "idle", "nothing it registered can have run");
  p.view.dispatchEvent(new PathEvent("keydown", [new p.NodeStandin(true), p.doc, p.view]));
  assert.equal(p.tracker.state(p.pressed), "idle", "a keydown elsewhere is not its listener running");
  p.view.dispatchEvent(new PathEvent("keydown", [button, p.doc, p.view]));
  assert.equal(p.tracker.state(p.pressed), "unknown", "its listener is about to run outside the followed work");
});

test("a listener on the window or the document is followed the same way", (t) => {
  const p = page(t);
  p.registerFromPress(p.doc, "scroll");
  assert.equal(p.tracker.state(p.pressed), "idle");
  p.view.dispatchEvent(new PathEvent("scroll", [p.doc, p.view]));
  assert.equal(p.tracker.state(p.pressed), "unknown");
});

test("a target the window may not hear makes the press unknown at once", (t) => {
  for (const make of [
    (p: ReturnType<typeof page>) => new p.NodeStandin(false),
    (p: ReturnType<typeof page>) => new EventTarget(),
    (p: ReturnType<typeof page>) => {
      const host = new p.NodeStandin(true);
      return new p.NodeStandin(true, new p.ShadowRootStandin("closed", host));
    }
  ]) {
    const p = page(t);
    p.registerFromPress(make(p), "keydown");
    assert.equal(p.tracker.state(p.pressed), "unknown");
  }
});

test("a node in an open shadow root is heard, and a listener for leaving the page is unknown at once", (t) => {
  const p = page(t);
  const host = new p.NodeStandin(true);
  p.registerFromPress(new p.NodeStandin(true, new p.ShadowRootStandin("open", host)), "keydown");
  assert.equal(p.tracker.state(p.pressed), "idle");
  p.registerFromPress(p.view, "unload");
  assert.equal(p.tracker.state(p.pressed), "unknown", "the window never listens for unload itself");
});

test("work outside any press registers freely", (t) => {
  const p = page(t);
  p.tracker.run([], () => undefined);
  const before = p.tracker.state(p.pressed);
  EventTarget.prototype.addEventListener.call(new EventTarget(), "keydown", () => undefined);
  assert.equal(p.tracker.state(p.pressed), before);
});

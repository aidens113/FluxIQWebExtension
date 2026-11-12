import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { PRESS_BINDING_MARK_EVENT, PRESS_BINDING_RELEASE_EVENT, PRESS_BINDING_SINCE_EVENT, PRESS_PROBE_EVENT } from "../../shared/press-probe-event";
import { installPressListenerWatch } from "../press-listeners";

function page(t: TestContext) {
  const globals = globalThis as Record<string, unknown>;
  const names = ["window", "document", "chrome", "Element", "HTMLElement"];
  const before = Object.fromEntries(names.map(name => [name, globals[name]]));
  const add = EventTarget.prototype.addEventListener;
  class PageElement extends EventTarget {
    private assigned: unknown = null;
    get onclick(): unknown { return this.assigned; }
    set onclick(value: unknown) { this.assigned = value; }
  }
  const host = new EventTarget();
  const doc = { body: new PageElement(), documentElement: new PageElement() };
  Object.assign(globals, { window: host, document: doc, chrome: undefined, Element: PageElement, HTMLElement: PageElement });
  t.after(() => {
    EventTarget.prototype.addEventListener = add;
    Object.assign(globals, before);
  });
  assert.equal(installPressListenerWatch(), true);
  const query = (kind: string, target: EventTarget, ancestors: EventTarget[] = [], token = "first") => {
    const probe = new CustomEvent(kind, { cancelable: true, detail: token });
    probe.composedPath = () => [target, ...ancestors];
    return !host.dispatchEvent(probe);
  };
  return {
    PageElement,
    bound: (target: EventTarget) => query(PRESS_PROBE_EVENT, target),
    mark: (target: EventTarget, token?: string) => query(PRESS_BINDING_MARK_EVENT, target, [], token),
    added: (target: EventTarget, ancestors?: EventTarget[], token?: string) => query(PRESS_BINDING_SINCE_EVENT, target, ancestors, token),
    release: (target: EventTarget, token?: string) => query(PRESS_BINDING_RELEASE_EVENT, target, [], token)
  };
}

test("a property-assigned onclick binds the control even without an inline attribute", t => {
  const p = page(t);
  const control = new p.PageElement();
  assert.equal(p.bound(control), false);
  control.onclick = () => undefined;
  assert.equal(p.bound(control), true);
});

test("any supported press gesture can bind a control or its delegated ancestor", t => {
  const p = page(t);
  for (const kind of ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend"]) {
    const ancestor = new p.PageElement();
    ancestor.addEventListener(kind, () => undefined);
    assert.equal(p.bound(ancestor), true, kind);
  }
});

test("removed listener history stays available to capture but cannot satisfy a fresh readiness mark", t => {
  const p = page(t);
  const control = new p.PageElement();
  const listener = () => undefined;
  control.addEventListener("click", listener);
  control.removeEventListener("click", listener);
  assert.equal(p.bound(control), true, "capture's historical contract is unchanged");
  assert.equal(p.mark(control), true);
  assert.equal(p.added(control), false);
  control.addEventListener("click", listener);
  assert.equal(p.added(control), true, "only the new binding releases this readiness observation");
});

test("fresh scoped and property-assigned bindings are visible, while unrelated bindings are not", t => {
  const p = page(t);
  const control = new p.PageElement();
  const parent = new p.PageElement();
  p.mark(control);
  new p.PageElement().addEventListener("pointerdown", () => undefined);
  assert.equal(p.added(control, [parent]), false);
  parent.addEventListener("pointerdown", () => undefined);
  assert.equal(p.added(control, [parent]), true);
  p.mark(control);
  control.onclick = () => undefined;
  assert.equal(p.added(control), true);
});

test("same-element readiness marks are independent and releasing one preserves the other", t => {
  const p = page(t);
  const control = new p.PageElement();
  p.mark(control, "early");
  control.addEventListener("click", () => undefined);
  p.mark(control, "late");
  assert.equal(p.added(control, [], "early"), true);
  assert.equal(p.added(control, [], "late"), false);
  p.release(control, "early");
  assert.equal(p.added(control, [], "early"), false);
  assert.equal(p.added(control, [], "late"), false);
  control.onclick = () => undefined;
  assert.equal(p.added(control, [], "late"), true);
  p.release(control, "late");
  assert.equal(p.added(control, [], "late"), false);
});

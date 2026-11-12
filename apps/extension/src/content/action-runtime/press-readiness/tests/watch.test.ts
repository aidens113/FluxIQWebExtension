import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { PAGE_WORK_PENDING_EVENT, PAGE_WORK_WATCHED_EVENT } from "../../../../shared/scheduled-work-event";
import { PRESS_BINDING_MARK_EVENT, PRESS_BINDING_RELEASE_EVENT, PRESS_BINDING_SINCE_EVENT, PRESS_PROBE_EVENT } from "../../../../shared/press-probe-event";
import { markPressBinding, watchPressReadiness } from "..";
import { watchIgnoredPress } from "../../ignored-press";

type BindingPath = { generation: number; parentElement: BindingPath | null };

function page() {
  const state = { watched: true, pending: true, generation: 0 };
  const view = new EventTarget();
  view.addEventListener(PAGE_WORK_WATCHED_EVENT, event => { if (state.watched) event.preventDefault(); });
  view.addEventListener(PAGE_WORK_PENDING_EVENT, event => { if (state.pending) event.preventDefault(); });
  const doc = { defaultView: view, body: null, documentElement: null };
  const element = () => ({
    ownerDocument: doc, parentElement: null as Element | null, parentNode: null,
    tagName: "BUTTON", type: "button", form: null as object | null, isConnected: true,
    bound: false, inline: "", generation: 0, marks: new Map<string, number>(),
    bind() { this.bound = true;
      this.generation = ++state.generation; },
    closest() { return this; },
    hasAttribute(name: string) { return this.inline === name; },
    dispatchEvent(event: Event) {
      const token = (event as CustomEvent<string>).detail;
      if (event.type === PRESS_BINDING_MARK_EVENT) { this.marks.set(token, state.generation);
        return false; }
      if (event.type === PRESS_BINDING_RELEASE_EVENT) this.marks.delete(token);
      if (event.type === PRESS_BINDING_SINCE_EVENT) {
        const marked = this.marks.get(token);
        for (let target: BindingPath | null = this as unknown as BindingPath; target; target = target.parentElement) {
          if (marked !== undefined && target.generation > marked) return false;
        }
      }
      return event.type !== PRESS_PROBE_EVENT || !this.bound;
    }
  });
  return { state, element };
}

test("binding the command ends its readiness wait even with unrelated one-shot work outstanding", () => {
  const p = page();
  const button = p.element();
  const watch = watchPressReadiness(button as unknown as Element);
  assert.ok(watch);
  assert.equal(watch.pending(), true);
  button.bind();
  assert.equal(watch.pending(), false);
  assert.equal(p.state.pending, true);
});

test("two overlapping watches on one control retain their own baselines and release only their own mark", () => {
  const p = page();
  const button = p.element();
  const early = markPressBinding(button as unknown as Element)!;
  button.bind();
  const late = markPressBinding(button as unknown as Element)!;
  assert.equal(early.added(), true);
  assert.equal(late.added(), false);
  assert.equal(button.marks.size, 2);
  early.stop();
  assert.equal(button.marks.size, 1);
  assert.equal(late.added(), false);
  button.bind();
  assert.equal(late.added(), true);
  late.stop();
  late.stop();
  assert.equal(button.marks.size, 0);
});

test("a new scoped delegated binding ends observation, and inline gesture handlers need no hydration observation", () => {
  const p = page();
  const button = p.element();
  const parent = p.element();
  button.parentElement = parent as unknown as Element;
  const watch = watchPressReadiness(button as unknown as Element)!;
  assert.equal(watch.pending(), true);
  parent.bind();
  assert.equal(watch.pending(), false);
  button.parentElement = null;
  button.inline = "onpointerdown";
  assert.equal(watchPressReadiness(button as unknown as Element)?.pending(), false);
});

test("a historical handler removed before delayed rebind cannot release the extra press early", () => {
  const p = page();
  const button = p.element();
  button.bind();
  // Capture deliberately remembers this registration even after its removal.
  const watch = watchPressReadiness(button as unknown as Element)!;
  assert.equal(button.bound, true);
  assert.equal(watch.pending(), true, "old registration history is not fresh readiness evidence");
  button.bind();
  assert.equal(watch.pending(), false);
});

test("a silent old binding with unrelated one-shot work stays observed until that known work drains", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 0 });
  const p = page();
  const button = p.element();
  button.bind();
  const readiness = watchPressReadiness(button as unknown as Element)!;
  const answerWatch = watchIgnoredPress(button as unknown as Element, () => ({ flush: () => undefined, stop: () => undefined }), () => ({ settle: async () => false, stop: () => undefined }));
  let finished = false;
  const result = answerWatch.settle(800, { pending: readiness.pending, remainingMs: () => 5_000 - Date.now() }).then(answer => { finished = true;
    return answer; });
  t.mock.timers.tick(800);
  await setImmediate();
  assert.equal(finished, false);
  p.state.pending = false;
  t.mock.timers.tick(50);
  const answer = await result;
  assert.deepEqual(answer.seen, []);
  assert.equal(answer.readinessTimedOut, undefined);
  answerWatch.stop();
});

test("native activation needs no page listener while a script-only button still can be unbound", () => {
  const p = page();
  const control = p.element();
  const pending = () => watchPressReadiness(control as unknown as Element)?.pending();
  control.type = "submit";
  control.form = {};
  assert.equal(pending(), false);
  control.type = "button";
  assert.equal(pending(), true);
  control.tagName = "INPUT";
  for (const type of ["submit", "reset", "image"]) {
    control.type = type;
    control.form = null;
    assert.equal(pending(), true, `${type} without a form needs a page handler`);
    control.form = {};
    assert.equal(pending(), false);
  }
  control.type = "checkbox";
  assert.equal(pending(), false);
  control.tagName = "A";
  assert.equal(pending(), false);
});

test("missing observation, drained work, and a detached target never invent pending hydration", () => {
  const p = page();
  const button = p.element();
  p.state.watched = false;
  assert.equal(watchPressReadiness(button as unknown as Element), undefined);
  p.state.watched = true;
  const watch = watchPressReadiness(button as unknown as Element)!;
  p.state.pending = false;
  assert.equal(watch.pending(), false);
  p.state.pending = true;
  button.isConnected = false;
  assert.equal(watch.pending(), false);
});

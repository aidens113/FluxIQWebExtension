// Whether the server has answered a press (task speed S10): only a press that
// began a request, all of whose requests have answered, on a page world whose
// wrappers are intact, reads as answered; each answer is announced on the
// pressed element's window.

import assert from "node:assert/strict";
import test from "node:test";
import { REQUEST_ANSWERED_EVENT } from "../../../../shared/request-start-event";
import { watchPressAnswered } from "../request-answers";

function pressed(view: EventTarget): Element {
  return { ownerDocument: { defaultView: view } } as unknown as Element;
}

test("answered only once a request began, every one answered, and the page world is healthy", () => {
  const state = { begun: false, pending: false, healthy: true };
  const mark = { begunSince: () => state.begun, pendingSince: () => state.pending, healthy: () => state.healthy };
  const watch = watchPressAnswered(pressed(new EventTarget()), mark)!;
  assert.equal(watch.answered(), false, "no request began");
  state.begun = true;
  state.pending = true;
  assert.equal(watch.answered(), false, "one is still out");
  state.pending = false;
  assert.equal(watch.answered(), true);
  state.healthy = false;
  assert.equal(watch.answered(), false, "a page world the page tampered with says nothing");
});

test("each answer is announced to a listener until it stops listening, and a page world that cannot say gives no watch", () => {
  const view = new EventTarget();
  const watch = watchPressAnswered(pressed(view), { begunSince: () => true, pendingSince: () => false, healthy: () => true })!;
  let heard = 0;
  const stop = watch.onAnswer(() => { heard += 1; });
  view.dispatchEvent(new Event(REQUEST_ANSWERED_EVENT));
  stop();
  view.dispatchEvent(new Event(REQUEST_ANSWERED_EVENT));
  assert.equal(heard, 1);
  assert.equal(watchPressAnswered(pressed(view), { begunSince: () => true }), undefined, "an older mark cannot tell pending");
  assert.equal(watchPressAnswered(pressed(view), undefined), undefined, "no page world");
});

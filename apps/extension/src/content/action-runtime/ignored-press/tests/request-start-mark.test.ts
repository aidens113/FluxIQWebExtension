// T1 coverage of the content-script half of the request-start probe
// (`request-start-mark.ts`, t465). The page world is faked at the one thing the
// content script sees of it: whether it cancels the events dispatched on the
// pressed element. The page-world half runs for real in the T2 harness
// (`e2e/content/tests/press-answers/tests/lasting-press-once.spec.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { REQUEST_MARK_EVENT, REQUEST_SINCE_EVENT } from "../../../../shared/request-start-event";
import { markRequestStarts } from "../request-start-mark";

/** An element whose `dispatchEvent` is answered as the page world would: by counting requests and cancelling. */
function pressedElement(pageWorld: boolean) {
  const world = { begun: 0, mark: undefined as number | undefined, dispatched: [] as string[] };
  const element = {
    dispatchEvent(event: Event) {
      world.dispatched.push(event.type);
      assert.equal(event.cancelable, true, "the answer is the cancellation, so the event must be cancelable");
      if (!pageWorld) return true;
      if (event.type === REQUEST_MARK_EVENT) {
        world.mark = world.begun;
        return false;
      }
      if (event.type === REQUEST_SINCE_EVENT) return !(world.mark !== undefined && world.begun > world.mark);
      return true;
    }
  };
  return { element: element as unknown as Element, world };
}

test("a mark the page world answered says whether a request began since it", () => {
  const { element, world } = pressedElement(true);
  world.begun = 4;
  const mark = markRequestStarts(element);
  assert.ok(mark);
  assert.equal(mark.begunSince(), false, "the four begun before the mark are not counted");
  world.begun += 1;
  assert.equal(mark.begunSince(), true);
  assert.deepEqual(world.dispatched, [REQUEST_MARK_EVENT, REQUEST_SINCE_EVENT, REQUEST_SINCE_EVENT]);
});

test("where no page world answers the mark, there is no mark, and requests are read from the timeline alone", () => {
  const { element, world } = pressedElement(false);
  assert.equal(markRequestStarts(element), undefined);
  assert.deepEqual(world.dispatched, [REQUEST_MARK_EVENT]);
});

test("an element that cannot dispatch events has no mark", () => {
  assert.equal(markRequestStarts({} as Element), undefined);
});

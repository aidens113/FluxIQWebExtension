// The click verb reports what a press made in place changed about its own
// control (t787): read from the control just before and just after the press,
// derived by the domain's signature (`actions/toggle-signature/`), and carried
// on the result as `toggle`. A Flow's press in a trial is how Core learns a
// step's control is a toggle when the build never pressed it while exploring;
// before this, only an explored press said so, and a looped step on a control
// first pressed by a trial was saved as a plain press that flipped every item
// back on its second run. The faked page and watches are `click/`'s.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { DomElementDescriptor } from "../../../../../shared/protocol";
import type { BrowserActionCommand } from "../../../../types";
import { clickAction } from "../../../click";
import { dependencies, fakeCheckWatch, fakeIgnoredWatch, fakeNoticeWatch, fakePage, fakeWatch, installMouseEvent, CLICK, FIRST_PRESS } from "..";

/** The control's state before the press, and what the press makes it. */
type Control = { attributes: Record<string, string>; name: string };

async function press(t: TestContext, before: Control, after: Control, options: { moveTo?: string; action?: BrowserActionCommand } = {}) {
  installMouseEvent(t);
  const page = fakePage({ link: false, prevent: false, ...(options.moveTo ? { moveTo: options.moveTo } : {}) });
  let state = before;
  const element = page.element as unknown as { getAttribute: (key: string) => string | null; dispatchEvent: (event: { type: string }) => boolean };
  element.getAttribute = (key) => state.attributes[key] ?? null;
  const dispatch = element.dispatchEvent.bind(element);
  element.dispatchEvent = (event) => {
    const answered = dispatch(event);
    if (event.type === "click") state = after;
    return answered;
  };
  const deps = dependencies(page.element, fakeWatch(undefined, page.events).make, fakeNoticeWatch(undefined, page.events), fakeCheckWatch(undefined, page.events), fakeIgnoredWatch(["change"], page.events), true);
  deps.describeElement = () => ({ name: state.name }) as DomElementDescriptor;
  const result = await clickAction(options.action ?? CLICK, deps, 1_000);
  return { result, events: page.events };
}

test("a press that flips the control's stated state reports that state as its toggle", async (t) => {
  const { result, events } = await press(t, { attributes: { "aria-pressed": "false" }, name: "Like" }, { attributes: { "aria-pressed": "true" }, name: "Like" });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, FIRST_PRESS);
  assert.deepEqual(result.toggle, { via: "attribute", attribute: "aria-pressed", to: true });
});

test("a press that changes only the control's name reports the words it gained and lost", async (t) => {
  const { result } = await press(t, { attributes: {}, name: "Like" }, { attributes: {}, name: "Unlike" });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.toggle, { via: "name", gains: ["unlike"], loses: ["like"] });
});

test("a press given ensureState that was not yet shown is pressed, and reports its toggle too", async (t) => {
  const action = { ...CLICK, ensureState: { via: "name", gains: ["unlike"], loses: ["like"] } } as BrowserActionCommand;
  const { result, events } = await press(t, { attributes: {}, name: "Like" }, { attributes: {}, name: "Unlike" }, { action });
  assert.equal(result.skipped, undefined);
  assert.deepEqual(events, FIRST_PRESS);
  assert.deepEqual(result.toggle, { via: "name", gains: ["unlike"], loses: ["like"] });
});

test("a press that changes nothing about its control reports no toggle", async (t) => {
  const { result } = await press(t, { attributes: { class: "card" }, name: "Open" }, { attributes: { class: "card" }, name: "Open" });
  assert.equal(result.status, "succeeded");
  assert.equal(Object.hasOwn(result, "toggle"), false);
});

test("a press after which the page is at another address reports no toggle, whatever its control now says", async (t) => {
  const { result } = await press(t, { attributes: {}, name: "Like" }, { attributes: {}, name: "Unlike" }, { moveTo: "http://127.0.0.1:4000/elsewhere/" });
  assert.equal(Object.hasOwn(result, "toggle"), false);
});

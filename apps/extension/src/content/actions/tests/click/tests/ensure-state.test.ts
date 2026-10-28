// The click verb's `ensureState` (t775): a target that already shows the
// signature a press produced earlier is not pressed, and the step answers
// success with `skipped: "already_in_state"`. Any other target is pressed as
// before. The faked page and watches are `click/`'s.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { DomElementDescriptor } from "../../../../../shared/protocol";
import type { BrowserActionCommand } from "../../../../types";
import { clickAction } from "../../../click";
import { dependencies, fakeCheckWatch, fakeIgnoredWatch, fakeNoticeWatch, fakePage, fakeWatch, installMouseEvent, CLICK, FIRST_PRESS } from "..";

async function press(t: TestContext, attributes: Record<string, string>, name: string, action: BrowserActionCommand) {
  installMouseEvent(t);
  const page = fakePage({ link: false, prevent: false });
  (page.element as unknown as { getAttribute: (key: string) => string | null }).getAttribute = (key) => attributes[key] ?? null;
  const deps = dependencies(page.element, fakeWatch(undefined, page.events).make, fakeNoticeWatch(undefined, page.events), fakeCheckWatch(undefined, page.events), fakeIgnoredWatch(["change"], page.events), true);
  deps.describeElement = () => ({ name }) as DomElementDescriptor;
  const result = await clickAction(action, deps, 1_000);
  return { result, events: page.events };
}

test("a target that already shows the aria-pressed state is not pressed, and answers skipped already_in_state", async (t) => {
  const action = { ...CLICK, ensureState: { via: "attribute", attribute: "aria-pressed", to: true } } as BrowserActionCommand;
  const { result, events } = await press(t, { "aria-pressed": "true" }, "Like", action);
  assert.equal(result.status, "succeeded");
  assert.equal(result.skipped, "already_in_state");
  assert.deepEqual(events, []);
});

test("a name-only toggle that already has the gained words and none of the lost is skipped; one that has not is pressed", async (t) => {
  const action = { ...CLICK, ensureState: { via: "name", gains: ["unsave"], loses: ["save"] } } as BrowserActionCommand;
  const shown = await press(t, {}, "Unsave Product Designer", action);
  assert.equal(shown.result.skipped, "already_in_state");
  assert.deepEqual(shown.events, []);
  const absent = await press(t, {}, "Save Product Designer", action);
  assert.equal(absent.result.skipped, undefined);
  assert.deepEqual(absent.events, FIRST_PRESS);
});

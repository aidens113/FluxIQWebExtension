// The click verb with a misclick first (W2 H4, `click.ts` header,
// `action-runtime/humanness/misclick/before.ts`). On a command Core marked,
// above humanness 0, one misclick lands on an inert point beside the target,
// and the press that follows is exactly the press the same command makes
// without the mark: the same events at the same point. At level 0, or
// unmarked, the click is today's, with no added read of the page.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { ActionabilityReport } from "../../../../action-runtime";
import { misclickChance, misclickRandom } from "../../../../action-runtime/humanness";
import { FakePage, installPageGlobals, type FakeEvent } from "../../../../action-runtime/humanness/misclick/tests/fake-page";
import type { BrowserActionCommand } from "../../../../types";
import { clickAction } from "../../../click";
import { CLICK, dependencies, fakeCheckWatch, fakeIgnoredWatch, fakeNoticeWatch, fakeWatch } from "..";

const TARGET_BOX = { left: 400, top: 300, right: 520, bottom: 340 };
const AT_CENTRE: ActionabilityReport = { actionable: true, point: { x: 460, y: 320 }, detail: "the point 460,320 landed on the target" };
const GESTURE = ["mouseover", "mouseenter", "mousemove", "mousedown", "mouseup", "click"];

/** A command id whose misclick draw falls under the chance at 100. */
function misclickingId(): string {
  for (let index = 0; index < 10_000; index += 1) {
    const id = `cmd-click-${index}`;
    if (misclickRandom(id)() < misclickChance(1)) return id;
  }
  throw new Error("no command id found");
}
const MISCLICKS = misclickingId();

/** One click on a button inside a plain content block, with the click harness's watches. */
async function clickOnPage(t: TestContext, action: BrowserActionCommand) {
  installPageGlobals((fn) => t.after(fn));
  const page = new FakePage();
  const main = page.add("div", "main", { box: { left: 50, top: 50, right: 950, bottom: 750 } });
  const target = page.add("button", "target", { box: { ...TARGET_BOX } }, main);
  const watched: string[] = [];
  const deps = dependencies(
    target as unknown as Element,
    fakeWatch(undefined, watched).make,
    fakeNoticeWatch(undefined, watched),
    fakeCheckWatch(undefined, watched),
    fakeIgnoredWatch(["change"], watched),
    true,
    "covered",
    () => AT_CENTRE
  );
  const result = await clickAction(action, deps, 1_000);
  return { result, page, on: (name: string) => page.eventsOn(name), hitTests: page.hitTests.length };
}

const pointOf = (events: FakeEvent[]) => events.map(({ type, x, y }) => ({ type, x, y }));

test("a marked command at 100 misclicks once beside the target, then presses exactly as the unmarked command does", async (t) => {
  const plain = await clickOnPage(t, { ...CLICK, commandId: MISCLICKS, humanness: 100 });
  const marked = await clickOnPage(t, { ...CLICK, commandId: MISCLICKS, humanness: 100, humannessMisclick: true });
  assert.equal(plain.result.status, "succeeded");
  assert.equal(marked.result.status, "succeeded");
  assert.deepEqual(plain.on("main"), [], "no misclick without the mark");
  assert.deepEqual(marked.on("main").map((event) => event.type), GESTURE, "one misclick gesture on the content beside the target");
  const [miss] = marked.on("main");
  assert.ok(miss && (miss.x < TARGET_BOX.left || miss.x > TARGET_BOX.right || miss.y < TARGET_BOX.top || miss.y > TARGET_BOX.bottom), "the misclick is outside the target");
  assert.deepEqual(pointOf(marked.on("target")), pointOf(plain.on("target")), "the press is the unmarked command's press");
  assert.equal(marked.result.validation?.status, plain.result.validation?.status);
  assert.deepEqual(marked.result.validation, plain.result.validation, "the result names the same press");
  const order = marked.page.events.map((event) => event.on);
  assert.ok(order.lastIndexOf("main") < order.indexOf("target"), "the misclick comes before the press");
});

test("at level 0 a marked command is today's click: the same events, and no more of the page read", async (t) => {
  const today = await clickOnPage(t, { ...CLICK, commandId: MISCLICKS });
  const zero = await clickOnPage(t, { ...CLICK, commandId: MISCLICKS, humanness: 0, humannessMisclick: true });
  assert.deepEqual(zero.page.events, today.page.events);
  assert.deepEqual(zero.on("main"), []);
  assert.equal(zero.hitTests, today.hitTests);
  assert.deepEqual(zero.result.validation, today.result.validation);
});

test("only the marked command looks for an inert point; unmarked at 100 there is no misclick", async (t) => {
  const plain = await clickOnPage(t, { ...CLICK, commandId: MISCLICKS, humanness: 100 });
  const marked = await clickOnPage(t, { ...CLICK, commandId: MISCLICKS, humanness: 100, humannessMisclick: true });
  assert.ok(marked.hitTests > plain.hitTests, "the marked command looked for an inert point");
  assert.deepEqual(plain.on("main"), []);
});

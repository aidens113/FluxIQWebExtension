// The click verb against a real page: the gesture it makes, the post-condition
// it reports, and the four targets it must refuse.
//
// The gesture rows exist because the reply alone cannot tell a real click from
// `HTMLElement.click()` -- both say "succeeded". What separates them is what
// the page received, so the page is the oracle: the event sequence, the
// coordinates each event carried, and the fact that a hit-tested point lands on
// the element it was measured from.
//
// The refusal rows are the point of Phase 1.2's gate. Each one clicks something
// the old verb reported as a success that changed nothing -- disabled, covered,
// hidden -- and each asserts the page as well as the reply, because "rejected"
// is only true if the click really did not reach the target. The control row at
// the end removes the obstacle and clicks the same element successfully, so the
// gate is shown to be discriminating rather than simply refusing.

import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";

const NAME = '[data-testid="name"]';
const SUBMIT = '[data-testid="submit"]';
const RESULT = '[data-testid="result"]';
const DISABLED_TARGET = '[data-testid="disabled-target"]';
const DETACH_TARGET = '[data-testid="detach-target"]';
const OVERLAY = '[data-testid="overlay"]';

/** The full sequence a press produces, in dispatch order. */
const GESTURE = [
  "pointerover", "pointerenter", "mouseover", "mouseenter",
  "pointermove", "mousemove",
  "pointerdown", "mousedown",
  "pointerup", "mouseup",
  "click"
];

/** Records every event of `GESTURE` reaching `selector` from now on, in order. */
async function watchGesture(page: Page, selector: string): Promise<() => Promise<string[]>> {
  await page.locator(selector).evaluate((element, types) => {
    const seen: string[] = [];
    (window as unknown as { __harnessGesture: string[] }).__harnessGesture = seen;
    for (const type of types) element.addEventListener(type, (event) => seen.push(`${event.type}:${event.isTrusted ? "trusted" : "untrusted"}`));
  }, GESTURE);
  return () => page.evaluate(() => (window as unknown as { __harnessGesture: string[] }).__harnessGesture);
}

/**
 * Records where the click landed and where the element's centre was at that
 * moment. Both are read inside the listener, so no later layout change can make
 * them disagree for a reason the verb is not responsible for.
 */
async function watchClickPoint(page: Page, selector: string): Promise<() => Promise<{ clicked: string; centre: string }>> {
  await page.locator(selector).evaluate((element) => {
    element.addEventListener("click", (event) => {
      const rect = element.getBoundingClientRect();
      const mouse = event as MouseEvent;
      (window as unknown as { __harnessPoint: { clicked: string; centre: string } }).__harnessPoint = {
        clicked: `${Math.round(mouse.clientX)},${Math.round(mouse.clientY)}`,
        centre: `${Math.round(rect.left + rect.width / 2)},${Math.round(rect.top + rect.height / 2)}`
      };
    });
  });
  return () => page.evaluate(() => (window as unknown as { __harnessPoint: { clicked: string; centre: string } }).__harnessPoint);
}

/** Puts an opaque layer over the whole viewport, so every target is covered wherever it scrolls to. */
async function coverViewport(page: Page): Promise<void> {
  await page.evaluate(() => {
    const overlay = document.createElement("div");
    overlay.dataset.testid = "overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.4)";
    document.body.append(overlay);
  });
}

/** Appends a link to the fixture's `<main>`, optionally one whose own handler cancels the click. */
async function addLink(page: Page, testId: string, fragment: string, swallow = false): Promise<void> {
  await page.evaluate(({ id, hash, cancel }) => {
    const link = document.createElement("a");
    link.dataset.testid = id;
    link.href = hash;
    link.textContent = `Go to ${hash}`;
    if (cancel) link.addEventListener("click", (event) => event.preventDefault());
    document.querySelector("main")?.append(link);
  }, { id: testId, hash: fragment, cancel: swallow });
}

test.describe("on basic-form", () => {
  test("the gesture is the sequence a press makes, not a bare click event", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    const seen = await watchGesture(page, SUBMIT);
    await harness.runAction({ commandId: "fill-name", actionType: "web.dom.type", selector: NAME, text: "Ada" });
    const reply = await harness.runAction({ commandId: "click", actionType: "web.dom.click", selector: SUBMIT });
    expect(reply).toMatchObject({ status: "succeeded", message: "Element clicked." });
    expect(await seen()).toEqual(GESTURE.map((type) => `${type}:untrusted`));
  });

  test("every event carries the hit-tested point, which belongs to the target", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    const seen = await watchClickPoint(page, SUBMIT);
    await harness.runAction({ commandId: "click-point", actionType: "web.dom.click", selector: SUBMIT });
    const point = await seen();
    expect(point.clicked).toBe(point.centre);
  });

  test("the reply's validation records the hit test, and the form really submitted", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await harness.runAction({ commandId: "fill-name", actionType: "web.dom.type", selector: NAME, text: "Ada" });
    const reply = await harness.runAction({ commandId: "click", actionType: "web.dom.click", selector: SUBMIT });
    expect(reply).toMatchObject({
      status: "succeeded",
      message: "Element clicked.",
      validation: { status: "passed", expected: "the click lands on the target or something inside it" },
      element: { selector: SUBMIT }
    });
    expect(reply.validation).toMatchObject({ actual: expect.stringMatching(/^the point \d+,\d+ landed on the target$/u) });
    expect(reply.failure).toBeUndefined();
    await expect(page.locator(RESULT)).toHaveText("Submitted");
    expect((await harness.finalState()).state).toMatchObject({ submitted: true, submissionCount: 1 });
  });

  test("the whole gesture is untrusted, so a recording session records none of it", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await harness.setRecording(true, { captureMutations: false, captureInputValues: true, captureSnapshots: false });
    // A plain paragraph: no activation behaviour, so nothing but the gesture itself could be recorded.
    const reply = await harness.runAction({ commandId: "click-result", actionType: "web.dom.click", selector: RESULT });
    await harness.setRecording(false);
    expect(reply).toMatchObject({ status: "succeeded" });
    expect(await harness.recordedEvents()).toEqual([]);
    await expect(page.locator(RESULT)).toHaveText("Not submitted");
  });

  test("a link click observes that the navigation it names began", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await addLink(page, "hash-link", "#done");
    const reply = await harness.runAction({ commandId: "click-link", actionType: "web.dom.click", selector: '[data-testid="hash-link"]' });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", expected: `navigation to ${harness.url}#done begins`, actual: `the page navigated to ${harness.url}#done` }
    });
    expect(reply.failure).toBeUndefined();
    await expect(page).toHaveURL(`${harness.url}#done`);
  });

  test("a link whose handler swallows the click reports output_not_observed, not success", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await addLink(page, "dead-link", "#never", true);
    const reply = await harness.runAction({ commandId: "click-dead-link", actionType: "web.dom.click", selector: '[data-testid="dead-link"]' });
    expect(reply).toMatchObject({
      status: "failed",
      validation: {
        status: "failed",
        expected: `navigation to ${harness.url}#never begins`,
        actual: "the click was prevented and the location did not change"
      },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true, stage: "verification" }
    });
    expect(page.url()).toBe(harness.url);
  });
});

test.describe("on failure-surfaces", () => {
  test("a disabled target is rejected, and nothing on the page moves", async ({ openHarness, page }) => {
    const harness = await openHarness("failure-surfaces");
    const seen = await watchGesture(page, DISABLED_TARGET);
    const reply = await harness.runAction({ commandId: "click-disabled", actionType: "web.dom.click", selector: DISABLED_TARGET });
    expect(reply).toMatchObject({
      status: "failed",
      message: "Action rejected: the element is disabled",
      validation: { status: "failed", expected: "a target that can be clicked", actual: "the element is disabled" },
      failure: { category: "blocked_by_capability_or_policy", code: "web.action.disabled", retryable: false, stage: "execution" },
      element: { selector: DISABLED_TARGET }
    });
    // The refusal is real: not one event of the gesture was dispatched.
    expect(await seen()).toEqual([]);
    await expect(page.locator(RESULT)).toHaveText("Ready");
    expect((await harness.finalState()).state).toMatchObject({ attempts: 0 });
  });

  test("a covered target is rejected and names what covers it, and the click never reaches it", async ({ openHarness, page }) => {
    const harness = await openHarness("failure-surfaces");
    await coverViewport(page);
    const reply = await harness.runAction({ commandId: "click-covered", actionType: "web.dom.click", selector: DETACH_TARGET });
    expect(reply).toMatchObject({
      status: "failed",
      failure: { category: "blocked_by_capability_or_policy", code: "web.action.covered", retryable: false, stage: "execution" },
      validation: { status: "failed", expected: "a target that can be clicked" }
    });
    expect(reply.validation).toMatchObject({
      actual: expect.stringMatching(/^the point \d+,\d+ landed on div\[data-testid="overlay"\], which covers the target$/u)
    });
    // Without the gate this click would have removed the button.
    await expect(page.locator(DETACH_TARGET)).toHaveCount(1);
    expect((await harness.finalState()).state).toMatchObject({ attempts: 0 });
  });

  test("a hidden target is rejected and says which property hid it", async ({ openHarness, page }) => {
    const harness = await openHarness("failure-surfaces");
    await page.locator(DETACH_TARGET).evaluate((element) => { (element as HTMLElement).style.display = "none"; });
    const reply = await harness.runAction({ commandId: "click-hidden", actionType: "web.dom.click", selector: DETACH_TARGET });
    expect(reply).toMatchObject({
      status: "failed",
      message: "Action rejected: the element's display is none",
      validation: { status: "failed", expected: "a target that can be clicked", actual: "the element's display is none" },
      failure: { category: "blocked_by_capability_or_policy", code: "web.action.hidden", retryable: false, stage: "execution" }
    });
    expect((await harness.finalState()).state).toMatchObject({ attempts: 0 });
  });

  test("the control: with the cover removed the same click succeeds and the page changes", async ({ openHarness, page }) => {
    const harness = await openHarness("failure-surfaces");
    await coverViewport(page);
    expect(await harness.runAction({ commandId: "blocked", actionType: "web.dom.click", selector: DETACH_TARGET })).toMatchObject({ status: "failed" });
    await page.evaluate((selector) => document.querySelector(selector)?.remove(), OVERLAY);
    const reply = await harness.runAction({ commandId: "allowed", actionType: "web.dom.click", selector: DETACH_TARGET });
    expect(reply).toMatchObject({ status: "succeeded", message: "Element clicked.", validation: { status: "passed" } });
    await expect(page.locator(DETACH_TARGET)).toHaveCount(0);
    expect((await harness.finalState()).state).toMatchObject({ lastFailure: "detached", attempts: 1 });
  });
});

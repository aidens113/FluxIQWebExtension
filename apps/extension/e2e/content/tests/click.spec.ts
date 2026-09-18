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
//
// All three refusals carry the one code the closed set names,
// `web.action.rejected`: Core routes on the category, which is the same for
// every refusal, and a per-reason code would be a string invented at a call
// site. The reason is not lost, and each row asserts where it went -- the
// record's `actual` reads `"<reason>: <what was observed>"`, so `disabled`,
// `covered` and `hidden` are still told apart by a reader and by these rows.
//
// A link is held to more than the hit test, and its rows are in
// click-link.spec.ts.

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
      failure: {
        category: "blocked_by_capability_or_policy", code: "web.action.rejected", retryable: false, stage: "execution",
        expected: "a target that can be clicked", actual: "disabled: the element is disabled"
      },
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
      failure: { category: "blocked_by_capability_or_policy", code: "web.action.rejected", retryable: false, stage: "execution" },
      validation: { status: "failed", expected: "a target that can be clicked" }
    });
    expect(reply.validation).toMatchObject({
      actual: expect.stringMatching(/^the point \d+,\d+ landed on div\[data-testid="overlay"\], which covers the target$/u)
    });
    // The reason the one code no longer spells out, named in the record itself.
    expect(reply.failure).toMatchObject({
      actual: expect.stringMatching(/^covered: the point \d+,\d+ landed on div\[data-testid="overlay"\], which covers the target$/u)
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
      failure: {
        category: "blocked_by_capability_or_policy", code: "web.action.rejected", retryable: false, stage: "execution",
        expected: "a target that can be clicked", actual: "hidden: the element's display is none"
      }
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

// Links whose navigation the page cancels, judged by whether the page answered.
// Kept with the other click cases: they exercise the same verb.
// The click verb's link rule against a real page, in both directions.
//
// A link passes when the navigation it names begins, or when the page's own
// script cancels that navigation and answers the click in place -- the
// company-directory sector link that loads filtered rows, a router that moves
// the address through the history API, a tab that reveals its panel, a filter
// that marks itself current and rewrites only text. And a link still fails when
// the page answered with nothing: a swallowed click, a press that only restyles
// the link and leaves a ripple while clocks tick beside it, a busy flag raised
// over rows that never change. The failing rows pass the command a short
// `timeoutMs`, which is also how they show that the command can shorten the
// in-place window; failures.spec.ts keeps one row on the default window.
//
// The gesture, the hit test and the refusals are click.spec.ts's.


/** What a link click claims: the navigation it names, or the page answering it in place. */
function linkExpected(href: string): string {
  return `navigation to ${href} begins, or the page answers the click in place`;
}

/** A link click the page answered by changing what a reader sees, with the address left alone. */
const IN_PLACE_CONTENT = /^the page prevented the navigation and changed its content in place, \d+ ms after the press$/u;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
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
  test("a link click observes that the navigation it names began", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await addLink(page, "hash-link", "#done");
    const reply = await harness.runAction({ commandId: "click-link", actionType: "web.dom.click", selector: '[data-testid="hash-link"]' });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", expected: linkExpected(`${harness.url}#done`), actual: `the page navigated to ${harness.url}#done` }
    });
    expect(reply.failure).toBeUndefined();
    await expect(page).toHaveURL(`${harness.url}#done`);
  });

  test("a link whose handler swallows the click reports output_not_observed, not success", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await addLink(page, "dead-link", "#never", true);
    const reply = await harness.runAction({ commandId: "click-dead-link", actionType: "web.dom.click", selector: '[data-testid="dead-link"]', timeoutMs: 1_000 });
    expect(reply).toMatchObject({
      status: "failed",
      validation: {
        status: "failed",
        expected: linkExpected(`${harness.url}#never`),
        actual: "the page prevented the navigation, and in 1000 ms neither its address nor its content changed"
      },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true, stage: "verification" }
    });
    expect(page.url()).toBe(harness.url);
  });

  test("a link a router handles, moving the address through the history API after a wait, passes on the address", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.dataset.testid = "router-link";
      link.href = "/somewhere-else";
      link.textContent = "Route";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        setTimeout(() => history.pushState({}, "", "?view=routed"), 150);
      });
      document.querySelector("main")?.append(link);
    });
    const routed = new URL("?view=routed", harness.url).href;
    const reply = await harness.runAction({ commandId: "click-router-link", actionType: "web.dom.click", selector: '[data-testid="router-link"]' });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed", expected: linkExpected(new URL("/somewhere-else", harness.url).href) } });
    expect(reply.validation).toMatchObject({
      actual: expect.stringMatching(new RegExp(`^the page prevented the navigation and moved its address to ${escapeRegExp(routed)} in place, \\d+ ms after the press$`, "u"))
    });
    expect(reply.failure).toBeUndefined();
    expect(page.url()).toBe(routed);
  });

  test("a tab link that reveals its panel in place passes on the content, with no address change", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await page.evaluate(() => {
      const panel = document.createElement("section");
      panel.dataset.testid = "tab-panel";
      panel.hidden = true;
      panel.textContent = "Shipping rates for the second tab";
      const link = document.createElement("a");
      link.dataset.testid = "tab-link";
      link.href = "#shipping";
      link.textContent = "Shipping";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        panel.hidden = false;
      });
      document.querySelector("main")?.append(link, panel);
    });
    const reply = await harness.runAction({ commandId: "click-tab", actionType: "web.dom.click", selector: '[data-testid="tab-link"]' });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(reply.validation).toMatchObject({ actual: expect.stringMatching(IN_PLACE_CONTENT) });
    await expect(page.locator('[data-testid="tab-panel"]')).toBeVisible();
    expect(page.url()).toBe(harness.url);
  });

  test("a filter link that marks itself current and then rewrites only text elsewhere passes", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    // No element is added or removed and nothing outside the link changes an
    // attribute: the lasting change to the link itself is the structure that moved.
    await page.evaluate(() => {
      const count = document.createElement("p");
      count.dataset.testid = "count";
      count.textContent = "320 companies listed";
      const link = document.createElement("a");
      link.dataset.testid = "filter-link";
      link.href = "?sector=logistics";
      link.textContent = "Logistics";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        link.setAttribute("aria-current", "true");
        setTimeout(() => {
          (count.firstChild as Text).data = "40 companies in Logistics";
        }, 120);
      });
      document.querySelector("main")?.append(link, count);
    });
    const reply = await harness.runAction({ commandId: "click-filter", actionType: "web.dom.click", selector: '[data-testid="filter-link"]' });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(reply.validation).toMatchObject({ actual: expect.stringMatching(IN_PLACE_CONTENT) });
    await expect(page.locator('[data-testid="count"]')).toHaveText("40 companies in Logistics");
  });

  test("a dead link still fails when its press restyles it and grows a ripple, on a page whose clocks tick", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    // Everything here moves without the click doing anything: two clocks, one
    // swapping its text node and one rewriting its data, and a link that is
    // styled while pressed and keeps the ripple its press left inside it.
    await page.evaluate(() => {
      const main = document.querySelector("main");
      const swapped = document.createElement("p");
      swapped.textContent = "Updated 0 s ago";
      const rewritten = document.createElement("p");
      rewritten.textContent = "00:00:00";
      let ticks = 0;
      setInterval(() => {
        ticks += 1;
        swapped.textContent = `Updated ${ticks} s ago`;
        (rewritten.firstChild as Text).data = `00:00:${String(ticks).padStart(2, "0")}`;
      }, 40);
      const link = document.createElement("a");
      link.dataset.testid = "pressed-dead-link";
      link.href = "#nowhere";
      link.textContent = "Nowhere";
      link.addEventListener("mousedown", () => {
        link.classList.add("is-pressed");
        const ripple = document.createElement("span");
        ripple.className = "ripple";
        link.append(ripple);
      });
      link.addEventListener("mouseup", () => link.classList.remove("is-pressed"));
      link.addEventListener("click", (event) => event.preventDefault());
      main?.append(swapped, rewritten, link);
    });
    const reply = await harness.runAction({ commandId: "click-pressed-dead", actionType: "web.dom.click", selector: '[data-testid="pressed-dead-link"]', timeoutMs: 1_000 });
    expect(reply).toMatchObject({
      status: "failed",
      validation: { status: "failed", actual: "the page prevented the navigation, and in 1000 ms neither its address nor its content changed" },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed" }
    });
    expect(page.url()).toBe(harness.url);
  });

  test("a dead link that only raises a busy flag, and shows nothing new, still fails", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await page.evaluate(() => {
      const region = document.createElement("section");
      region.dataset.testid = "busy-region";
      region.textContent = "The same rows as before";
      const link = document.createElement("a");
      link.dataset.testid = "busy-dead-link";
      link.href = "?page=2";
      link.textContent = "Page 2";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        region.setAttribute("aria-busy", "true");
      });
      document.querySelector("main")?.append(link, region);
    });
    const reply = await harness.runAction({ commandId: "click-busy-dead", actionType: "web.dom.click", selector: '[data-testid="busy-dead-link"]', timeoutMs: 1_000 });
    expect(reply).toMatchObject({ status: "failed", failure: { category: "output_not_observed" } });
    expect(page.url()).toBe(harness.url);
  });
});

test.describe("on company-directory", () => {
  const SECTOR = '[data-testid="sector-logistics"]';
  const RESULTS = '[data-testid="results"]';
  const RESULT_COUNT = '[data-testid="result-count"]';
  const FIRST_PROFILE = '[data-testid="company-rows"] tr:first-child .company-link';

  test("a sector link the page loads in place passes, and the rows it loaded are already there when the reply arrives", async ({ openHarness, page }) => {
    const harness = await openHarness("company-directory");
    const reply = await harness.runAction({ commandId: "click-sector", actionType: "web.dom.click", selector: SECTOR });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", expected: linkExpected(`${harness.url}?sector=logistics`) }
    });
    expect(reply.validation).toMatchObject({ actual: expect.stringMatching(IN_PLACE_CONTENT) });
    expect(reply.failure).toBeUndefined();
    // Read once, not awaited: the reply waited for the page's answer, so the
    // next step reads the filtered register rather than racing its fetch.
    expect(await page.locator(RESULTS).getAttribute("aria-busy")).toBe("false");
    expect(await page.locator(RESULT_COUNT).innerText()).toBe("40 companies listed");
    // The page never moved its address; the rows are the whole of its answer.
    expect(page.url()).toBe(harness.url);
  });

  test("a profile link the page does not intercept passes at once, as the navigation it began, and lands", async ({ openHarness, page }) => {
    const harness = await openHarness("company-directory");
    const href = await page.locator(FIRST_PROFILE).evaluate((anchor) => (anchor as HTMLAnchorElement).href);
    const reply = await harness.runAction({ commandId: "open-profile", actionType: "web.dom.click", selector: FIRST_PROFILE });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", expected: linkExpected(href), actual: `navigation to ${href} was initiated` }
    });
    // Answered without the in-place wait, before the document went.
    expect(reply.finishedAt - reply.startedAt).toBeLessThan(1_000);
    await expect(page).toHaveURL(href);
    await expect(page.locator('[data-testid="company-profile"]')).toBeVisible();
  });
});

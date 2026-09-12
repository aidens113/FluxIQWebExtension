// `web.dom.scroll`, the three modes, against two fixtures that can tell the
// difference: `long-document`, where the page is tall but finished, and
// `infinite-feed`, where scrolling is what makes more page exist.
//
// What each row proves is the post-condition, not the call: a delta lands
// where it said it would, a request past the end lands at the document's
// limit and still passes, a target below the fold ends up inside the
// viewport, and `untilStable` keeps going while the feed keeps growing. The
// cap row is the one that matters most -- stopping at `maxScrolls` with the
// document still growing reports `failed` with Core's `output_not_observed`,
// so a Flow that truncated a feed cannot look like one that read all of it.

import type { Page } from "@playwright/test";
import type { BrowserActionResult } from "../../../src/shared/protocol.js";
import { getScenario } from "../../../../scenario-lab/src/registry.js";
import { expect, test, type ContentHarness } from "../index.js";

const TARGET = '[data-testid="below-fold-target"]';

async function scrollY(page: Page): Promise<number> {
  return page.evaluate(() => Math.round(window.scrollY));
}

/** The furthest this document can be scrolled, computed as the verb computes it. */
async function maxScrollY(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(0, Math.round(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight)));
}

/** The `actual` of a compared validation; a result with none is a defect in the verb, not a value to skip. */
function comparedActual(result: BrowserActionResult): string {
  if (result.validation.status === "none") throw new Error(`The reply carries no compared validation: ${result.validation.reason}`);
  return result.validation.actual;
}

/**
 * Arms the fixture's own `end-early` variant through the Lab's authenticated
 * mutate endpoint, the way `packages/test-runner`'s `armScenarioVariant`
 * does, and from the manifest rather than a copy of its operation name. The
 * harness opens the page as it starts the Lab, so the fixture is re-opened
 * afterwards: the start document renders from the state armed here.
 */
async function armEndEarly(harness: ContentHarness): Promise<void> {
  const variant = getScenario("infinite-feed")?.manifest.variants?.find((candidate) => candidate.id === "end-early");
  if (!variant) throw new Error("The infinite-feed manifest has no end-early variant to arm.");
  const response = await fetch(`${harness.lab.origin}/api/infinite-feed/${variant.arm.operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(variant.arm.payload ?? {})
  });
  expect(response.status, "arming the infinite-feed end-early variant").toBe(200);
}

/** Opens the feed and waits for its first page, which the fixture announces only after its observer is watching. */
async function openFeed(harness: ContentHarness, page: Page): Promise<void> {
  await expect(page.getByTestId("feed-status")).toHaveText("Showing 10 posts");
  expect(harness.scenarioId).toBe("infinite-feed");
}

test.describe("on long-document", () => {
  test("by: moves the window by the delta and records the position change", async ({ openHarness, page }) => {
    const harness = await openHarness("long-document");
    const first = await harness.runAction({ commandId: "by-1", actionType: "web.dom.scroll", scroll: { mode: "by", y: 600 } });
    expect(first).toMatchObject({
      status: "succeeded",
      message: "Page scrolled.",
      validation: { status: "passed", expected: "scroll position 0,600", actual: "scroll position 0,600, moved from 0,0" },
      snapshot: { viewport: { scrollY: 600 } }
    });
    expect(await scrollY(page)).toBe(600);

    const second = await harness.runAction({ commandId: "by-2", actionType: "web.dom.scroll", scroll: { mode: "by", y: 600 } });
    expect(second).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", expected: "scroll position 0,1200", actual: "scroll position 0,1200, moved from 0,600" }
    });
    expect(await scrollY(page)).toBe(1200);
  });

  test("by: a delta past the end lands at the document's limit and still passes", async ({ openHarness, page }) => {
    const harness = await openHarness("long-document");
    const limit = await maxScrollY(page);
    expect(limit).toBeGreaterThan(0);
    const reply = await harness.runAction({ commandId: "by-past-end", actionType: "web.dom.scroll", scroll: { mode: "by", y: 100_000 } });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed", expected: `scroll position 0,${limit}` } });
    expect(await scrollY(page)).toBe(limit);
  });

  test("toElement: brings a target below the fold into the viewport", async ({ openHarness, page }) => {
    const harness = await openHarness("long-document");
    expect(await page.locator(TARGET).evaluate((element) => element.getBoundingClientRect().top > window.innerHeight)).toBe(true);

    const reply = await harness.runAction({ commandId: "to-element", actionType: "web.dom.scroll", selector: TARGET, scroll: { mode: "toElement" } });
    expect(reply).toMatchObject({
      status: "succeeded",
      message: "Scrolled the target into view.",
      validation: { status: "passed", expected: "the target within the viewport" },
      element: { selector: TARGET }
    });
    expect(comparedActual(reply)).toMatch(/^the target is at -?\d+,-?\d+ in a \d+x\d+ viewport$/);
    expect(await page.locator(TARGET).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    })).toBe(true);
    expect(await scrollY(page)).toBeGreaterThan(0);
  });

  test("toElement: an unresolvable target fails and leaves the page where it was", async ({ openHarness, page }) => {
    const harness = await openHarness("long-document");
    await harness.runAction({ commandId: "position", actionType: "web.dom.scroll", scroll: { mode: "by", y: 300 } });
    const reply = await harness.runAction({ commandId: "to-missing", actionType: "web.dom.scroll", selector: '[data-testid="missing"]', scroll: { mode: "toElement" } });
    expect(reply).toMatchObject({ status: "failed", message: 'No target resolved from selector [data-testid="missing"].' });
    expect(await scrollY(page)).toBe(300);
  });

  test("an absolute options move still works, and now reports the position it reached", async ({ openHarness, page }) => {
    const harness = await openHarness("long-document");
    const reply = await harness.runAction({ commandId: "absolute", actionType: "web.dom.scroll", options: { x: 0, y: 900 } });
    expect(reply).toMatchObject({
      status: "succeeded",
      message: "Page scrolled.",
      validation: { status: "passed", expected: "scroll position 0,900" },
      snapshot: { viewport: { scrollY: 900 } }
    });
    expect(await scrollY(page)).toBe(900);
  });
});

test.describe("on infinite-feed", () => {
  test("untilStable: loads every post, then stops because the document stopped growing", async ({ openHarness, page }) => {
    const harness = await openHarness("infinite-feed");
    await openFeed(harness, page);

    const reply = await harness.runAction({ commandId: "until-stable", actionType: "web.dom.scroll", scroll: { mode: "untilStable", maxScrolls: 12 } });
    expect(reply).toMatchObject({
      status: "succeeded",
      message: "Scrolled until the document stopped growing.",
      validation: { status: "passed", expected: "the document to stop growing within 12 scrolls" }
    });
    expect(comparedActual(reply)).toMatch(/^the document stopped growing after \d+ scrolls?, at \d+ pixels$/);
    expect(reply.failure).toBeUndefined();

    await expect(page.getByTestId("feed-item")).toHaveCount(60);
    await expect(page.getByTestId("feed-status")).toHaveText("Showing all 60 posts");
    await expect(page.getByTestId("feed-end")).toBeVisible();
    expect((await harness.finalState()).state).toMatchObject({ mode: "baseline", feedLength: 60, loadedCount: 60, ended: true });
  });

  test("untilStable: the maxScrolls cap reports the document still growing, not success", async ({ openHarness, page }) => {
    const harness = await openHarness("infinite-feed");
    await openFeed(harness, page);

    const reply = await harness.runAction({ commandId: "capped", actionType: "web.dom.scroll", scroll: { mode: "untilStable", maxScrolls: 1 } });
    expect(reply).toMatchObject({
      status: "failed",
      message: "Stopped at the 1-scroll cap while the document was still growing.",
      validation: { status: "failed", expected: "the document to stop growing within 1 scroll" },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true, stage: "verification" }
    });
    expect(comparedActual(reply)).toMatch(/^the document was still growing after 1 scroll, from \d+ to \d+ pixels$/);

    await expect(page.getByTestId("feed-status")).toHaveText("Showing 20 posts");
    await expect(page.getByTestId("feed-end")).toBeHidden();
    expect((await harness.finalState()).state).toMatchObject({ loadedCount: 20, ended: false });
  });

  test("untilStable on the end-early variant: the feed ends at 25 posts and the scroll settles there", async ({ openHarness, page }) => {
    const harness = await openHarness("infinite-feed");
    await armEndEarly(harness);
    await page.goto(harness.url);
    await openFeed(harness, page);

    const reply = await harness.runAction({ commandId: "until-stable-end-early", actionType: "web.dom.scroll", scroll: { mode: "untilStable", maxScrolls: 12 } });
    expect(reply).toMatchObject({
      status: "succeeded",
      message: "Scrolled until the document stopped growing.",
      validation: { status: "passed" }
    });

    await expect(page.getByTestId("feed-item")).toHaveCount(25);
    await expect(page.getByTestId("feed-status")).toHaveText("Showing all 25 posts");
    await expect(page.getByTestId("feed-end")).toBeVisible();
    await expect(page.getByTestId("feed-page-4")).toHaveCount(0);
    expect((await harness.finalState()).state).toMatchObject({ mode: "end-early", feedLength: 25, loadedCount: 25, ended: true });
  });
});

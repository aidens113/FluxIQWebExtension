// `web.dom.scroll`, the three modes, against two realistic pages that can tell
// the difference: job-board's results page at fifty jobs a page, which is tall
// but finished, and social-network-feed's home feed, where scrolling is what
// makes more page exist.
//
// What each row proves is the post-condition, not the call: a delta lands
// where it said it would, a request past the end lands at the document's
// limit and still passes, a target below the fold ends up inside the
// viewport, and `untilStable` keeps going while the feed keeps growing. The
// cap row is the one that matters most -- stopping at `maxScrolls` with the
// document still growing reports `failed` with Core's `output_not_observed`,
// so a Flow that truncated a feed cannot look like one that read all of it.
//
// The feed's expected lengths come from the scenario's own feed plan, and the
// shorter feed is its `quiet-feed` variant, armed from the manifest.

import type { Page } from "@playwright/test";
import type { BrowserActionResult } from "../../../src/shared/protocol.js";
import { getScenario } from "../../../../scenario-lab/src/registry.js";
import { feedPlanFor } from "../../../../scenario-lab/src/scenarios/social-network-feed/content/index.js";
import type { FeedMode } from "../../../../scenario-lab/src/scenarios/social-network-feed/index.js";
import { expect, test, type ContentHarness } from "../index.js";

/** The results page's "Jobs per page" select, at the foot of the list: below the fold with fifty jobs above it. */
const TARGET = 'select[name="limit"]';
const RESULTS_PATH = "/scenarios/job-board/jobs?limit=50";
const FEED_PATH = "/scenarios/social-network-feed/";
const FEED_UNITS = '[role="feed"] > [aria-posinset]';
const END_NOTE = "No more posts to show right now.";

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

/** Posts one of the scenario's own page mutations, as the page's `mutate` does. */
async function mutate(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.status, `${harness.scenarioId} ${operation}`).toBe(200);
}

/** Opens `path` on the harness's Lab and waits for the content script there to announce itself. */
async function openPath(harness: ContentHarness, path: string): Promise<void> {
  await harness.page.goto(new URL(path, harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

/** job-board's fifty-a-page results with consent answered, the alert offer declined and the chat minimised. */
async function openResults(openHarness: (id: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openHarness("job-board");
  await mutate(harness, "consent", { choice: "accepted" });
  await mutate(harness, "dismiss-alert-offer");
  await mutate(harness, "minimise-chat");
  await openPath(harness, RESULTS_PATH);
  await expect(harness.page.locator(TARGET)).toBeAttached();
  return harness;
}

/**
 * The feed with its overlays answered, after its first batch replaced the
 * skeletons. `quiet-feed` is armed from the manifest first, because arming
 * starts a new visitor.
 */
async function openFeed(openHarness: (id: string) => Promise<ContentHarness>, variantId?: string): Promise<ContentHarness> {
  const harness = await openHarness("social-network-feed");
  if (variantId) {
    const variant = getScenario("social-network-feed")?.manifest.workflows?.flatMap((workflow) => workflow.variants ?? []).find((candidate) => candidate.id === variantId);
    if (!variant) throw new Error(`The social-network-feed manifest has no ${variantId} variant to arm.`);
    await mutate(harness, variant.arm.operation, variant.arm.payload ?? {});
  }
  await mutate(harness, "consent", { choice: "all" });
  await mutate(harness, "notifications", { choice: "dismissed" });
  await mutate(harness, "chat", { state: "closed" });
  await openPath(harness, FEED_PATH);
  await expect(harness.page.locator(FEED_UNITS)).toHaveCount(5);
  return harness;
}

/** Every unit the feed holds under `mode`, the suggested posts after "You're all caught up" included. */
function feedLength(mode: FeedMode): number {
  return feedPlanFor({ mode, created: [], trashed: [], hidden: [] }).batches.flat().length;
}

test.describe("on job-board's results page", () => {
  test("by: moves the window by the delta and records the position change", async ({ openHarness, page }) => {
    const harness = await openResults(openHarness);
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
    const harness = await openResults(openHarness);
    const limit = await maxScrollY(page);
    expect(limit).toBeGreaterThan(1200);
    const reply = await harness.runAction({ commandId: "by-past-end", actionType: "web.dom.scroll", scroll: { mode: "by", y: 100_000 } });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed", expected: `scroll position 0,${limit}` } });
    expect(await scrollY(page)).toBe(limit);
  });

  test("toElement: brings a target below the fold into the viewport", async ({ openHarness, page }) => {
    const harness = await openResults(openHarness);
    expect(await page.locator(TARGET).evaluate((element) => element.getBoundingClientRect().top > window.innerHeight)).toBe(true);

    const reply = await harness.runAction({ commandId: "to-element", actionType: "web.dom.scroll", selector: TARGET, scroll: { mode: "toElement" } });
    expect(reply).toMatchObject({
      status: "succeeded",
      message: "Scrolled the target into view.",
      validation: { status: "passed", expected: "the target within the viewport" },
      element: { selector: TARGET }
    });
    // The position the scroll reached, and then what the actionability gate saw
    // at that position: a scroll never refuses on the gate, it reports it, so
    // a step that is about to be refused as covered says so here first.
    expect(comparedActual(reply)).toMatch(/^the target is at -?\d+,-?\d+ in a \d+x\d+ viewport; the point -?\d+,-?\d+ landed on the target$/);
    expect(await page.locator(TARGET).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    })).toBe(true);
    expect(await scrollY(page)).toBeGreaterThan(0);
  });

  test("toElement: an unresolvable target fails and leaves the page where it was", async ({ openHarness, page }) => {
    const harness = await openResults(openHarness);
    await harness.runAction({ commandId: "position", actionType: "web.dom.scroll", scroll: { mode: "by", y: 300 } });
    const reply = await harness.runAction({ commandId: "to-missing", actionType: "web.dom.scroll", selector: '[data-testid="missing"]', scroll: { mode: "toElement" } });
    // The board has open shadow roots (its consent and chat widgets), so they were searched too.
    expect(reply).toMatchObject({ status: "failed", message: `No target resolved from selector [data-testid="missing"], selector [data-testid="missing"] in the page's open shadow roots.` });
    expect(await scrollY(page)).toBe(300);
  });

  test("an absolute options move still works, and now reports the position it reached", async ({ openHarness, page }) => {
    const harness = await openResults(openHarness);
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

test.describe("on social-network-feed's home feed", () => {
  test("untilStable: loads every post, then stops because the document stopped growing", async ({ openHarness, page }) => {
    const harness = await openFeed(openHarness);
    const reply = await harness.runAction({ commandId: "until-stable", actionType: "web.dom.scroll", scroll: { mode: "untilStable", maxScrolls: 30 } });
    expect(reply).toMatchObject({
      status: "succeeded",
      message: "Scrolled until the document stopped growing.",
      validation: { status: "passed", expected: "the document to stop growing within 30 scrolls" }
    });
    expect(comparedActual(reply)).toMatch(/^the document stopped growing after \d+ scrolls?, at \d+ pixels$/);
    expect(reply.failure).toBeUndefined();

    await expect(page.locator(FEED_UNITS)).toHaveCount(feedLength("baseline"));
    await expect(page.getByRole("heading", { name: "You're all caught up" })).toBeAttached();
    await expect(page.getByText(END_NOTE)).toBeVisible();
  });

  test("untilStable: the maxScrolls cap reports the document still growing, not success", async ({ openHarness, page }) => {
    const harness = await openFeed(openHarness);
    const reply = await harness.runAction({ commandId: "capped", actionType: "web.dom.scroll", scroll: { mode: "untilStable", maxScrolls: 1 } });
    expect(reply).toMatchObject({
      status: "failed",
      message: "Stopped at the 1-scroll cap while the document was still growing.",
      validation: { status: "failed", expected: "the document to stop growing within 1 scroll" },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true, stage: "verification" }
    });
    expect(comparedActual(reply)).toMatch(/^the document was still growing after 1 scroll, from \d+ to \d+ pixels$/);

    // One scroll brought one more batch of five, and the feed is far from its end.
    await expect(page.locator(FEED_UNITS)).toHaveCount(10);
    await expect(page.getByText(END_NOTE)).toHaveCount(0);
  });

  test("untilStable on the quiet-feed variant: the feed ends sooner and the scroll settles there", async ({ openHarness, page }) => {
    const harness = await openFeed(openHarness, "quiet-feed");
    const reply = await harness.runAction({ commandId: "until-stable-quiet", actionType: "web.dom.scroll", scroll: { mode: "untilStable", maxScrolls: 30 } });
    expect(reply).toMatchObject({
      status: "succeeded",
      message: "Scrolled until the document stopped growing.",
      validation: { status: "passed" }
    });

    const quiet = feedLength("quiet-feed");
    expect(quiet).toBeLessThan(feedLength("baseline"));
    await expect(page.locator(FEED_UNITS)).toHaveCount(quiet);
    await expect(page.getByText(END_NOTE)).toBeVisible();
    expect((await harness.finalState()).state).toMatchObject({ mode: "quiet-feed" });
  });
});

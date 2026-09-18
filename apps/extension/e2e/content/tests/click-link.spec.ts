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

import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";

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

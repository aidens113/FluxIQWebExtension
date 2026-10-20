// The click verb against a real page: the gesture it makes, the post-condition
// it reports, and the targets it must refuse.
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
// All refusals carry a code from the closed set: Core routes on the category,
// and a per-reason code would be a string invented at a call site. The reason
// is not lost, and each row asserts where it went -- the record's `actual`
// reads `"<reason>: <what was observed>"`, so `disabled`, `covered` and
// `hidden` are still told apart by a reader and by these rows.
//
// Pages (t730: browser specs open only the ten realistic scenarios). The
// everything-store header's "Deliver to" control, a `div` with a click handler
// and no role, carries the gesture, the hit test and the hidden and control
// rows. The covered row is the store's own construct: under its
// `help-and-offers` rendering the cart's delivery questions scroll inside a
// box whose "Still need help?" bar is pinned over the last question. The
// company-website quote drawer is the form: its Continue checks step 1 and
// moves on in place, and its Back, which the page disables on step 1, is the
// disabled row. The store's own interruptions -- consent, the app banner that
// pushes the page down and the notifications prompt that makes it inert -- are
// answered first through the site's `/api` mutations, as a returning visitor's
// are.
//
// Two rows still change the page themselves, because their shape is a page
// changing under the spec's control rather than a page as it ships: the hidden
// row sets the target's `display`, and the control row lays a cover over the
// viewport and then removes it, so the same element is refused and then
// clicked. A store that hid, or uncovered, a control on cue would be a test
// construct dressed as a page.
//
// A link is held to more than the hit test, and its rows are at the end.

import type { Page } from "@playwright/test";
import { HOUSEHOLD } from "../../../../scenario-lab/src/scenarios/everything-store/index.js";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

const STORE = "/scenarios/everything-store/";
const DELIVER_TO = '[data-action="deliver-to"]';
const DELIVER_POPOVER = "[data-deliver-popover]";
const OVERLAY = '[data-testid="overlay"]';
/** The last of the cart's delivery questions under `help-and-offers`, which the box's pinned bar covers once its list is scrolled to the end. */
const LAST_QUESTION = "li:last-child > [data-faq]";
/** The quote drawer's Back: the one disabled button in the drawer while it is on step 1. */
const QUOTE_BACK = "[data-quote-drawer] button[disabled]";

/** The full sequence a press produces, in dispatch order. */
const GESTURE = [
  "pointerover", "pointerenter", "mouseover", "mouseenter",
  "pointermove", "mousemove",
  "pointerdown", "mousedown",
  "pointerup", "mouseup",
  "click"
];

/** Sends one of the scenario's own page mutations, as its page script would. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${harness.scenarioId} answered ${response.status} to ${operation}.`);
}

/** Opens the store with consent given and the app banner and notifications prompt answered, then loads `path`. */
async function openCalmStore(openHarness: (id: string) => Promise<ContentHarness>, path = STORE): Promise<ContentHarness> {
  const harness = await openHarness("everything-store");
  await mutate(harness, "consent", { choice: "accept" });
  await mutate(harness, "dismiss-nudge", { nudge: "app-banner" });
  await mutate(harness, "dismiss-nudge", { nudge: "notifications" });
  await harness.page.goto(new URL(path, harness.lab.origin).href);
  return harness;
}

/**
 * Opens the store's cart under `help-and-offers`, armed first because arming
 * starts the account over, then calmed as `openCalmStore` does. With
 * `descaler`, the shopper has put the descaler in the cart first, which is
 * what brings the page its lightning deal and the deal's ticking clock.
 */
async function openHelpAndOffers(openHarness: (id: string) => Promise<ContentHarness>, descaler = false): Promise<ContentHarness> {
  const harness = await openHarness("everything-store");
  await mutate(harness, "set-mode", { mode: "help-and-offers" });
  await mutate(harness, "consent", { choice: "accept" });
  await mutate(harness, "dismiss-nudge", { nudge: "app-banner" });
  await mutate(harness, "dismiss-nudge", { nudge: "notifications" });
  if (descaler) await mutate(harness, "add-to-cart", { sku: HOUSEHOLD.descaler.sku, quantity: 1 });
  await harness.page.goto(new URL(CART, harness.lab.origin).href);
  await expect(harness.page.getByRole("heading", { name: "Help and offers" })).toBeVisible();
  return harness;
}

/** Opens company-website's quote drawer on its first step, with consent given and the chat greeting and newsletter offer answered. */
async function openQuoteDrawer(openHarness: (id: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openHarness("company-website");
  await mutate(harness, "set-consent", { choice: "all" });
  await mutate(harness, "dismiss-chat-greeting");
  await mutate(harness, "dismiss-newsletter");
  // The site's own quote links lead to `#quote`, which opens the drawer when the page loads.
  await harness.page.goto(new URL("/scenarios/company-website/#quote", harness.lab.origin).href);
  await harness.page.reload();
  await expect(harness.page.getByText("Step 1 of 3.")).toBeVisible();
  return harness;
}

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

/**
 * Whether the selector a reply reports names the element the request named.
 * On a site with no test ids the content script reports its own selector for
 * the element (an id, or a path), not the one it was sent.
 */
async function sameElement(page: Page, reported: string | undefined, requested: string): Promise<boolean> {
  if (!reported) return false;
  return await page.evaluate(([a, b]) => {
    const found = document.querySelector(a);
    return found !== null && found === document.querySelector(b);
  }, [reported, requested] as const);
}

/** The text as a pattern that matches only itself, for a selector the page names with its seeded class. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** Puts an opaque layer over the whole viewport, so every target is covered wherever it scrolls to; the control row's cover, which it then removes. */
async function coverViewport(page: Page): Promise<void> {
  await page.evaluate(() => {
    const overlay = document.createElement("div");
    overlay.dataset.testid = "overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.4)";
    document.body.append(overlay);
  });
}

/** Marks the first element matching `selector` whose words are exactly `words`, so a request can name it; the store's classes are seeded hashes. */
async function markByText(page: Page, selector: string, words: string, mark: string): Promise<string> {
  await page.evaluate(({ css, text, attribute }) => {
    const found = Array.from(document.querySelectorAll(css)).find((element) => element.textContent?.trim() === text);
    if (!found) throw new Error(`No ${css} reads "${text}".`);
    found.setAttribute(attribute, "");
  }, { css: selector, text: words, attribute: mark });
  return `[${mark}]`;
}

test.describe("the gesture and its post-condition", () => {
  test("the gesture is the sequence a press makes, not a bare click event", async ({ openHarness, page }) => {
    const harness = await openCalmStore(openHarness);
    const seen = await watchGesture(page, DELIVER_TO);
    const reply = await harness.runAction({ commandId: "click", actionType: "web.dom.click", selector: DELIVER_TO });
    expect(reply).toMatchObject({ status: "succeeded", message: "Element clicked." });
    expect(await seen()).toEqual(GESTURE.map((type) => `${type}:untrusted`));
    // The page's own handler answered the press: the location chooser opened.
    await expect(page.locator(DELIVER_POPOVER)).toBeVisible();
  });

  test("every event carries the hit-tested point, which belongs to the target", async ({ openHarness, page }) => {
    const harness = await openCalmStore(openHarness);
    const seen = await watchClickPoint(page, DELIVER_TO);
    await harness.runAction({ commandId: "click-point", actionType: "web.dom.click", selector: DELIVER_TO });
    const point = await seen();
    expect(point.clicked).toBe(point.centre);
  });

  test("the reply's validation records the hit test, and the form really moved on (company-website quote drawer's Continue)", async ({ openHarness, page }) => {
    const harness = await openQuoteDrawer(openHarness);
    for (const [name, text] of [["fullName", "Ada Lovelace"], ["email", "ada@example.test"], ["phone", "01632 960 001"], ["postcode", "BS1 4DJ"]] as const) {
      const typed = await harness.runAction({ commandId: `fill-${name}`, actionType: "web.dom.type", selector: `[data-quote-drawer] input[name="${name}"]`, text });
      expect(typed.status, typed.message).toBe("succeeded");
    }
    const continueButton = await markByText(page, "[data-quote-drawer] button", "Continue", "data-spec-continue");
    const reply = await harness.runAction({ commandId: "click", actionType: "web.dom.click", selector: continueButton });
    expect(reply).toMatchObject({
      status: "succeeded",
      message: "Element clicked.",
      validation: { status: "passed", expected: "the click lands on the target or something inside it" },
    });
    expect(await sameElement(page, reply.element?.selector, continueButton), "the reply names the button pressed").toBe(true);
    expect(reply.validation).toMatchObject({ actual: expect.stringMatching(/^the point \d+,\d+ landed on the target$/u) });
    expect(reply.failure).toBeUndefined();
    // The page's own check of step 1 passed on the typed details, and the drawer moved to step 2.
    await expect(page.getByText("Step 2 of 3.")).toBeVisible();
    await expect(page.getByText("Step 1 of 3.")).toBeHidden();
    await expect(page.locator(QUOTE_BACK)).toHaveCount(0);
  });

  test("the whole gesture is untrusted, so a recording session records none of it", async ({ openHarness, page }) => {
    const harness = await openCalmStore(openHarness);
    // A tile's heading: a plain paragraph with no activation behaviour, so nothing but the gesture itself could be recorded.
    const heading = await markByText(page, "main p", "Keep shopping for", "data-spec-heading");
    await harness.setRecording(true, { captureMutations: false, captureInputValues: true, captureSnapshots: false });
    const reply = await harness.runAction({ commandId: "click-heading", actionType: "web.dom.click", selector: heading });
    await harness.setRecording(false);
    expect(reply).toMatchObject({ status: "succeeded" });
    // Not one event of the gesture was recorded: no pointer, mouse or click event, no input.
    const recorded = await harness.recordedEvents();
    expect(recorded.filter((event) => event.kind !== "dom.scroll")).toEqual([]);
    // What is left is the window moving: the verb scrolls its target into view
    // first, and the recorder's window `scroll` listener cannot tell that from a
    // person's scroll (`dom-events.ts`; scroll events carry no trust). The
    // synthetic form never scrolled, so this went unseen there (t730 report).
    expect(recorded.map((event) => event.kind)).toEqual(recorded.length === 0 ? [] : ["dom.scroll"]);
    await expect(page.locator(heading)).toHaveText("Keep shopping for");
    expect(page.url()).toBe(new URL(STORE, harness.lab.origin).href);
  });
});

test.describe("refusals", () => {
  test("a disabled target is rejected, and nothing on the page moves (company-website quote drawer's Back on step 1)", async ({ openHarness, page }) => {
    const harness = await openQuoteDrawer(openHarness);
    await expect(page.locator(QUOTE_BACK)).toHaveText("Back");
    await expect(page.getByText("Step 1 of 3.")).toBeVisible();
    const seen = await watchGesture(page, QUOTE_BACK);
    const reply = await harness.runAction({ commandId: "click-disabled", actionType: "web.dom.click", selector: QUOTE_BACK });
    expect(reply).toMatchObject({
      status: "failed",
      message: "Action rejected: the element is disabled",
      validation: { status: "failed", expected: "a target that can be clicked", actual: "the element is disabled" },
      failure: {
        category: "unexpected_state", code: "web.target.not_actionable", retryable: false, stage: "execution",
        expected: "a target that can be clicked", actual: "disabled: the element is disabled"
      }
    });
    expect(await sameElement(page, reply.element?.selector, QUOTE_BACK), "the reply names the button refused").toBe(true);
    // The refusal is real: not one event of the gesture was dispatched, and the drawer is still on its first step.
    expect(await seen()).toEqual([]);
    await expect(page.getByText("Step 1 of 3.")).toBeVisible();
    await expect(page.locator(QUOTE_BACK)).toBeDisabled();
  });

  test("a covered target is rejected and names what covers it, and the click never reaches it (everything-store's pinned help bar over its last delivery question)", async ({ openHarness, page }) => {
    const harness = await openHelpAndOffers(openHarness);
    // The bar is a paragraph pinned along the bottom of the questions' scrolling box; the store's classes are seeded hashes.
    const bar = await page.locator('p:has(> a[href="#contact-us"])').evaluate((element) => `p.${element.className.split(" ")[0]}`);
    const seen = await watchGesture(page, LAST_QUESTION);
    const reply = await harness.runAction({ commandId: "click-covered", actionType: "web.dom.click", selector: LAST_QUESTION });
    expect(reply).toMatchObject({
      status: "failed",
      failure: { category: "unexpected_state", code: "web.target.not_actionable", retryable: false, stage: "execution" },
      validation: { status: "failed", expected: "a target that can be clicked" }
    });
    // The text now carries the defence's account too: a covered target is an
    // obstruction the runtime tries to clear before it reports, so what the verb
    // observed is the head of the text and what the loop absorbed is a note after
    // it (`action-runtime/recovery/record.ts`).
    expect(reply.validation).toMatchObject({
      actual: expect.stringMatching(new RegExp(`^the point \\d+,\\d+ landed on ${escapeRegExp(bar)}, which covers the target;`, "u"))
    });
    // The reason the one code no longer spells out, named in the record itself.
    expect(reply.failure).toMatchObject({
      actual: expect.stringMatching(new RegExp(`^covered: the point \\d+,\\d+ landed on ${escapeRegExp(bar)}, which covers the target;`, "u"))
    });
    // The defence was reached, found nothing it could press, and said so.
    expect(reply.failure?.actual).toMatch(/after absorbing obstructed_target/u);
    expect(reply.failure?.actual).not.toMatch(/closing/u);
    // Without the gate this click would have opened the answer; not one event of the gesture reached the question.
    expect(await seen()).toEqual([]);
    await expect(page.locator(LAST_QUESTION)).toHaveAttribute("aria-expanded", "false");
  });

  test("a hidden target is rejected and says which property hid it", async ({ openHarness, page }) => {
    const harness = await openCalmStore(openHarness);
    await page.locator(DELIVER_TO).evaluate((element) => { (element as HTMLElement).style.display = "none"; });
    const reply = await harness.runAction({ commandId: "click-hidden", actionType: "web.dom.click", selector: DELIVER_TO });
    expect(reply).toMatchObject({
      status: "failed",
      message: "Action rejected: the element's display is none",
      validation: { status: "failed", expected: "a target that can be clicked" },
      failure: {
        // Not shown is Core's `target_not_found` (t193-1002m), so a Flow run routes by state.
        category: "target_not_found", code: "web.target.not_shown", retryable: true, stage: "target_resolution",
        expected: "a target that can be clicked"
      }
    });
    // A hidden target is waited for and looked at again before it is reported,
    // so the reason heads the text and the account follows it.
    expect(reply.validation).toMatchObject({ actual: expect.stringMatching(/^the element's display is none;/u) });
    expect(reply.failure).toMatchObject({ actual: expect.stringMatching(/^hidden: the element's display is none;/u) });
    await expect(page.locator(DELIVER_POPOVER)).toHaveCount(0);
  });

  test("the control: with the cover removed the same click succeeds and the page changes", async ({ openHarness, page }) => {
    const harness = await openCalmStore(openHarness);
    await coverViewport(page);
    expect(await harness.runAction({ commandId: "blocked", actionType: "web.dom.click", selector: DELIVER_TO })).toMatchObject({ status: "failed" });
    await expect(page.locator(DELIVER_POPOVER)).toHaveCount(0);
    await page.evaluate((selector) => document.querySelector(selector)?.remove(), OVERLAY);
    const reply = await harness.runAction({ commandId: "allowed", actionType: "web.dom.click", selector: DELIVER_TO });
    expect(reply).toMatchObject({ status: "succeeded", message: "Element clicked.", validation: { status: "passed" } });
    await expect(page.locator(DELIVER_POPOVER)).toBeVisible();
  });
});

// The click verb's link rule against a real page, in both directions.
//
// A link passes when the navigation it names begins, or when the page's own
// script cancels that navigation and answers the click in place -- a router
// that moves the address through the history API (the job board's result
// cards, which move it inside their own handler), a tab that reveals its panel, a filter that marks itself current and
// rewrites only text. And a link still fails when the page answered with
// nothing: a swallowed click, a press that only restyles the link and leaves a
// ripple while clocks tick beside it, a busy flag raised over rows that never
// change. The failing rows pass the command a short `timeoutMs`, which is also
// how they show that the command can shorten the in-place window;
// failures.spec.ts keeps one row on the default window.
//
// The links that cancel or answer their own clicks are the store's: under its
// `help-and-offers` rendering the cart page ends with a "Help and offers" area
// whose links behave as each team shipped them -- a plain link to the delivery
// questions, help topics shown in place, a deals filter, a promo's terms link
// whose handler has nothing behind it, a "Claim deal" link that only ripples
// beside a ticking deal clock, and an also-viewed pager that raises its busy
// flag and never loads (`client/help-and-offers-script.ts`). The page around
// them is quiet once its interruptions are answered. The lightning deal, and
// with it the page's only clocks, shows only for a cart holding the
// descaler, so only the ripple row puts it there: its clocks tick beside a
// dead link, and no other row has anything moving that the link did not move.

/** What a link click claims: the navigation it names, or the page answering it in place. */
function linkExpected(href: string): string {
  return `navigation to ${href} begins, or the page answers the click in place`;
}

/** A link click the page answered by changing what a reader sees, with the address left alone. */
const IN_PLACE_CONTENT = /^the page prevented the navigation and changed its content in place, \d+ ms after the press$/u;

const CART = "/scenarios/everything-store/cart";

test.describe("links on everything-store's cart page (help-and-offers)", () => {
  test("a link click observes that the navigation it names began", async ({ openHarness, page }) => {
    const harness = await openHelpAndOffers(openHarness);
    const base = page.url();
    const reply = await harness.runAction({ commandId: "click-link", actionType: "web.dom.click", selector: 'a[href="#delivery-questions"]' });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", expected: linkExpected(`${base}#delivery-questions`), actual: `the page navigated to ${base}#delivery-questions` }
    });
    expect(reply.failure).toBeUndefined();
    await expect(page).toHaveURL(`${base}#delivery-questions`);
  });

  test("a link whose handler swallows the click reports output_not_observed, not success (the promo's terms link)", async ({ openHarness, page }) => {
    const harness = await openHelpAndOffers(openHarness);
    const base = page.url();
    const reply = await harness.runAction({ commandId: "click-dead-link", actionType: "web.dom.click", selector: "[data-promo-terms]", timeoutMs: 1_000 });
    expect(reply).toMatchObject({
      status: "failed",
      validation: {
        status: "failed",
        expected: linkExpected(`${base}#promo-terms`),
        actual: "the page prevented the navigation, and in 1000 ms neither its address nor its content changed"
      },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true, stage: "verification" }
    });
    expect(page.url()).toBe(base);
  });

  test("a tab link that reveals its panel in place passes on the content, with no address change (the Returns help topic)", async ({ openHarness, page }) => {
    const harness = await openHelpAndOffers(openHarness);
    const base = page.url();
    await expect(page.locator("#help-returns")).toBeHidden();
    const reply = await harness.runAction({ commandId: "click-tab", actionType: "web.dom.click", selector: 'a[href="#help-returns"]' });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(reply.validation).toMatchObject({ actual: expect.stringMatching(IN_PLACE_CONTENT) });
    await expect(page.locator("#help-returns")).toBeVisible();
    expect(page.url()).toBe(base);
  });

  test("a filter link that marks itself current and then rewrites only text elsewhere passes (the deals strip)", async ({ openHarness, page }) => {
    const harness = await openHelpAndOffers(openHarness);
    // No element is added or removed and nothing outside the link changes an
    // attribute: the lasting change to the link itself is the structure that moved.
    const reply = await harness.runAction({ commandId: "click-filter", actionType: "web.dom.click", selector: 'a[href="?dept=home"]' });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(reply.validation).toMatchObject({ actual: expect.stringMatching(IN_PLACE_CONTENT) });
    await expect(page.locator('a[href="?dept=home"]')).toHaveAttribute("aria-current", "true");
    await expect(page.locator("[data-deal-count]")).toHaveText("3 deals in Home & Kitchen");
  });

  test("a dead link still fails when its press restyles it and grows a ripple, on a page whose clocks tick (Claim deal)", async ({ openHarness, page }) => {
    const harness = await openHelpAndOffers(openHarness, true);
    const base = page.url();
    // Everything here moves without the click doing anything: the deal clock
    // rewrites its sentence and changes its timer's text every tenth of a second,
    // and the link is styled while pressed and keeps the ripple its press left.
    const reply = await harness.runAction({ commandId: "click-pressed-dead", actionType: "web.dom.click", selector: "[data-claim-deal]", timeoutMs: 1_000 });
    expect(reply).toMatchObject({
      status: "failed",
      validation: { status: "failed", actual: "the page prevented the navigation, and in 1000 ms neither its address nor its content changed" },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed" }
    });
    await expect(page.locator("[data-claim-deal] span")).toHaveCount(1);
    expect(page.url()).toBe(base);
  });

  test("a dead link that only raises a busy flag, and shows nothing new, still fails (the also-viewed pager)", async ({ openHarness, page }) => {
    const harness = await openHelpAndOffers(openHarness);
    const base = page.url();
    const reply = await harness.runAction({ commandId: "click-busy-dead", actionType: "web.dom.click", selector: "[data-viewed-page]", timeoutMs: 1_000 });
    expect(reply, JSON.stringify(reply.validation)).toMatchObject({ status: "failed", failure: { category: "output_not_observed" } });
    await expect(page.locator("[data-also-viewed]")).toHaveAttribute("aria-busy", "true");
    expect(page.url()).toBe(base);
  });
});

test.describe("links on everything-store's cart page", () => {
  test("a recommendation link the page does not intercept passes at once, as the navigation it began, and lands", async ({ openHarness, page }) => {
    const harness = await openCalmStore(openHarness, CART);
    // The first of the "also bought" products; the store's classes are seeded hashes, so the spec marks it.
    await page.locator('section[aria-labelledby="also-bought"] a[href*="/dp/"]').first().evaluate((anchor) => anchor.setAttribute("data-spec-product", ""));
    const link = "[data-spec-product]";
    const href = await page.locator(link).evaluate((anchor) => (anchor as HTMLAnchorElement).href);
    const reply = await harness.runAction({ commandId: "open-product", actionType: "web.dom.click", selector: link });
    expect(reply, reply.message).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", expected: linkExpected(href), actual: `navigation to ${href} was initiated` }
    });
    // Answered without the in-place wait, before the document went.
    expect(reply.finishedAt - reply.startedAt).toBeLessThan(1_000);
    await expect(page).toHaveURL(href);
    await expect(page.locator("h1").first()).toBeVisible();
  });
});

test.describe("links on job-board's results", () => {
  test("a result card's title link, which the board routes in place through the history API, passes on the address", async ({ openHarness, page }) => {
    const harness = await openHarness("job-board");
    // A returning visitor: consent answered, the job-alert offer and the chat put away.
    await mutate(harness, "consent", { choice: "accepted" });
    await mutate(harness, "dismiss-alert-offer");
    await mutate(harness, "minimise-chat");
    await page.goto(new URL("/scenarios/job-board/jobs", harness.lab.origin).href);
    await expect(page.locator("ol article[data-jk] h2 a").first()).toBeVisible();
    // The first organic card's title; the board's classes and ids rotate with the seed, so the spec marks it.
    await page.locator("ol article[data-jk] h2 a").first().evaluate((anchor) => anchor.setAttribute("data-spec-card", ""));
    const title = "[data-spec-card]";
    const key = await page.locator("ol article[data-jk]").first().getAttribute("data-jk");
    const href = await page.locator(title).evaluate((anchor) => (anchor as HTMLAnchorElement).href);
    const routed = new URL(page.url());
    routed.searchParams.set("vjk", key ?? "");
    const reply = await harness.runAction({ commandId: "click-card", actionType: "web.dom.click", selector: title });
    expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed", expected: linkExpected(href) } });
    // The board moves the address with `history.replaceState` inside its own
    // click handler, so the address has already moved when the press returns:
    // the verb reports it as the navigation it saw, not as an in-place answer it
    // waited for. Either way the link is judged by where the address went.
    expect(reply.validation).toMatchObject({ actual: `the page navigated to ${routed.href}` });
    expect(reply.failure).toBeUndefined();
    expect(page.url()).toBe(routed.href);
    // The board's own answer: the card's posting opens in the pane beside the list.
    await expect(page.locator("aside").getByRole("heading").first()).toBeVisible({ timeout: 5_000 });
  });
});

// A filter link the page loads in place, with no address move, whose reply
// waits for the fetched rows. The job board's `in-place-filters` rendering is
// its newer results page: a filter pill's menu option cancels its navigation,
// fetches the filtered results, swaps them into the results column under
// `aria-busy`, and leaves the address alone.
// Blocked on "in-place effect settles before aria-busy clears" (src task,
// supervisor, 2026-10-19): `src/content/action-runtime/in-place-effect.ts` passes
// the press as soon as the pill menu closes and the column turns aria-busy="true",
// before the fetched rows land, so the reply can arrive while the column is busy
// and the read below fails intermittently. The assertion stays; it is the claim.
test.describe("on job-board's in-place filters", () => {
  test("a filter link the page loads in place passes, and the results it loaded are already there when the reply arrives", async ({ openHarness, page }) => {
    const harness = await openHarness("job-board");
    // Arming starts the board over, so the returning visitor's answers come after it.
    await mutate(harness, "set-mode", { mode: "in-place-filters" });
    await mutate(harness, "consent", { choice: "accepted" });
    await mutate(harness, "dismiss-alert-offer");
    await mutate(harness, "minimise-chat");
    await page.goto(new URL("/scenarios/job-board/jobs", harness.lab.origin).href);
    await expect(page.locator("ol article[data-jk]").first()).toBeVisible();
    const address = page.url();
    const count = page.getByText(/^Page \d+ of \d+ jobs$/u);
    await expect(count).toHaveText("Page 1 of 40 jobs");
    // The option lives in the Remote pill's menu, which the board keeps hidden until the pill is pressed.
    await page.getByRole("button", { name: "Remote", exact: true }).click();
    const option = page.getByRole("link", { name: "Remote only", exact: true });
    await option.evaluate((anchor) => anchor.setAttribute("data-spec-filter", ""));
    const href = await option.evaluate((anchor) => (anchor as HTMLAnchorElement).href);
    const reply = await harness.runAction({ commandId: "click-filter", actionType: "web.dom.click", selector: "[data-spec-filter]" });
    expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed", expected: linkExpected(href) } });
    expect(reply.validation).toMatchObject({ actual: expect.stringMatching(IN_PLACE_CONTENT) });
    expect(reply.failure).toBeUndefined();
    // Read once, not awaited: the reply waited for the page's answer, so the
    // next step reads the filtered results rather than racing their fetch.
    expect(await page.locator("[aria-busy]").getAttribute("aria-busy")).toBe("false");
    expect(await count.innerText()).toBe("Page 1 of 28 jobs");
    // The page never moved its address; the results are the whole of its answer.
    expect(page.url()).toBe(address);
  });
});

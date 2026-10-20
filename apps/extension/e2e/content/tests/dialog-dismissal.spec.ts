// A dialog appearing before an action must not fail the action.
//
// **The defect these rows close.** A live run recorded
// `web.action.rejected.blocked_by_dialog` on a `web.output.dom-click` and
// carried on with the effect never applied. The standing product rule is that
// the runtime is defensive by default, for every node, core or custom, and that
// a recoverable obstacle is absorbed rather than recorded -- and that the
// *runtime* carries this, not the model. An interstitial dialog is the single
// most common obstacle on a real web page, so answering one by telling a model
// about it, at the cost of a paid round trip and only when a model remembers,
// was the brittle shape the rule forbids.
//
// **What is asserted.** Against live fixture pages: the action lands, the
// dialog is gone, the fixture's own state records the effect, and the result
// says on its validation what the defence absorbed and what it pressed. That
// last one matters as much as the success: the runtime pressed a control no
// Flow authored, and a debug has to be able to see that it did.
//
// **What must never be pressed** has its own rows at the end, because the
// licence to press a control nobody authored rests entirely on them: a
// challenge is left alone including its "Cancel"; a consequentially-labelled
// control inside an overlay is not a way out; and a consent banner offering
// only a choice about the person's data is not dismissed on their behalf.
//
// The refusals that remain refusals are `dialog-refusal.spec.ts`.
//
// Every row runs on one of the ten realistic scenarios. The dialog whose
// every control is a consequential act is company-website's `account-move`
// mode, which opens it over every page until one of its buttons is pressed.

import type { Page } from "@playwright/test";
import type { BrowserActionResult } from "../../../src/shared/protocol.js";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

/** What the recovery account writes onto a result whose execution closed a dialog. */
const CLOSED_ONE = /absorbing blocking_dialog, closing 1 dialog the page had put in the way/u;

/** The same, for a refusal that named an overlay rather than a declared dialog. */
const CLEARED_OVERLAY = /absorbing obstructed_target, closing 1 dialog the page had put in the way/u;

/** Applies one Scenario Lab operation to the harness's scenario, changing nothing on the page. */
async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

/** Applies one operation, then reloads so the page renders the new state. */
async function applyAndReload(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  await apply(harness, operation, payload);
  await openAndWait(harness, harness.url);
}

/** Navigates the harness page and waits for the content script to announce itself in the new document. */
async function openAndWait(harness: ContentHarness, url: string): Promise<void> {
  await harness.page.goto(url);
  await expect
    .poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady"))
    .toBe(true);
}

/** The validation text an operator reads, or the empty string for a result that validated nothing. */
function validationActual(reply: BrowserActionResult): string {
  return reply.validation.status === "none" ? "" : reply.validation.actual;
}

test.describe("a dialog the page opened over itself", () => {
  test("auction-marketplace: the timed app promotion is closed and the typing lands", async ({ openHarness, page }) => {
    const harness = await openHarness("auction-marketplace");
    // The promotion opens 2.5 s after a home page loads, over a scrim that takes every click.
    const promotion = page.getByRole("dialog", { name: "Bid on the go" });
    await expect(promotion).toBeVisible({ timeout: 8_000 });

    const reply = await harness.runAction({ commandId: "type-behind-promotion", actionType: "web.dom.type", selector: 'input[name="_nkw"]', text: "camera" });

    expect(reply.status, reply.message).toBe("succeeded");
    expect(validationActual(reply)).toMatch(CLOSED_ONE);
    await expect(page.locator('input[name="_nkw"]')).toHaveValue("camera");
    await expect(promotion).toBeHidden();
  });

  test("everything-store: the notifications prompt is closed and the search field is filled", async ({ openHarness, page }) => {
    const harness = await openHarness("everything-store");
    const prompt = page.getByRole("dialog", { name: "Never miss a deal" });
    await expect(prompt).toBeVisible({ timeout: 10_000 });

    const reply = await harness.runAction({ commandId: "type-behind-prompt", actionType: "web.dom.type", selector: 'form[role="search"] input[name="k"]', text: "kettle" });

    expect(reply.status, reply.message).toBe("succeeded");
    expect(validationActual(reply)).toMatch(CLOSED_ONE);
    await expect(page.locator('form[role="search"] input[name="k"]')).toHaveValue("kettle");
    await expect(prompt).toBeHidden();
  });

  test("everything-store: the spin-to-win deal wheel, whose way out is a line of text and not a button", async ({ openHarness, page }) => {
    // The fixture exists precisely to produce this condition, and its decline
    // reads "No thanks, I would rather pay full price" -- a dismissal whose own
    // tail names a payment, which is why the vocabulary matches words and not
    // substrings.
    const harness = await openHarness("everything-store");
    // The mode is set without reloading the home page: the store queues its
    // modals one at a time, and opening the home page first would put the
    // notifications prompt in front of the wheel for as long as it stayed up.
    await apply(harness, "set-mode", { mode: "deal-wheel" });
    await openAndWait(harness, new URL("/scenarios/everything-store/s?k=earbuds", harness.lab.origin).href);
    const wheel = page.getByTestId("deal-wheel");
    await expect(wheel).toBeVisible({ timeout: 30_000 });

    const reply = await harness.runAction({ commandId: "type-behind-wheel", actionType: "web.dom.type", selector: 'form[role="search"] input[name="k"]', text: "kettle" });

    expect(reply.status, reply.message).toBe("succeeded");
    expect(validationActual(reply)).toMatch(CLOSED_ONE);
    await expect(wheel).toBeHidden();
    expect(reply.clearedLayers).toMatchObject([{
      kind: "dialog",
      name: "Spin to win up to 20% off!",
      controlName: "No thanks, I would rather pay full price",
      wayOut: { element: { selector: expect.any(String) } }
    }]);
  });

  test("crossborder-marketplace: a popup that declares no role at all is cleared by its own way out", async ({ openHarness, page }) => {
    const harness = await openHarness("crossborder-marketplace");
    await expect(page.getByText("Welcome back, Mara!", { exact: true })).toBeVisible({ timeout: 8_000 });

    const reply = await harness.runAction({ commandId: "type-behind-welcome", actionType: "web.dom.type", selector: 'input[name="q"]', text: "hub" });

    expect(reply.status, reply.message).toBe("succeeded");
    expect(validationActual(reply)).toMatch(/closing 1 dialog the page had put in the way/u);
    await expect(page.locator('input[name="q"]')).toHaveValue("hub");
    await expect(page.getByText("Welcome back, Mara!", { exact: true })).toBeHidden();
  });
});

/** The state of a scenario as its own server last recorded it, read as the shape the row needs. */
async function siteState<T>(harness: ContentHarness): Promise<T> {
  return (await harness.finalState()).state as unknown as T;
}

/**
 * company-website with its consent wall, chat greeting and newsletter offer
 * already answered, so nothing but the row's own layer is on the page; `mode`
 * arms one of the site's renderings first, because arming starts a new visitor.
 */
async function settledCompanyHome(harness: ContentHarness, mode?: string): Promise<void> {
  if (mode) await apply(harness, "set-mode", { mode });
  await apply(harness, "set-consent", { choice: "essential" });
  await apply(harness, "dismiss-chat-greeting");
  await apply(harness, "dismiss-newsletter");
  await openAndWait(harness, harness.url);
}

/** The header's "Get a free quote": a plain button whose only effect is opening the quote drawer. */
const COMPANY_QUOTE_BUTTON = "header [data-open-quote]";

const quoteDrawerOpen = (page: Page): Promise<boolean> => page.locator("[data-quote-drawer]").evaluate((element) => !(element as HTMLElement).hidden);

test.describe("dialogs that open over the page between and before steps", () => {
  test("photo-social: a dialog whose only ways out are Cancel and the act itself is left alone, and the step still stops", async ({ openHarness, page }) => {
    // Unfollowing asks "Unfollow @lena.moss?" and offers "Unfollow" and
    // "Cancel" and nothing else: no close glyph, no "Not now". Neither is a
    // dismissal. "Cancel" is the one word that means both "close this" and
    // "carry out the cancellation", and the vocabulary is deliberately closed
    // against it. So the defence runs, finds nothing it may press, and the
    // page's own refusal stands -- which is the right answer and not a gap.
    const harness = await openHarness("photo-social");
    await apply(harness, "consent", { choice: "essential" });
    await apply(harness, "dock", { minimized: true });
    const profile = new URL("/scenarios/photo-social/lena.moss/", harness.lab.origin).href;
    await openAndWait(harness, profile);
    await expect(page.locator('main a[href*="/p/"]').first()).toBeVisible();
    await page.locator('main header div[role="button"]', { hasText: "Following" }).click();
    const confirm = page.getByRole("dialog").filter({ hasText: "Unfollow @lena.moss?" });
    await expect(confirm).toBeVisible();

    const reply = await harness.runAction({ commandId: "click-behind-unfollow", actionType: "web.dom.click", selector: 'main a[href*="/p/"]', timeoutMs: 4_000 });

    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).toBe("web.action.blocked_by_dialog");
    // The defence was reached and was not enough, and the record says so rather
    // than hiding it: every attempt spent, no dialog closed.
    expect(reply.failure?.actual).toMatch(/did not recover within its \d+ attempts after absorbing blocking_dialog/u);
    expect(reply.failure?.actual).not.toMatch(/closing/u);
    expect((await siteState<{ following: string[] }>(harness)).following).toContain("lena.moss");
    await expect(confirm).toBeVisible();
    expect(page.url()).toBe(profile);
  });

  test("auction-marketplace (W14): the promotion that opens between two steps no longer stops the second", async ({ openHarness, page }) => {
    const harness = await openHarness("auction-marketplace");
    const promotion = page.getByRole("dialog", { name: "Bid on the go" });
    // The first step runs before the promotion's 2.5 s timer: nothing is in the way.
    const first = await harness.runAction({ commandId: "type-first", actionType: "web.dom.type", selector: 'input[name="_nkw"]', text: "kestrel" });
    expect(first.status, first.message).toBe("succeeded");
    expect(validationActual(first)).not.toMatch(/closing/u);
    await expect(promotion).toBeVisible({ timeout: 8_000 });

    const second = await harness.runAction({ commandId: "type-second", actionType: "web.dom.type", selector: 'input[name="_nkw"]', text: "camera" });

    expect(second.status, second.message).toBe("succeeded");
    expect(validationActual(second)).toMatch(CLOSED_ONE);
    await expect(page.locator('input[name="_nkw"]')).toHaveValue("camera");
    await expect(promotion).toBeHidden();
    // The page's own way out is what closed it: the site recorded the dismissal.
    expect((await siteState<{ promoDismissed: boolean }>(harness)).promoDismissed).toBe(true);
  });

  test("local-classifieds: the notifications prompt is closed by its Not now, never by Turn on", async ({ openHarness, page }) => {
    const harness = await openHarness("local-classifieds");
    await applyAndReload(harness, "consent", { choice: "essential" });
    const prompt = page.getByRole("dialog", { name: "Turn on notifications?" });
    await expect(prompt).toBeVisible({ timeout: 10_000 });

    const reply = await harness.runAction({ commandId: "behind-notifications", actionType: "web.dom.type", selector: 'input[aria-label="Search Marketplace"]', text: "bike" });

    expect(reply.status, reply.message).toBe("succeeded");
    expect(validationActual(reply)).toMatch(CLOSED_ONE);
    await expect(page.locator('input[aria-label="Search Marketplace"]')).toHaveValue("bike");
    await expect(prompt).toBeHidden();
    expect((await siteState<{ notificationPrompt: string }>(harness)).notificationPrompt).toBe("dismissed");
  });

  // --- What a dismissal may never become ----------------------------------

  test("a consequentially-labelled control inside the overlay is not a way out, so nothing is pressed", async ({ openHarness, page }) => {
    // company-website's `account-move` mode: before customer accounts move to
    // a new booking system, "Before you go" opens over every page. Every
    // control begins with a dismissal word and ends in an act on something
    // the person owns. Any of them closes the dialog and the site records
    // which was pressed, so a press would let the click land and show in the
    // site's own state: the refusal and the state below are the assertion.
    const harness = await openHarness("company-website");
    await settledCompanyHome(harness, "account-move");
    await expect(page.getByRole("dialog", { name: "Before you go" })).toBeVisible();

    const reply = await harness.runAction({ commandId: "behind-destructive-dialog", actionType: "web.dom.click", selector: COMPANY_QUOTE_BUTTON, timeoutMs: 4_000 });

    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).toBe("web.action.blocked_by_dialog");
    expect(await quoteDrawerOpen(page), "the click never landed").toBe(false);
    // Nothing on the dialog was pressed: it is still exactly as the page left it.
    await expect(page.getByRole("button", { name: "Close account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip and delete my drafts" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Not now, cancel my subscription" })).toBeVisible();
    expect(await siteState<{ mode: string; interstitial: { pressed: string | null } }>(harness)).toMatchObject({ mode: "account-move", interstitial: { pressed: null } });
  });

  test("company-website: the quote form's human check is left alone including its own close, and the step still stops for the person", async ({ openHarness, page }) => {
    // The quote drawer turns into "Confirm you are human" once its form is
    // sent. The drawer keeps its close glyph and its scrim, and a press
    // behind it must touch neither: a robot check is the person's, way out or
    // no way out.
    const harness = await openHarness("company-website");
    await settledCompanyHome(harness);
    await page.locator(COMPANY_QUOTE_BUTTON).click();
    await page.fill('input[name="fullName"]', "Ada Synthetic");
    await page.fill('input[name="email"]', "ada.synthetic@example.test");
    await page.fill('input[name="phone"]', "07700 900123");
    await page.fill('input[name="postcode"]', "KL6 2RN");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByText("Choose a service", { exact: true }).click();
    await page.locator('[data-value="Boiler service"]').click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.locator('input[name="privacy"]').check();
    await page.locator('[data-testid="quote-submit"]').click();
    await expect(page.getByText("Confirm you are human")).toBeVisible({ timeout: 8_000 });
    const before = page.url();

    const reply = await harness.runAction({ commandId: "behind-human-check", actionType: "web.dom.click", selector: 'nav[aria-label="Main"] a[href$="/branches"]', timeoutMs: 4_000 });

    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).toBe("web.intervention.required");
    expect(page.url(), "the link behind the check was never followed").toBe(before);
    expect(await quoteDrawerOpen(page), "the drawer's close and scrim were left alone").toBe(true);
    await expect(page.getByText("Confirm you are human")).toBeVisible();
    expect((await siteState<{ quotes: unknown[] }>(harness)).quotes).toEqual([]);
  });

  test("bigbox-retail: the consent dialog over the step is rejected, never accepted, and the typing then lands", async ({ openHarness, page }) => {
    // A modal consent dialog over a scrim that takes every click, offering
    // Accept all, Reject all and Manage choices. Since 2026-09-30 declining
    // optional cookies is a way out of a consent layer and accepting never is
    // (`interference/vocabulary.ts`): declining consents to nothing, so the
    // defence presses Reject all, and the step under the dialog then lands.
    const harness = await openHarness("bigbox-retail");
    await expect(page.locator('[role="dialog"][aria-modal="true"]')).toBeVisible();

    const reply = await harness.runAction({ commandId: "type-under-consent", actionType: "web.dom.type", selector: 'header input[name="q"]', text: "paper towels", timeoutMs: 4_000 });

    expect(reply.status, reply.message).toBe("succeeded");
    await expect(page.locator('header input[name="q"]')).toHaveValue("paper towels");
    expect((await siteState<{ consent: string }>(harness)).consent).toBe("rejected");
  });
});


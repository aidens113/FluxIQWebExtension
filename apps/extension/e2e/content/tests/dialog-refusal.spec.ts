// A target behind a dialog, against live pages: which refusals are the page in
// a state the runtime clears for itself, and which are a challenge only a
// person may answer.
//
// The line (`src/content/action-runtime/blocking-dialog.ts`) is drawn on what
// the page declares, never on which site it is. A dialog standing over the page
// is `web.action.blocked_by_dialog` -- Core's `unexpected_state` -- unless it
// asks for what only a person can give: a robot check, a password or
// verification code, a payment confirmation. Those, and a page that is itself a
// robot check, are `web.intervention.required`, which Core never offers to a
// model.
//
// **What this file is for now.** The dismissible half of that line stopped
// being observable here on 2026-09-28, when the runtime gained the defence that
// closes such a dialog and runs the action again: those pages now *succeed*,
// and `dialog-dismissal.spec.ts` owns them. What stays here is everything that
// must still stop -- the person's challenges, a page that is itself one, and an
// overlay that is not a dialog at all -- because the value of the classification
// is now almost entirely in what it refuses to clear.
//
// Until 2026-09-21 every painted modal was `web.intervention.required`. Live on
// the auction marketplace, the app promotion that opens a few seconds after a
// page loads -- it has its own "Not now" -- stopped a replayed Flow at its first
// press, and Core, correctly for that category, refused to ask the model how to
// get past it. That promotion is now closed by the runtime without anybody
// being asked (`dialog-dismissal.spec.ts`).
//
// Rows, by fixture:
//   - everything-store: the robot check the store serves in place of every
//     page, which must stay the person's and be left untouched.
//   - company-website: the consent wall, which is declined when it can be;
//     and the account and security dialogs the site opens over its settled
//     home page in one mode each (`security-check`, `captcha-check`,
//     `sign-in-again`, `sign-in-code`, `card-on-file`,
//     `deposit-authorisation`) -- a robot check, a password or code prompt,
//     and a card form or payment confirmation inside an aria-modal dialog are
//     the person's even when the dialog also offers a way out.
//   - crossborder-marketplace: a cookie banner that is not a dialog and, with
//     its declines taken away, offers no way out: an ordinary refusal.
//
// Scope: this is the content script's own decision against a live DOM. What
// Core does with each category is Core's; the Lab's replay and repair runs are
// the end-to-end proof.
import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { Page } from "@playwright/test";
import { INTERSTITIALS } from "../../../../scenario-lab/src/scenarios/company-website/data/index.js";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

const NEEDS_PERSON = {
  category: "user_intervention_required",
  code: WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED,
  retryable: false,
  stage: "execution"
};

/** Applies one Scenario Lab operation to the harness's scenario, changing nothing on the page. */
async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

/** Navigates the harness page and waits for the content script to announce itself in the new document. */
async function openAndWait(harness: ContentHarness, url: string): Promise<void> {
  await harness.page.goto(url);
  await expect
    .poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady"))
    .toBe(true);
}

/** Applies one Scenario Lab operation to the harness's scenario, then reloads so the page renders the new state. */
async function applyAndReload(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  await apply(harness, operation, payload);
  await openAndWait(harness, harness.url);
}

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

test.describe("everything-store", () => {
  test("the robot check served in place of the page stays the person's, and nothing touches it", async ({ openHarness, page }) => {
    const harness = await openHarness("everything-store");
    await applyAndReload(harness, "set-mode", { mode: "robot-check" });
    await expect(page.getByTestId("robot-check")).toBeVisible();

    // A replayed Flow's first press: the cookie banner's Accept, which the challenge replaced.
    const reply = await harness.runAction({ commandId: "accept-on-challenge", actionType: "web.dom.click", selector: '[data-consent="accept"]', timeoutMs: 1_000 });

    expect(reply).toMatchObject({ status: "failed", failure: NEEDS_PERSON });
    expect(reply.failure?.actual).toMatch(/; the document is a robot check, which only a person can answer$/u);
    // No guess was typed and no new image was asked for.
    await expect(page.getByTestId("robot-check-error")).toHaveCount(0);
  });
});

test.describe("company-website", () => {
  // The consent platform's wall: a declarative shadow root whose host covers
  // the whole viewport, holding an aria-modal dialog with Customise, "Reject
  // non-essential" and "Accept all". A wall that can be declined is a layer
  // the defence clears, by declining, because declining gives nothing away
  // (`blocking-dialog.ts`, since 2026-09-29, f8135495). The quote drawer is in
  // the same page's markup with `aria-modal="true"` and `hidden`; a dialog the
  // page is not painting is not a layer, so it is never cleared.
  test("a cookie wall that can be declined is declined, never accepted, and a dialog the page is not painting is not touched", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    // The chat greeting would otherwise open over the wall's answers at 1.8 s.
    await applyAndReload(harness, "dismiss-chat-greeting");
    expect(await quoteDrawerOpen(page), "the drawer is in the markup, hidden").toBe(false);

    const reply = await harness.runAction({ commandId: "click-under-wall", actionType: "web.dom.click", selector: COMPANY_QUOTE_BUTTON });

    expect(reply.status, `${reply.message}`).toBe("succeeded");
    expect(reply.clearedLayers).toEqual([expect.objectContaining({
      kind: "consent",
      name: "Your privacy choices",
      control: "Reject",
      controlName: "Reject non-essential",
      wayOut: { url: expect.any(String), element: expect.objectContaining({ selector: expect.any(String) }) }
    })]);
    // The step's own effect: the drawer it opens, which nothing cleared on the way.
    expect(await quoteDrawerOpen(page)).toBe(true);
    expect((await siteState<{ consent: string; quotes: unknown[]; drafts: number }>(harness))).toMatchObject({ consent: "essential", quotes: [], drafts: 0 });
  });

  // Each row arms the mode in which company-website opens that dialog over
  // every page until one of its buttons is pressed (`data/interstitials.ts`):
  // a returning customer's password or texted code, a card for a plan's
  // renewal, the bank's confirmation of a deposit, and the bot filter's
  // picture check or vendor checkbox. Every button closes the dialog and the
  // server records which was pressed, so a press would both let the step
  // land and show in the site's own state. The step behind each is the
  // header's "Get a free quote". (The quote form's own robot check is a
  // dialog-dismissal row.)
  const CHALLENGES: Array<[string, keyof typeof INTERSTITIALS, string]> = [
    ["a robot check", "security-check", "a robot check"],
    ["a vendor captcha frame", "captcha-check", "a robot check"],
    ["a password prompt", "sign-in-again", "a request for a password or a verification code"],
    ["a second-factor prompt", "sign-in-code", "a request for a password or a verification code"],
    ["a card form", "card-on-file", "a payment confirmation"],
    ["a payment confirmation", "deposit-authorisation", "a payment confirmation"]
  ];

  for (const [name, mode, sentence] of CHALLENGES) {
    test(`a dialog holding ${name} is the person's, even when it offers a way out`, async ({ openHarness, page }) => {
      const harness = await openHarness("company-website");
      await settledCompanyHome(harness, mode);
      const dialog = page.getByRole("dialog", { name: INTERSTITIALS[mode]!.label });
      await expect(dialog).toBeVisible();

      const reply = await harness.runAction({ commandId: `behind-${name.replace(/\W+/gu, "-")}`, actionType: "web.dom.click", selector: COMPANY_QUOTE_BUTTON });

      expect(reply).toMatchObject({ status: "failed", failure: NEEDS_PERSON });
      expect(reply.failure?.actual).toMatch(new RegExp(`^covered: .*; ${sentence} is open over the page, so a person has to answer it before the run can continue$`, "u"));
      expect(await quoteDrawerOpen(page), "the step behind the challenge never landed").toBe(false);
      // Nothing on the dialog was pressed: it is still open, and the site recorded no answer.
      await expect(dialog).toBeVisible();
      expect(await siteState<{ mode: string; interstitial: { pressed: string | null } }>(harness)).toMatchObject({ mode, interstitial: { pressed: null } });
    });
  }
});

test.describe("crossborder-marketplace", () => {
  test("a cookie banner that is not a dialog and offers no way out stays a rejection", async ({ openHarness, page }) => {
    // Farbazaar's cookie banner is fixed to the bottom of the page above the
    // pinned buy bar, and declares no dialog. As shipped it can be declined,
    // which the defence would do; with "Manage choices" and "Reject
    // non-essential" taken away only "Accept all" is left, which gives
    // something away, so nothing here may press it.
    const harness = await openHarness("crossborder-marketplace");
    await apply(harness, "welcome", { action: "close" });
    await apply(harness, "notifications", { answer: "later" });
    await apply(harness, "chat", { view: "minimized" });
    await openAndWait(harness, new URL("/scenarios/crossborder-marketplace/item/1005008123450", harness.lab.origin).href);
    await expect(page.getByTestId("add-to-cart")).toBeVisible();
    for (const way of ["Manage choices", "Reject non-essential"]) {
      await page.getByText(way, { exact: true }).evaluate((element) => element.remove());
    }

    const reply = await harness.runAction({ commandId: "click-under-banner", actionType: "web.dom.click", selector: '[data-testid="add-to-cart"]', timeoutMs: 3_000 });

    expect(reply).toMatchObject({
      status: "failed",
      failure: { category: "unexpected_state", code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE, retryable: false, stage: "execution" }
    });
    expect(reply.failure?.actual).toMatch(/^covered: /u);
    expect(reply.message).toMatch(/^Action rejected: /u);
    expect((await siteState<{ consent: string; cart: unknown[] }>(harness))).toMatchObject({ consent: "pending", cart: [] });
  });
});

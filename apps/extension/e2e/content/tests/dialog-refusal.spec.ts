// A target behind a dialog, against live pages: which refusals are the page in
// a state recovery may deal with, and which are a challenge only a person may
// answer.
//
// The line (`src/content/action-runtime/blocking-dialog.ts`) is drawn on what
// the page declares, never on which site it is. A dialog standing over the page
// is `web.action.blocked_by_dialog` -- Core's `unexpected_state`, which
// recovery can act on -- unless it asks for what only a person can give: a
// robot check, a password or verification code, a payment confirmation. Those,
// and a page that is itself a robot check, are `web.intervention.required`,
// which Core never offers to a model.
//
// Until 2026-09-21 every painted modal was `web.intervention.required`. Live on
// the auction marketplace, the app promotion that opens a few seconds after a
// page loads -- it has its own "Not now" -- stopped a replayed Flow at its first
// press, and Core, correctly for that category, refused to ask the model how to
// get past it. That promotion is the first row below.
//
// Rows, by fixture:
//   - auction-marketplace: the timed app promotion (aria-modal, "Not now").
//   - everything-store: the notifications prompt (aria-modal, "Not now"); and
//     the robot check the store serves in place of every page, which must stay
//     the person's and be left untouched.
//   - crossborder-marketplace: the welcome-coupon popup, which declares no role
//     at all and is a dialog only by its own way out ("×", "No thanks").
//   - modal-flows: the invite dialog the page opens itself (the `inert`
//     shape), the W14 interstitial, and the consent banner, which is not a
//     dialog and stays an ordinary refusal.
//   - challenge dialogs added to a page: a robot check, a password or code
//     prompt, and a card form or payment confirmation inside an aria-modal
//     dialog are the person's even when the dialog also offers a way out,
//     while the same dialog with none of them is not.
//
// Scope: this is the content script's own decision against a live DOM. What
// Core does with each category is Core's; the Lab's replay and repair runs are
// the end-to-end proof.

import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

const BLOCKED_BY_DIALOG = {
  category: "unexpected_state",
  code: WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG,
  retryable: false,
  stage: "execution"
};

const NEEDS_PERSON = {
  category: "user_intervention_required",
  code: WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED,
  retryable: false,
  stage: "execution"
};

const DISMISSIBLE_SENTENCE = "a dialog is open over the page and asks for nothing only a person can give, so it has to be answered or closed before the target can be reached";

/** Applies one Scenario Lab operation to the harness's scenario, then reloads so the page renders the new state. */
async function applyAndReload(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
  await harness.page.goto(harness.url);
  await expect
    .poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady"))
    .toBe(true);
}

/** Opens an aria-modal dialog over the page holding `inner`, as a page's own script would. */
async function openDialog(page: Page, inner: string): Promise<void> {
  await page.evaluate((html) => {
    const scrim = document.createElement("div");
    scrim.setAttribute("style", "position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:rgb(0 0 0 / .5)");
    scrim.innerHTML = `<div role="dialog" aria-modal="true" aria-label="Test dialog" style="background:#fff;padding:24px;width:360px">${html}</div>`;
    document.body.append(scrim);
  }, inner);
}

test.describe("auction-marketplace", () => {
  test("the timed app promotion is a dialog recovery may close, not a person's job", async ({ openHarness, page }) => {
    const harness = await openHarness("auction-marketplace");
    // The promotion opens 2.5 s after a home page loads, over a scrim that takes every click.
    const promotion = page.getByRole("dialog", { name: "Bid on the go" });
    await expect(promotion).toBeVisible({ timeout: 8_000 });

    const reply = await harness.runAction({ commandId: "type-behind-promotion", actionType: "web.dom.type", selector: 'input[name="_nkw"]', text: "camera" });

    expect(reply).toMatchObject({ status: "failed", failure: BLOCKED_BY_DIALOG });
    expect(reply.failure?.actual).toMatch(new RegExp(`^covered: .*; ${DISMISSIBLE_SENTENCE}$`, "u"));
    expect(reply.message).toMatch(/^Action blocked: /u);
    // Nothing was typed through the scrim, and the promotion is still up.
    await expect(page.locator('input[name="_nkw"]')).toHaveValue("");
    await expect(promotion).toBeVisible();
  });
});

test.describe("everything-store", () => {
  test("the notifications prompt is a dialog recovery may close", async ({ openHarness, page }) => {
    const harness = await openHarness("everything-store");
    const prompt = page.getByRole("dialog", { name: "Never miss a deal" });
    await expect(prompt).toBeVisible({ timeout: 10_000 });

    const reply = await harness.runAction({ commandId: "type-behind-prompt", actionType: "web.dom.type", selector: 'form[role="search"] input[name="k"]', text: "kettle" });

    expect(reply).toMatchObject({ status: "failed", failure: BLOCKED_BY_DIALOG });
    await expect(page.locator('form[role="search"] input[name="k"]')).toHaveValue("");
  });

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

test.describe("crossborder-marketplace", () => {
  test("a popup that declares no role is a dialog by its own way out", async ({ openHarness, page }) => {
    const harness = await openHarness("crossborder-marketplace");
    await expect(page.getByText("Welcome back, Mara!", { exact: true })).toBeVisible({ timeout: 8_000 });

    const reply = await harness.runAction({ commandId: "type-behind-welcome", actionType: "web.dom.type", selector: 'input[name="q"]', text: "hub" });

    expect(reply).toMatchObject({ status: "failed", failure: BLOCKED_BY_DIALOG });
    expect(reply.failure?.actual).toMatch(/^covered: /u);
    await expect(page.locator('input[name="q"]')).toHaveValue("");
  });
});

test.describe("modal-flows", () => {
  const ADD_SECTION = "[data-testid=\"add-section\"]";
  const PUBLISH = "[data-testid=\"publish-draft\"]";
  const OPEN_INVITE = "[data-testid=\"open-invite\"]";
  const INVITE_DIALOG = "[data-testid=\"invite-dialog\"]";
  const INTERSTITIAL = "[data-testid=\"interstitial\"]";

  test("a target behind a modal the page opened itself is blocked by that dialog, in the inert shape", async ({ openHarness, page }) => {
    const harness = await openHarness("modal-flows");
    // Opened by the page, as a person would: the dialog is shown and the shell
    // behind it is marked inert, which is the whole of the ARIA modal contract.
    await page.locator(OPEN_INVITE).click();
    await expect(page.locator(INVITE_DIALOG)).toBeVisible();

    const reply = await harness.runAction({ commandId: "click-behind-modal", actionType: "web.dom.click", selector: ADD_SECTION });

    expect(reply).toMatchObject({ status: "failed", failure: BLOCKED_BY_DIALOG });
    // The refusal itself is unchanged and still says which property stopped it.
    expect(reply.validation).toMatchObject({ status: "failed", expected: "a target that can be clicked", actual: "the element is inert" });
    expect(reply.failure?.actual).toBe(`hidden: the element is inert; ${DISMISSIBLE_SENTENCE}`);
    // The refusal is real: the run did not click through the dialog.
    expect((await harness.finalState()).state).toMatchObject({ sectionCount: 0 });
  });

  test("W14: the armed interstitial stops the second Add section, as a dialog to deal with", async ({ openHarness, page }) => {
    const harness = await openHarness("modal-flows");
    await applyAndReload(harness, "arm-interstitial");

    const first = await harness.runAction({ commandId: "add-first", actionType: "web.dom.click", selector: ADD_SECTION });
    expect(first.status, first.message).toBe("succeeded");
    await expect(page.locator(INTERSTITIAL)).toBeVisible();

    const second = await harness.runAction({ commandId: "add-second", actionType: "web.dom.click", selector: ADD_SECTION });

    expect(second).toMatchObject({ status: "failed", failure: BLOCKED_BY_DIALOG });
    // One section added, the offer still up: nothing clicked through it.
    expect((await harness.finalState()).state).toMatchObject({ sectionCount: 1, interstitial: "open" });
    await expect(page.locator(INTERSTITIAL)).toBeVisible();
  });

  test("an overlay that is not a dialog stays a rejection, and a dialog the page is not painting does not count", async ({ openHarness }) => {
    const harness = await openHarness("modal-flows");

    // The consent banner is fixed over the action bar and owns the primary
    // action, but it declares no dialog, makes nothing inert, and offers no way
    // out but a choice about cookies. Meanwhile the invite dialog is in the
    // markup with `aria-modal="true"` and `hidden`.
    const reply = await harness.runAction({ commandId: "click-under-banner", actionType: "web.dom.click", selector: PUBLISH });

    expect(reply).toMatchObject({
      status: "failed",
      failure: { category: "blocked_by_capability_or_policy", code: WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, retryable: false, stage: "execution" }
    });
    expect(reply.failure?.actual).toMatch(/^covered: /u);
    expect(reply.message).toMatch(/^Action rejected: /u);
    expect((await harness.finalState()).state).toMatchObject({ publishCount: 0 });
  });

  const CHALLENGES: Array<[string, string, string]> = [
    ["a robot check", "<h2>Security check</h2><p>Type the characters you see in the image.</p><canvas role=\"img\" aria-label=\"Security image\" width=\"200\" height=\"60\"></canvas><input aria-label=\"Characters\"><button type=\"button\">Verify</button><button type=\"button\">Close</button>", "a robot check"],
    ["a vendor captcha frame", "<iframe title=\"reCAPTCHA\" src=\"about:blank\" width=\"304\" height=\"78\"></iframe><button type=\"button\">Not now</button>", "a robot check"],
    ["a password prompt", "<h2>Confirm it is you</h2><form><input type=\"password\" aria-label=\"Password\"><button type=\"submit\">Continue</button></form><button type=\"button\">Cancel</button>", "a request for a password or a verification code"],
    ["a second-factor prompt", "<h2>Enter the code we sent</h2><input autocomplete=\"one-time-code\" aria-label=\"Code\"><button type=\"button\">Cancel</button>", "a request for a password or a verification code"],
    ["a card form", "<h2>Add a card</h2><input autocomplete=\"cc-number\" aria-label=\"Card number\"><button type=\"button\">No thanks</button>", "a payment confirmation"],
    ["a payment confirmation", "<h2>Confirm your payment</h2><p>Authorize this payment of 42.00 with your bank.</p><button type=\"button\">Cancel</button>", "a payment confirmation"]
  ];

  for (const [name, inner, sentence] of CHALLENGES) {
    test(`a dialog holding ${name} is the person's, even when it offers a way out`, async ({ openHarness, page }) => {
      const harness = await openHarness("modal-flows");
      await openDialog(page, inner);

      const reply = await harness.runAction({ commandId: `behind-${name.replace(/\W+/gu, "-")}`, actionType: "web.dom.click", selector: ADD_SECTION });

      expect(reply).toMatchObject({ status: "failed", failure: NEEDS_PERSON });
      expect(reply.failure?.actual).toMatch(new RegExp(`^covered: .*; ${sentence} is open over the page, so a person has to answer it before the run can continue$`, "u"));
      expect((await harness.finalState()).state).toMatchObject({ sectionCount: 0 });
    });
  }

  test("the same dialog with nothing a person alone must give is one recovery may close", async ({ openHarness, page }) => {
    const harness = await openHarness("modal-flows");
    await openDialog(page, "<h2>Get the app</h2><p>Scan the code with your phone.</p><button type=\"button\">Not now</button>");

    const reply = await harness.runAction({ commandId: "behind-promotion", actionType: "web.dom.click", selector: ADD_SECTION });

    expect(reply).toMatchObject({ status: "failed", failure: BLOCKED_BY_DIALOG });
  });
});

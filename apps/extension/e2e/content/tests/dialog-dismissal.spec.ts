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

/**
 * Opens an aria-modal dialog over the page holding `inner`, as a page's own
 * script would, with every button wired to close it.
 *
 * The wiring is what makes these rows mean anything. A dialog whose controls do
 * nothing cannot be told apart from one the runtime declined to press, so a
 * press that should not happen would look exactly like a press that happened and
 * had no effect -- and the rows below that assert nothing was pressed would
 * prove nothing at all.
 */
async function openDialog(page: Page, inner: string): Promise<void> {
  await page.evaluate((html) => {
    const scrim = document.createElement("div");
    scrim.setAttribute("style", "position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:rgb(0 0 0 / .5)");
    scrim.innerHTML = `<div role="dialog" aria-modal="true" aria-label="Test dialog" style="background:#fff;padding:24px;width:360px">${html}</div>`;
    document.body.append(scrim);
    for (const button of scrim.querySelectorAll("button")) {
      button.addEventListener("click", () => { scrim.remove(); });
    }
  }, inner);
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

test.describe("modal-flows", () => {
  const ADD_SECTION = '[data-testid="add-section"]';
  const OPEN_INVITE = '[data-testid="open-invite"]';
  const INVITE_DIALOG = '[data-testid="invite-dialog"]';
  const INTERSTITIAL = '[data-testid="interstitial"]';

  test("a dialog whose only way out is Cancel is left alone, and the step still stops", async ({ openHarness, page }) => {
    // The invite dialog offers "Cancel" and "Confirm" and nothing else. Neither
    // is a dismissal: "Cancel" is the one word that means both "close this" and
    // "carry out the cancellation", and the vocabulary is deliberately closed
    // against it. So the defence runs, finds nothing it may press, and the page's
    // own refusal stands -- which is the right answer and not a gap.
    const harness = await openHarness("modal-flows");
    await page.locator(OPEN_INVITE).click();
    await expect(page.locator(INVITE_DIALOG)).toBeVisible();

    const reply = await harness.runAction({ commandId: "click-behind-modal", actionType: "web.dom.click", selector: ADD_SECTION, timeoutMs: 4_000 });

    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).toBe("web.action.blocked_by_dialog");
    // The defence was reached and was not enough, and the record says so rather
    // than hiding it: three attempts, no dialog closed.
    expect(reply.failure?.actual).toMatch(/did not recover within its 4 attempts after absorbing blocking_dialog/u);
    expect(reply.failure?.actual).not.toMatch(/closing/u);
    expect((await harness.finalState()).state).toMatchObject({ sectionCount: 0 });
    await expect(page.locator(INVITE_DIALOG)).toBeVisible();
  });

  test("W14: the interstitial that opens between two clicks no longer stops the second", async ({ openHarness, page }) => {
    const harness = await openHarness("modal-flows");
    await applyAndReload(harness, "arm-interstitial");

    const first = await harness.runAction({ commandId: "add-first", actionType: "web.dom.click", selector: ADD_SECTION });
    expect(first.status, first.message).toBe("succeeded");
    await expect(page.locator(INTERSTITIAL)).toBeVisible();

    const second = await harness.runAction({ commandId: "add-second", actionType: "web.dom.click", selector: ADD_SECTION });

    expect(second.status, second.message).toBe("succeeded");
    expect(validationActual(second)).toMatch(CLOSED_ONE);
    expect((await harness.finalState()).state).toMatchObject({ sectionCount: 2 });
    await expect(page.locator(INTERSTITIAL)).toBeHidden();
  });

  test("an injected promotion is closed by its Not now", async ({ openHarness, page }) => {
    const harness = await openHarness("modal-flows");
    await openDialog(page, '<h2>Get the app</h2><p>Scan the code with your phone.</p><button type="button">Not now</button>');

    const reply = await harness.runAction({ commandId: "behind-promotion", actionType: "web.dom.click", selector: ADD_SECTION });

    expect(reply.status, reply.message).toBe("succeeded");
    expect(validationActual(reply)).toMatch(CLOSED_ONE);
    expect((await harness.finalState()).state).toMatchObject({ sectionCount: 1 });
  });

  // --- What a dismissal may never become ----------------------------------

  test("a consequentially-labelled control inside the overlay is not a way out, so nothing is pressed", async ({ openHarness, page }) => {
    // Every control here begins with a dismissal word and ends in an act on
    // something the person owns. If any were pressed the dialog would close and
    // the click would land, so the refusal below is the assertion.
    const harness = await openHarness("modal-flows");
    await openDialog(
      page,
      '<h2>Before you go</h2><button type="button">Close account</button><button type="button">Skip and delete my drafts</button><button type="button">Not now, cancel my subscription</button>'
    );

    const reply = await harness.runAction({ commandId: "behind-destructive-dialog", actionType: "web.dom.click", selector: ADD_SECTION, timeoutMs: 4_000 });

    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).toBe("web.action.blocked_by_dialog");
    expect((await harness.finalState()).state).toMatchObject({ sectionCount: 0 });
    // Nothing on the dialog was pressed: it is still exactly as the page left it.
    await expect(page.getByRole("button", { name: "Close account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip and delete my drafts" })).toBeVisible();
  });

  test("a challenge is left alone including its own Cancel, and the step still stops for the person", async ({ openHarness, page }) => {
    const harness = await openHarness("modal-flows");
    await openDialog(
      page,
      '<h2>Security check</h2><p>Type the characters you see in the image.</p><canvas role="img" aria-label="Security image" width="200" height="60"></canvas><input aria-label="Characters"><button type="button">Not now</button><button type="button">Close</button>'
    );

    const reply = await harness.runAction({ commandId: "behind-robot-check", actionType: "web.dom.click", selector: ADD_SECTION, timeoutMs: 4_000 });

    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).toBe("web.intervention.required");
    expect((await harness.finalState()).state).toMatchObject({ sectionCount: 0 });
    // The two ways out it offers are untouched: a robot check is the person's,
    // way out or no way out.
    await expect(page.getByRole("button", { name: "Not now" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  });

  test("a consent banner offering only a choice about the person's data is not answered for them", async ({ openHarness }) => {
    // It is fixed over the action bar and owns the primary action, but its only
    // controls are Accept and Reject, which are a decision about the person's
    // data rather than a way out. The action stays refused.
    const harness = await openHarness("modal-flows");

    const reply = await harness.runAction({ commandId: "click-under-banner", actionType: "web.dom.click", selector: '[data-testid="publish-draft"]', timeoutMs: 4_000 });

    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).toBe("web.action.rejected");
    expect((await harness.finalState()).state).toMatchObject({ publishCount: 0 });
  });
});

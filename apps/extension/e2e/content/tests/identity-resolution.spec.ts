// How the content script chooses the element an action acts on, once the page
// has moved on from the recording (Phase 1.3 step 3), on realistic pages only
// (AGENTS.md, user 2026-09-29).
//
// A replayed action finds its control through whichever signal the drift left
// standing. The drifts here are the sites' own: company-website's next deploy
// (another lab seed) redraws every generated id and hashed class, bigbox's
// `redesigned-buy-box` moves Add to cart into the buy box and puts Buy now in
// its slot, crossborder's `basket-redesign` renames the button outright. The
// rows replay the *recorded* descriptor -- read off the page through
// `web.dom.extract`, not hand-written -- so what is exercised is the resolution
// a real replay performs, not a fingerprint invented to suit it.
//
// And a visual target's document bounds win over the viewport bounds recorded
// beside them. Viewport bounds say where the element was on screen when it was
// captured; after any scroll they point at whatever has since moved into that
// spot, which is how a click lands on a sticky header.
//
// Scored selection: Core's element matcher ships to the browser from
// `fluxiq/automation-studio/fingerprinting`, and the resolver hands it the
// candidates whenever an exact answer is not one. It resolves the winner only
// when the winner clears the floor and beats the runner-up by a margin. What
// scoring does *not* do is guess: company-website's `redesigned-quote-submit`
// takes Send request's words, test id and id at once and puts "Save and finish
// later" in its slot, and the resolver refuses on both paths -- the variant's
// manifest says only a repair can pass it -- while an applied repair resolves.
//
// One subject per file. `identity-ambiguity.spec.ts` holds what happens when
// two controls answer to one description; `identity-veto.spec.ts` holds the
// check a fast Level 1 answer passes before it is acted on;
// `identity-fixtures.ts` holds the helpers all three share, and the scope
// caveat that applies to every row in all three.
//
// Read the resolution shapes together: an exact match, a tie broken by the
// recorded name, a scored recovery, and a refusal. The status alone cannot tell
// the middle two apart; the reported strategy and scores can.

import type { Page } from "@playwright/test";
import { outputTargetFromPayload, webAutomationActionFromGatewayCommand, webAutomationOutputPayload } from "@fluxiq-web-extension/domain/client";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";
import {
  TARGET_AMBIGUOUS,
  TARGET_NOT_FOUND,
  describe,
  documentRect,
  labMutate,
  openPath,
  quoteDrawer,
  recordedElement,
  trackClicks,
  visualTarget,
  type Descriptor,
  type Rect
} from "./identity-fixtures.js";

type NodePayload = Parameters<typeof webAutomationOutputPayload>[1];
type Command = Parameters<ContentHarness["runAction"]>[0];

// Refusals retry for several seconds before they answer, and several rows make two.
test.describe.configure({ timeout: 120_000 });

const ids = quoteDrawer.ids();
const byId = quoteDrawer.byId;
/** company-website's deploy after the recorded one: the lab seed renames every class and generated id and changes nothing else. */
const REDEPLOYED_SEED = 4520;
const redeployed = quoteDrawer.ids(REDEPLOYED_SEED);
/** Any press on one of the quote form's actions, or on a control standing in for one. */
const QUOTE_ACTION = /Send request|Save and finish later|Get my free quote|Continue|Back/u;
const PRIVACY_ERROR = "Tick the box so we can contact you about this request";

/** Exactly what a replay sends: the recorded selector, and the recorded descriptor behind it. */
function replayOf(commandId: string, recorded: Descriptor, extra: Partial<Command> = {}): Command {
  return { commandId, actionType: "web.dom.click", ...(recorded.selector ? { selector: recorded.selector } : {}), ...extra, options: recordedElement(recorded) };
}

async function viewportRect(page: Page, selector: string): Promise<Rect> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} has no layout box.`);
  return box;
}

const state = async <T>(harness: ContentHarness) => (await harness.finalState()).state as T;

test.describe("a replayed action finds the control the drift left", () => {
  test("company-website's next deploy: the recorded Continue is pressed although its id and class were redrawn", async ({ openHarness, page }) => {
    const recording = await openHarness("company-website");
    await quoteDrawer.open(recording);
    const recorded = await describe(recording, byId(ids.next));
    const replay = await openHarness("company-website", { seed: REDEPLOYED_SEED });
    await quoteDrawer.open(replay);
    await expect(page.locator(byId(ids.next))).toHaveCount(0);

    const reply = await replay.runAction(replayOf("redeploy:continue", recorded));
    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.element).toMatchObject({ tagName: "button", visibleText: "Continue", id: redeployed.next });
    // Pressed on step 1 with nothing filled in: the form's own check answers.
    await expect(page.locator(byId(redeployed.errors.fullName!))).toHaveText("Enter your full name");
  });

  test("company-website's next deploy: the recorded Send request is pressed by its surviving test id", async ({ openHarness, page }) => {
    const recording = await openHarness("company-website");
    await quoteDrawer.open(recording);
    await quoteDrawer.toStep(page, 3);
    const recorded = await describe(recording, byId(ids.send));
    const replay = await openHarness("company-website", { seed: REDEPLOYED_SEED });
    await quoteDrawer.open(replay);
    await quoteDrawer.toStep(page, 3, REDEPLOYED_SEED);

    const reply = await replay.runAction(replayOf("redeploy:send", recorded));
    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.element).toMatchObject({ testId: "quote-submit", id: redeployed.send });
    await expect(page.locator(byId(redeployed.errors.privacy!))).toHaveText(PRIVACY_ERROR);
    expect(await state(replay)).toMatchObject({ quotes: [], drafts: 0 });
  });

  test("bigbox redesigned-buy-box: the recorded Add to cart is found in the buy box, and Buy now in its old slot is not pressed", async ({ openHarness, page }) => {
    const harness = await openHarness("bigbox-retail");
    const product = "ip/valueridge-essentials-select-a-size-paper-towels/418830127";
    const settle = async () => {
      await labMutate(harness, "consent", { choice: "reject" });
      await labMutate(harness, "dismiss-promo");
      await labMutate(harness, "dismiss-chat-card");
    };
    await settle();
    await openPath(harness, product);
    const recorded = await describe(harness, '[data-testid="atc"]');
    await labMutate(harness, "set-mode", { mode: "redesigned-buy-box" });
    await settle();
    await openPath(harness, product);
    await expect(page.getByRole("button", { name: "Add to cart", exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="atc"]')).toHaveCount(0);
    const clicks = await trackClicks(page);

    const reply = await harness.runAction(replayOf("redesign:bigbox", recorded));
    // Every class was renamed and the test id is gone, so no exact strategy
    // answers; scoring ranks the moved Add to cart first by its words, name and role.
    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.resolution).toMatchObject({ strategy: "scored-candidate" });
    expect(reply.element).toMatchObject({ tagName: "button", visibleText: "Add to cart" });
    expect(await clicks()).toContain("main|Add to cart");
    expect(await clicks()).not.toContainEqual(expect.stringContaining("Buy now"));
    expect(await state(harness)).toMatchObject({ express: null });
  });

  test("a redeploy took the recorded id and class, and with no selector the fingerprint's text recovers Continue", async ({ openHarness, page }) => {
    const recording = await openHarness("company-website");
    await quoteDrawer.open(recording);
    const recorded = await describe(recording, byId(ids.next));
    expect(recorded).toMatchObject({ visibleText: "Continue", id: ids.next });
    const replay = await openHarness("company-website", { seed: REDEPLOYED_SEED });
    await quoteDrawer.open(replay);

    // Every stable-looking signal the recording captured has drifted: the id
    // and the class names are this deploy's, so the exact half of the
    // fingerprint misses and only its words are left to answer with.
    await expect(page.locator(byId(recorded.id!))).toHaveCount(0);
    await expect(page.locator(`.${recorded.classNames![0]}`)).toHaveCount(0);

    const reply = await replay.runAction({ commandId: "redeploy:fingerprint-only", actionType: "web.dom.click", options: recordedElement(recorded) });
    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.resolution).toMatchObject({ strategy: "fingerprint", candidateCount: 1 });
    expect(reply.element).toMatchObject({ id: redeployed.next });
  });
});

test.describe("scored selection: Core's matcher decides what an exact strategy could not", () => {
  const CART_BOXES = '[aria-label="Active Items"] input[type="checkbox"]';
  for (const line of [1, 2] as const) {
    test(`everything-store cart: the recorded line ${line}'s box wins the tie its selector could not break`, async ({ openHarness, page }) => {
      const harness = await openHarness("everything-store");
      await labMutate(harness, "consent", { choice: "decline" });
      await labMutate(harness, "dismiss-nudge", { nudge: "app-banner" });
      await labMutate(harness, "dismiss-nudge", { nudge: "notifications" });
      await openPath(harness, "cart");
      await expect(page.locator(CART_BOXES)).toHaveCount(2);
      const before = (await state<{ cart: Array<{ lineId: string; selected: boolean }> }>(harness)).cart;
      const recorded = await describe(harness, `${CART_BOXES.replace(" input", ` > div:nth-child(${line}) input`)}`);
      expect(recorded.accessibleName).toMatch(/^Select /u);

      // The selector matches both lines' boxes and the gate prefers neither:
      // both are visible, enabled and of the recorded tag, with the same hashed
      // class. Each box is named for its line, and the recorded name decides.
      const reply = await harness.runAction({ commandId: `scored-tie:${line}`, actionType: "web.dom.click", selector: CART_BOXES, options: recordedElement(recorded) });
      expect(reply, reply.message).toMatchObject({ status: "succeeded", element: { accessibleName: recorded.accessibleName } });
      // Measured: the selector's strategy answers with the winner's score, at
      // a confidence a Flow can read as well short of an exact match.
      expect(reply.resolution).toMatchObject({ strategy: "selector", candidateCount: 2 });
      expect(reply.resolution?.bestScore).toBeCloseTo(0.727, 3);
      expect(reply.resolution?.confidence).toBeCloseTo(0.64, 2);
      // The site re-renders the cart from the server: only the recorded line flipped.
      await expect
        .poll(async () => (await state<{ cart: Array<{ lineId: string; selected: boolean }> }>(harness)).cart.map((entry) => entry.selected))
        .toEqual(before.map((entry, index) => (index === line - 1 ? !entry.selected : entry.selected)));
    });
  }

  test("a descriptor that cannot tell company-website's two quote buttons apart leaves them tied, and the failure carries their scores", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.settle(harness);
    const clicks = await trackClicks(page);

    // Both buttons answer every signal this descriptor carries, so both score
    // at the top of the scale. A tie at 1.00 is still a tie.
    const reply = await harness.runAction({
      commandId: "scored-tie-unbroken",
      actionType: "web.dom.click",
      selector: "button[data-open-quote]",
      options: { element: { tagName: "button", visibleText: "Get a free quote" } }
    });

    expect(reply).toMatchObject({
      status: "failed",
      failure: { ...TARGET_AMBIGUOUS, expected: "one element matching selector button[data-open-quote]" },
      resolution: { strategy: "selector", candidateCount: 2 }
    });
    expect(reply.message).toBe('Target ambiguous: selector button[data-open-quote] matched 2 elements: button "Get a free quote" (1.00), button "Get a free quote" (1.00).');
    expect(await clicks()).toEqual([]);
    await expect(page.getByRole("dialog", { name: "Get a free quote" })).toBeHidden();
  });

  // CS1d. A point lands on one element, so a twin never shows in its count: the
  // Flow lane's recorded bounds clicked the first of two identical buttons and
  // reported success (`L-replay` Defect 1). The family is now scored before a
  // point is acted on, and a tie is reported as one. everything-store's
  // checkout draws "Place your order" twice, in the main column and in the
  // order summary, with the same class and the same words.
  test("everything-store checkout: recorded bounds on one of the two Place your order buttons fail TARGET_AMBIGUOUS, not an order", async ({ openHarness }) => {
    const harness = await openHarness("everything-store");
    await labMutate(harness, "consent", { choice: "decline" });
    await labMutate(harness, "dismiss-nudge", { nudge: "app-banner" });
    await labMutate(harness, "dismiss-nudge", { nudge: "notifications" });
    await labMutate(harness, "start-checkout", { pipeline: "cart" });
    await openPath(harness, "checkout");
    const summary = 'aside button[data-action="place-order"]';
    const recorded = await describe(harness, summary);
    const documentBounds = await documentRect(harness, summary);

    // The point and the recording, as the Flow lane sends them; no selector.
    const reply = await harness.runAction({ commandId: "cs1d-checkout", actionType: "web.dom.click", visualTarget: visualTarget({ documentBounds }), options: recordedElement(recorded) });

    // Scoring decided, over a point that did land: the failure names the point among what was tried.
    expect(reply).toMatchObject({ status: "failed", failure: { ...TARGET_AMBIGUOUS, expected: expect.stringContaining("visual target") }, resolution: { strategy: "scored-candidate" } });
    expect(reply.failure?.actual).toContain('button "Place your order" (0.80), button "Place your order" (0.79)');
    expect(await state(harness)).toMatchObject({ orders: [] });
  });

  test("crossborder basket-redesign: a control whose every recorded signal has drifted is refused, not approximated", async ({ openHarness, page }) => {
    const harness = await openHarness("crossborder-marketplace");
    const item = "item/1005008123450";
    const settle = async () => {
      await labMutate(harness, "consent", { choice: "essential" });
      await labMutate(harness, "welcome", { action: "close" });
      await labMutate(harness, "notifications", { answer: "later" });
      await labMutate(harness, "chat", { view: "minimized" });
    };
    await settle();
    await openPath(harness, item);
    const recorded = await describe(harness, '[data-testid="add-to-cart"]');
    expect(recorded).toMatchObject({ tagName: "div", visibleText: "Add to cart" });
    await labMutate(harness, "set-mode", { mode: "basket-redesign" });
    await settle();
    await openPath(harness, item);
    // The redesign took the test id, the words and the build's class names at
    // once, and put Buy now where Add to cart stood: nothing the recording knew
    // this control by is left.
    await expect(page.getByText("Add to basket", { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="add-to-cart"]')).toHaveCount(0);
    const clicks = await trackClicks(page);

    const reply = await harness.runAction(replayOf("basket-redesign", recorded));
    expect(reply).toMatchObject({ status: "failed", failure: TARGET_NOT_FOUND, resolution: { strategy: "fingerprint", confidence: expect.any(Number) } });
    expect(await clicks()).toEqual([]);
    expect(await state(harness)).toMatchObject({ cart: [] });
  });

  test("company-website redesigned-quote-submit: the recorded Send request is refused on both paths, and nothing is pressed", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.open(harness);
    await quoteDrawer.toStep(page, 3);
    const recorded = await describe(harness, byId(ids.send));
    const bounds = await documentRect(harness, byId(ids.send));

    // Measured with Core's matcher as it now stands, and the same on both
    // paths: "Save and finish later" in the old slot is refused at -0.13, and
    // nothing on the page reaches the floor -- the best scores -0.073 at
    // confidence 0. The Flow path's point lands too and is refused. This is
    // what the variant's manifest means by "only a repair can pass this row".
    for (const [shape, point] of [["replay", {}], ["flow", { visualTarget: visualTarget({ documentBounds: bounds }) }]] as const) {
      await quoteDrawer.open(harness, "redesigned-quote-submit");
      await quoteDrawer.toStep(page, 3);
      await expect(page.locator(byId(ids.headerSend))).toHaveText("Get my free quote");
      const clicks = await trackClicks(page);
      const reply = await harness.runAction(replayOf(`renamed-redesign:${shape}`, recorded, point));
      expect(reply, `${shape}: ${reply.message}`).toMatchObject({
        status: "failed",
        failure: TARGET_NOT_FOUND,
        resolution: { strategy: "fingerprint", candidateCount: 6, confidence: 0 }
      });
      expect(reply.resolution?.bestScore).toBeCloseTo(-0.073, 3);
      expect(reply.resolution?.runnerUpScore).toBeCloseTo(-0.099, 3);
      expect(reply.message).toContain(`refused button#${ids.draft} "Save and finish later" scoring -0.13`);
      // While it retried, the resolver may close the drawer through its ×
      // (reports/t730-b1-identity.md); no action of the form is pressed.
      expect(await clicks()).not.toContainEqual(expect.stringMatching(QUOTE_ACTION));
      expect(await state(harness)).toMatchObject({ mode: "redesigned-quote-submit", drafts: 0, quotes: [] });
    }
  });

  // D-1 (reports/w2-back-half-design.md). The row above is a recorded Flow with
  // no repair. This is the same node once a correct repair has been approved
  // and applied: its `target` names the redesigned "Get my free quote", and its
  // `element` still names the Send request that was recorded. The repair has to
  // win, and once the page moves on again the repaired node must not land on
  // "Save and finish later" instead.
  test("a persisted repair of the recorded Send request resolves Get my free quote, and refuses once that is gone", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.open(harness);
    await quoteDrawer.toStep(page, 3);
    const recorded = await describe(harness, byId(ids.send));
    const bounds = await documentRect(harness, byId(ids.send));
    await quoteDrawer.open(harness, "redesigned-quote-submit");
    await quoteDrawer.toStep(page, 3);
    const repairedTarget = repairNaming(await describe(harness, byId(ids.headerSend)));

    for (const [shape, point] of [["replay", {}], ["flow", { visualTarget: visualTarget({ documentBounds: bounds }) }]] as const) {
      await quoteDrawer.open(harness, "redesigned-quote-submit");
      await quoteDrawer.toStep(page, 3);
      const clicks = await trackClicks(page);
      const reply = await harness.runAction(dispatchedRepair(`persisted-repair:${shape}`, repairedTarget, { element: recorded as unknown as NodePayload, ...point }));
      expect(reply, `${shape}: ${reply.message}`).toMatchObject({
        status: "succeeded",
        element: { tagName: "button", accessibleName: "Get my free quote" },
        resolution: { strategy: "selector", candidateCount: 1 }
      });
      expect(await clicks()).toEqual(["main|Get my free quote"]);
      await expect(page.locator(byId(ids.errors.privacy!))).toHaveText(PRIVACY_ERROR);
    }

    // The same repaired node after the page moved on again: Get my free quote
    // is gone, and "Save and finish later" is still in the footer. Judged
    // against the repair, nothing on the page is it, and nothing is pressed.
    await quoteDrawer.open(harness, "redesigned-quote-submit");
    await quoteDrawer.toStep(page, 3);
    await page.locator(byId(ids.headerSend)).evaluate((element) => element.remove());
    const staleClicks = await trackClicks(page);
    const refused = await harness.runAction(dispatchedRepair("persisted-repair:stale", repairedTarget, { element: recorded as unknown as NodePayload, visualTarget: visualTarget({ documentBounds: bounds }) }));
    expect(refused, refused.message).toMatchObject({ status: "failed", failure: TARGET_NOT_FOUND });
    expect(await staleClicks()).not.toContainEqual(expect.stringMatching(QUOTE_ACTION));
    expect(await state(harness)).toMatchObject({ drafts: 0, quotes: [] });
  });
});

// company-website's `reworded-quote-submit` restyles the drawer's submit: it
// now reads "Send", with a new generated id, a new class and no analytics test
// id. Only its accessible name, `aria-label="Send request"`, is what was
// recorded, and Back is the look-alike sibling standing beside it.
test.describe("company-website reworded-quote-submit: a replayed action finds the control by its surviving accessible name", () => {
  test("reworded: the surviving accessible name resolves Send, and Back is not touched", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.open(harness);
    await quoteDrawer.toStep(page, 3);
    const recorded = await describe(harness, byId(ids.send));
    expect(recorded).toMatchObject({ testId: "quote-submit", visibleText: "Send request", id: ids.send });

    await quoteDrawer.open(harness, "reworded-quote-submit");
    await quoteDrawer.toStep(page, 3);
    // One restyle took every signal Level 1 looks a target up by -- id, test
    // id, class names, exact text -- and left the accessible name standing.
    await expect(page.locator(byId(ids.send))).toHaveCount(0);
    await expect(page.locator('[data-testid="quote-submit"]')).toHaveCount(0);
    const send = page.getByRole("button", { name: "Send request", exact: true });
    await expect(send).toHaveText("Send");
    expect(recorded.classNames?.length).toBeGreaterThan(0);
    const classes = await send.evaluate((element) => [...element.classList]);
    expect(classes.filter((name) => recorded.classNames?.includes(name))).toEqual([]);
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();

    const clicks = await trackClicks(page);
    const reply = await harness.runAction(replayOf("replay-send:reworded", recorded));

    // No stable identifier matches any more, and the recorded text "Send
    // request" is on nothing, so the fingerprint's name scan decides: exactly
    // one element is named "Send request". The veto then weighs that one
    // element against the recording with Core's matcher; the scores were
    // measured on this tree on 2026-10-19.
    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.resolution).toMatchObject({ strategy: "fingerprint", candidateCount: 1 });
    expect(reply.resolution?.bestScore).toBeCloseTo(0.602, 3);
    expect(reply.resolution?.confidence).toBeCloseTo(0.566, 3);
    expect(reply.element).toMatchObject({ tagName: "button", accessibleName: "Send request", visibleText: "Send", id: ids.restyledSend });
    // Pressed with the privacy box unticked: the drawer's own check answers, and nothing is sent.
    await expect(page.locator(byId(ids.errors.privacy!))).toHaveText(PRIVACY_ERROR);
    expect(await clicks()).toEqual(["main|Send"]);
    expect(await state(harness)).toMatchObject({ mode: "reworded-quote-submit", quotes: [], drafts: 0 });
  });
});

test.describe("company-website's home page: a visual target prefers its document bounds", () => {
  const FOOTER_QUOTE = "footer span[data-open-quote]";

  test("document bounds win over the viewport bounds recorded beside them", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.settle(harness);
    const documentBounds = await documentRect(harness, FOOTER_QUOTE);
    // The footer's "Request a quote" is below the fold, and the site's header
    // is sticky: the spot the stale viewport bounds point at.
    expect(documentBounds.y).toBeGreaterThan(720);
    const staleBounds = await viewportRect(page, "header");
    await page.evaluate((top) => window.scrollTo(0, top), Math.round(documentBounds.y - 200));

    const reply = await harness.runAction({ commandId: "document-bounds-win", actionType: "web.dom.click", visualTarget: visualTarget({ bounds: staleBounds, documentBounds }) });
    expect(reply).toMatchObject({ status: "succeeded", resolution: { strategy: "visual-target" }, element: { visibleText: "Request a quote" } });
    await expect(page.getByRole("dialog", { name: "Get a free quote" })).toBeVisible();
  });

  test("stale viewport bounds no longer click whatever scrolled into their place", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.settle(harness);
    const documentBounds = await documentRect(harness, FOOTER_QUOTE);
    await page.evaluate((top) => window.scrollTo(0, top), Math.round(documentBounds.y - 200));
    const recordedBounds = await viewportRect(page, FOOTER_QUOTE);
    await page.evaluate(() => window.scrollTo(0, 0));

    const reply = await harness.runAction({ commandId: "stale-bounds-refused", actionType: "web.dom.click", visualTarget: visualTarget({ bounds: recordedBounds, documentBounds }) });
    // The document bounds are still below the fold, so nothing is under them
    // and the action fails. It used to succeed, on the wrong element.
    expect(reply).toMatchObject({ status: "failed", failure: TARGET_NOT_FOUND, resolution: { strategy: "visual-target" } });
    expect(reply.message).toContain("No target resolved from visual target");
    await expect(page.getByRole("dialog", { name: "Get a free quote" })).toBeHidden();
  });
});

test.describe("a successful resolution says how sure it was", () => {
  // D1 promised structured resolution diagnostics -- strategy, candidate count,
  // best and runner-up score, confidence -- in *every* action result, and
  // `resolveTarget` now returns them with the element it resolved. The rows
  // above prove the numbers for each shape a resolution can take:
  //
  //   exact, Continue                 best 0.840, no runner-up, confidence 0.840
  //   tie broken by the recorded name best 0.727 of 2,             confidence 0.64
  //   refused, redesigned Send        best -0.073, runner-up -0.099, confidence 0
  //
  // An exact strategy weighed one element, so it carries no runner-up: the
  // difference between "a selector answered" and "a tie was broken" is there in
  // the field, not in the status.
  test("an exact match reports the strategy that answered, and claims no score it did not measure", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.open(harness);
    const recorded = await describe(harness, byId(ids.next));

    const reply = await harness.runAction(replayOf("diagnostics:exact", recorded));

    // Nothing drifted, so the recorded selector answers at once and one element
    // survives the gate -- and it reports what that match scored, which
    // `identity/veto.ts` weighs before acting. Measured: 0.840, not the 1.000
    // the synthetic fixture's Save reached against itself, although this
    // descriptor was read off this very page a moment earlier
    // (reports/t730-b1-identity.md, open questions).
    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.resolution).toMatchObject({ strategy: "selector", candidateCount: 1 });
    expect(reply.resolution?.bestScore).toBeCloseTo(0.84, 3);
    expect(reply.resolution?.confidence).toBeCloseTo(0.84, 3);
    // No runner-up: one element was weighed, so there is nothing to compare it
    // with, and the field is absent rather than zero.
    expect(reply.resolution?.runnerUpScore).toBeUndefined();
    await expect(page.locator(byId(ids.errors.fullName!))).toHaveText("Enter your full name");
  });

  test("a verb that resolves nothing gains no measurement", async ({ openHarness }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.settle(harness);

    // Scrolling to a position resolves no element, so there is nothing to
    // report and the field stays absent. The pair matters: "no resolution" and
    // "a resolution with no scores" are different statements.
    const reply = await harness.runAction({ commandId: "diagnostics:no-target", actionType: "web.dom.scroll", options: { y: 200 } });
    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.resolution).toBeUndefined();
  });
});

/**
 * The repair an approved adaptation stores as the node's `target`: the shape
 * `validateWebRuntimeTargetOverrideEvidence` gives a model's
 * `{ element: "target.2" }`, filled with what this page says about the control
 * the repair names.
 */
function repairNaming(control: Descriptor) {
  return {
    handles: { element: "target.2" },
    handleResolution: "named",
    tagName: control.tagName,
    accessibleName: control.accessibleName,
    selector: control.selector,
    metadata: { controlType: "button", formId: ids.form }
  };
}

/**
 * The command a live run dispatches for the recorded click once the repair is
 * applied, built by the code that ships at every hop but one. The node is
 * `webAutomationOutputPayload`'s, and the repair is written onto it as Core's
 * adaptation apply writes it. Core's `prepareElementTargetAction` then rewrites
 * `target` through its element-target normalizer, called here; with no runtime
 * candidates it changes nothing else, and it drops `handles`. That private step
 * is the one hop restated. The wire target and the command come from the
 * domain's own mapping.
 */
function dispatchedRepair(commandId: string, repaired: ReturnType<typeof repairNaming>, recording: NodePayload): Command {
  const node = webAutomationOutputPayload("web.dom.click", recording);
  const prepared = { ...node, target: normalizeAutomationStudioElementTarget({ ...repaired }, { source: "runtime" }) as unknown as NodePayload };
  const target = outputTargetFromPayload(prepared);
  const command = webAutomationActionFromGatewayCommand({ commandId, actionType: "web.dom.click", ...(target ? { target } : {}), parameters: prepared });
  if ("status" in command) throw new Error(`the domain rejected the repaired click: ${command.message}`);
  return command;
}

// The near-miss: a different action whose label contains the recorded one
// (design A, reports/i-resolver-safety.md "(a)", rows R1-R4 and R7-R8).
// Continue is recorded, then the page puts "Continue to site" -- the words of
// the site's own winter notice -- where a replay looks for it. Core gives that
// label the rung it gives "Continue" shortened, so such pages had the resolver
// click the wrong action and report success. `identity/corroboration.ts` now
// requires something that says which control this is to agree exactly.
//
// Each row replays as a replay sends it and as the Flow lane does, with the
// recorded bounds too, because a point is a third way onto the near-miss. Both
// must refuse and no action may be pressed. The control is the same near-miss
// beside the Continue it imitates. Continue's id is a generated one, so
// "with its id" and "without" are the two recordings a page can produce; the
// near-miss gets a generated-looking id of its own in every shape but R7 and
// R8, since the site draws no test ids on these buttons.

const NEAR_MISS = { id: ":rk9q:", text: "Continue to site" };

type NearMissPage = "R1" | "R2" | "R3" | "R4" | "R7" | "R8" | "control";

/** Records Continue; `withoutId` takes its generated id off first, which is how a page with none records it. */
async function recordContinue(harness: ContentHarness, withoutId: boolean) {
  if (withoutId) await harness.page.locator(byId(ids.next)).evaluate((element) => element.removeAttribute("id"));
  const selector = withoutId ? "section[role=dialog] > div:last-child > button:nth-of-type(2)" : byId(ids.next);
  return { recorded: await describe(harness, selector), bounds: await documentRect(harness, selector) };
}

/** Puts the near-miss where each row needs it, in the drawer's footer (Back, Continue) or its header. */
async function arrangeNearMiss(page: Page, row: NearMissPage): Promise<void> {
  await page.evaluate(({ which, nearMiss }) => {
    const footer = document.querySelector("section[role=dialog] > div:last-child")!;
    const [back, next] = [...footer.querySelectorAll("button")];
    const button = document.createElement("button");
    button.type = "button";
    button.className = next!.className;
    if (which !== "R7" && which !== "R8") button.id = nearMiss.id;
    button.textContent = nearMiss.text;
    if (which === "R1" || which === "R3" || which === "R7" || which === "R8") next!.replaceWith(button);
    else document.querySelector("section[role=dialog] > div:first-child")!.append(button);
    if (which === "R2" || which === "R4") next!.remove();
    if (which === "R1" || which === "R2" || which === "R7") back!.remove();
  }, { which: row, nearMiss: NEAR_MISS });
}

test.describe("company-website near-miss: a label that contains the recorded one is not the recorded control", () => {
  for (const spec of [
    { row: "R1", withoutId: false, page: "Continue replaced in its slot by the near-miss, Back removed" },
    { row: "R2", withoutId: true, page: "Continue and Back gone, the near-miss in the drawer's header" },
    { row: "R3", withoutId: true, page: "the near-miss in Continue's slot, Back kept" },
    { row: "R4", withoutId: true, page: "Continue gone, Back left in the footer, the near-miss in the header" },
    { row: "R7", withoutId: false, page: "Continue replaced by the near-miss with no id, Back removed" },
    { row: "R8", withoutId: false, page: "Continue replaced by the near-miss with no id, Back kept" }
  ] as const) {
    test(`${spec.row}, recording ${spec.withoutId ? "without" : "with"} Continue's id: ${spec.page}`, async ({ openHarness, page }) => {
      const harness = await openHarness("company-website");
      await quoteDrawer.open(harness);
      const { recorded, bounds } = await recordContinue(harness, spec.withoutId);
      await arrangeNearMiss(page, spec.row);
      await expect(page.getByRole("button", { name: NEAR_MISS.text, exact: true })).toHaveCount(1);
      const clicks = await trackClicks(page);

      for (const [shape, point] of [["replay", {}], ["flow", { visualTarget: visualTarget({ documentBounds: bounds }) }]] as const) {
        const reply = await harness.runAction(replayOf(`near-miss:${spec.row}:${shape}`, recorded, point));
        expect(reply, `${shape}: ${reply.message}`).toMatchObject({ status: "failed", failure: TARGET_NOT_FOUND });
      }

      // While it retried, the resolver may close the drawer through its ×
      // (reports/t730-b1-identity.md); no action of the form is pressed.
      expect(await clicks()).not.toContainEqual(expect.stringMatching(QUOTE_ACTION));
    });
  }

  test("control: the same near-miss beside the Continue it imitates, and Continue is what resolves", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.open(harness);
    const { recorded } = await recordContinue(harness, true);
    await arrangeNearMiss(page, "control");
    const clicks = await trackClicks(page);

    const reply = await harness.runAction(replayOf("near-miss:control", recorded));

    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.element).toMatchObject({ tagName: "button", visibleText: "Continue" });
    expect(await clicks()).toEqual(["main|Continue"]);
    await expect(page.locator(byId(ids.errors.fullName!))).toHaveText("Enter your full name");
  });
});

// Live run `run-mux6n7m4-8273e7a0` (reports/live-a-r3-f1.md): crossborder's
// colour swatch is a role-less, text-less div named only by its `title`. Its
// recorded selector hung off an id the item page draws afresh on every load, so
// it drifted by design; the fingerprint's name lookup read only
// `aria-label`/`name`, its text fallback needs visible text, and the swatch
// matches none of Level 2's candidate selectors. The page view listed it as
// `clickable "Space Grey"`, and the resolver said not found. For a target with
// no role the fingerprint now also scans for the recorded accessible name,
// counted, so look-alikes sharing one title are a tie rather than the first in
// document order. A target with a role is still left to enumeration and scoring.
test.describe("a control named only by its title resolves by that name once its selector drifts", () => {
  test("crossborder: the stale selector misses and the title alone names the Silver swatch, which is pressed", async ({ openHarness, page }) => {
    const harness = await openHarness("crossborder-marketplace");
    await labMutate(harness, "consent", { choice: "essential" });
    await labMutate(harness, "welcome", { action: "close" });
    await labMutate(harness, "notifications", { answer: "later" });
    await labMutate(harness, "chat", { view: "minimized" });
    const item = "item/1005008123450";
    await openPath(harness, item);
    const stale = (await describe(harness, 'div[title="Silver"]')).selector!;
    await openPath(harness, item);
    await expect(page.locator(stale), "the reload drew a new id under the recorded selector").toHaveCount(0);
    const clicks = await trackClicks(page);

    const reply = await harness.runAction({ commandId: "title-named-swatch", actionType: "web.dom.click", selector: stale, options: { element: { tagName: "div", accessibleName: "Silver", selector: stale } } });

    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.resolution).toMatchObject({ strategy: "fingerprint", candidateCount: 1 });
    expect(await clicks()).toEqual(["main|Silver"]);
    await expect(page.getByText("Color: Silver")).toBeVisible();
  });

  test("auction: every unwatched card's heart is titled Watch this item, so the title is ambiguous and none is pressed", async ({ openHarness, page }) => {
    const harness = await openHarness("auction-marketplace");
    await labMutate(harness, "consent");
    await labMutate(harness, "dismiss-promo");
    await openPath(harness, "sch/i.html?_nkw=kestrel");
    await expect(page.locator('ul[aria-busy="false"]').first()).toBeAttached();
    const titles = await page.locator("hl-watch").evaluateAll((hearts) => hearts.map((heart) => heart.shadowRoot?.querySelector("div")?.title));
    const unwatched = titles.filter((title) => title === "Watch this item").length;
    expect(unwatched).toBeGreaterThan(1);
    const watched = (await state<{ watched: unknown }>(harness)).watched;
    const clicks = await trackClicks(page);

    const reply = await harness.runAction({ commandId: "title-named-hearts", actionType: "web.dom.click", selector: "#watch-heart-gone > div", options: { element: { tagName: "div", accessibleName: "Watch this item", selector: "#watch-heart-gone > div" } } });

    // The hearts live in open shadow roots, and the name scan reaches them.
    expect(reply, reply.message).toMatchObject({ status: "failed", failure: TARGET_AMBIGUOUS, resolution: { strategy: "fingerprint", candidateCount: unwatched } });
    expect(reply.failure?.expected).toContain("in the page's open shadow roots");
    expect(await clicks()).toEqual([]);
    expect((await state<{ watched: unknown }>(harness)).watched).toEqual(watched);
  });
});

// Level 1 is checked before it acts, which is this file's subject. Its
// strategies are not equally strong -- an id is unique, a class set is not --
// and the weak ones used to act with no score and no floor at all. A page whose
// Save button had been replaced by a control wearing its `btn btn-primary` was
// resolved by the class-set query and clicked, while Level 2 scored the same
// element well below zero and refused it. The veto scores what Level 1 chose
// before it is acted on and refuses a match the page contradicts; because a veto
// demotes the strategy to a miss rather than ending the resolution, a control
// that merely moved into another slot is now recovered instead of a neighbour
// being clicked. reports/v-level1-veto.md has the measurements and the
// threshold's derivation.
//
// The veto has a second rule, and the last row is what it is for. The score
// alone separates impostors from drift only for a recording that carries a
// stable identifier: `normalizedScore` divides by the weight of the signals the
// *recording* carried, so a recording with no id and no test id loses that
// weight from the numerator and the denominator at once and the same impostor
// lands on the acting side of the threshold. So a match must also *corroborate*
// -- at least one thing the recording named has to agree on the candidate --
// and a control wearing the recorded class set and nothing else is refused
// whatever it scores. reports/L-veto-recordings.md has the recording-axis
// enumeration and the cost of the alternatives.
//
// The rows run on company-website (AGENTS.md: realistic scenarios only). Its
// class names are hashes a page builder emits per component, so every primary
// button on the site wears the same one -- Continue, Send request, the hero's
// Get a free quote -- which is the collision this veto exists for, drawn by the
// site itself rather than by the test. Each row then changes the page the way a
// redeploy does (a slot refilled, two actions reordered, a restyle, a header
// rebuilt). Each is one of the site's own modes, armed after the recording is
// taken: `quotes-paused` refills the slot, `quote-footer-redesign` reorders
// the drawer's footer and restyles its submit, and `phone-quotes` rebuilds the
// header.
//
// The four rows are two pairs. The first refuses an impostor and the second
// proves a refusal is a *miss* and not an abort -- resolution carries on and
// finds the control that merely moved. The third is the negative control on
// both: a recorded id still resolves through the veto, so what the first two
// pin is a refusal of weak evidence rather than a resolver that has become
// timid. The fourth is the second rule on its own, and it asserts the score is
// on the acting side before asserting the refusal, so it fails loudly if rule 1
// ever starts doing that work instead.
//
// `identity-resolution.spec.ts` holds which signal resolves a drifted control;
// `identity-ambiguity.spec.ts` holds what happens when two answer to one
// description; `identity-fixtures.ts` holds the shared helpers and the scope
// caveat.

import { expect, test } from "../index.js";
import { TARGET_NOT_FOUND, describe, quoteDrawer, recordedElement, trackClicks } from "./identity-fixtures.js";

const ids = quoteDrawer.ids();
const byId = quoteDrawer.byId;
/** Any press on one of the quote form's actions, or on the controls standing in for them. */
const QUOTE_ACTION = /Send request|Save and finish later|Get my free quote|Get a free quote|Continue|Back/u;

test.describe("the Level 1 veto: a fast answer is still checked before it is acted on", () => {
  test("the recorded class set on a different action in Send request's slot is refused, not clicked", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.open(harness);
    await quoteDrawer.toStep(page, 3);
    const recorded = await describe(harness, byId(ids.send));
    expect(recorded).toMatchObject({ testId: "quote-submit", visibleText: "Send request" });
    expect(recorded.classNames).toHaveLength(1);

    // The redeploy this step has to survive, the site's `quotes-paused` mode:
    // new quote requests are paused, Send request is gone, and its slot holds
    // "Save and finish later", which files a draft and sends nothing -- wearing
    // the very class the recorded button wore, as the site's component library
    // draws every primary button. The visitor comes back to the same step.
    await quoteDrawer.open(harness, "quotes-paused");
    await quoteDrawer.toStep(page, 3);
    await expect(page.locator(byId(ids.send))).toHaveCount(0);
    await expect(page.locator(`section[role=dialog] button.${recorded.classNames![0]}:visible`)).toHaveText("Save and finish later");
    const clicks = await trackClicks(page);

    const reply = await harness.runAction({
      commandId: "veto:class-set-impostor",
      actionType: "web.dom.click",
      ...(recorded.selector ? { selector: recorded.selector } : {}),
      options: recordedElement(recorded)
    });

    // Without the veto the class-set query answers, and the answer is clicked.
    // With it, the match is scored against the recording, comes back negative
    // -- more of the recording contradicted than confirmed -- and is demoted to
    // a miss; scoring then finds nothing over the floor either, so the run is
    // told the target is gone rather than being handed a different action.
    expect(reply).toMatchObject({
      status: "failed",
      failure: TARGET_NOT_FOUND,
      resolution: { strategy: "fingerprint" }
    });
    expect(reply.resolution?.bestScore).toBeLessThan(0);
    // The failure explains itself: the strategy that answered, what it landed
    // on, and what that scored. `reportable-text.ts` decides what of the
    // element's own text may be quoted here. The site's draft button carries
    // a generated id of its own, so the refusal names it by that id.
    expect(reply.message).toContain(`element fingerprint (refused button#${ids.draft} "Save and finish later" scoring -0.`);
    expect(await clicks()).not.toContainEqual(expect.stringMatching(QUOTE_ACTION));
    expect((await harness.finalState()).state).toMatchObject({ drafts: 0, quotes: [] });
  });

  test("a vetoed strategy is a miss, not the end: the Continue that moved is still found", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.open(harness);
    await quoteDrawer.toStep(page, 2);

    // A recording of a control the page names by nothing stable. Continue has
    // a generated id, and the recorder does not address a control through a
    // token a redeploy redraws, so the recorded selector is the footer
    // position: the descriptor a real page with no authored identifiers gives.
    const recorded = await describe(harness, byId(ids.next));
    expect(recorded.testId).toBeUndefined();
    expect(recorded.selector).toMatch(/> button:nth-of-type\(2\)$/u);

    // Then the site redesigns the drawer's footer (`quote-footer-redesign`)
    // and puts Continue ahead of Back, which is all it takes for a positional
    // selector to point at the wrong action: Back, which on this step would
    // throw the visitor back to step 1. The visitor comes back to the same step.
    await quoteDrawer.open(harness, "quote-footer-redesign");
    await quoteDrawer.toStep(page, 2);
    await expect(page.locator(recorded.selector!)).toHaveText("Back");

    const reply = await harness.runAction({
      commandId: "veto:demoted-strategy-recovers",
      actionType: "web.dom.click",
      ...(recorded.selector ? { selector: recorded.selector } : {}),
      options: recordedElement(recorded)
    });

    // The recorded path resolves Back, the veto refuses it, and resolution
    // carries on rather than stopping -- so scoring gets its turn and finds the
    // Continue that merely moved. Without the veto this row clicked Back.
    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.resolution).toMatchObject({ strategy: "scored-candidate" });
    expect(reply.element).toMatchObject({ tagName: "button", visibleText: "Continue", id: ids.next });
    await expect(page.locator(byId(ids.steps[2]))).toBeVisible();
  });

  test("a strong match is not second-guessed: the recorded id still resolves through the veto", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.open(harness);
    await quoteDrawer.toStep(page, 3);
    const recorded = await describe(harness, byId(ids.send));

    // The same footer redesign (`quote-footer-redesign`) moved the submit to
    // the site's new UI kit, so nothing about this control is recognisable any
    // more except the id the page gave it: new class vocabulary, no test id, a
    // shortened label. No
    // strategy is exempt from the veto, so this resolves on the score alone --
    // Core weighs an agreeing id at 26 against a class name's 5, which is the
    // differentiation an exemption list would have duplicated more crudely.
    // The id is a generated one, and it still counts: the page still carries
    // that very token, so the comparison is real (`identity/score.ts`).
    await quoteDrawer.open(harness, "quote-footer-redesign");
    await quoteDrawer.toStep(page, 3);
    const restyled = page.locator(byId(ids.send));
    await expect(restyled).toHaveText("Send");
    await expect(restyled).toHaveAttribute("class", "ui-button ui-button--accent");
    await expect(restyled).not.toHaveAttribute("data-testid", /./u);

    const reply = await harness.runAction({
      commandId: "veto:strong-identifier-survives",
      actionType: "web.dom.click",
      ...(recorded.selector ? { selector: recorded.selector } : {}),
      options: recordedElement(recorded)
    });

    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.element).toMatchObject({ id: ids.send, visibleText: "Send" });
    // The press landed on the restyled Send request: its handler checked the
    // privacy box, found it unticked, and said so.
    await expect(page.locator(byId(ids.errors.privacy!))).toHaveText("Tick the box so we can contact you about this request");
  });

  test("a recording with no stable identifier: the score would act, corroboration refuses", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.settle(harness);

    // The ordinary recording, and the one the first proof left out: the
    // header's Get a free quote has neither an id nor a test id, so the
    // descriptor falls back to a structural path and the class set is the
    // query that will fire.
    const recorded = await describe(harness, "header button[data-open-quote]");
    expect(recorded).toMatchObject({ visibleText: "Get a free quote" });
    expect(recorded.classNames).toHaveLength(1);
    expect(recorded.id).toBeUndefined();
    expect(recorded.testId).toBeUndefined();
    // No authored name either, so the name query does not fire before the class
    // set does.
    expect(recorded.name).toBeUndefined();

    // The rebuild, the site's `phone-quotes` mode: both quote buttons are
    // gone, and a call button drawn by the header's component -- an icon with
    // no words -- stands in the top strip. Nothing about it says which control
    // it is -- no text, no accessible name, no identifier -- and that is
    // exactly why the score cannot refuse it: Core charges a *missing* text
    // signal less than a contradicting one, so the least informative candidate
    // on the page is the one that scores best. The hero's twin is gone too, so
    // no second "Get a free quote" offers a legitimate recovery. The call
    // button has a box and is in view at the top of the page; without both it
    // would lose Core's visibility weight and score *under* the threshold --
    // which is the first rule refusing.
    await quoteDrawer.settle(harness, "phone-quotes");
    await expect(page.locator("main button[data-open-quote]")).toHaveCount(0);
    await expect(page.locator(`button.${recorded.classNames![0]}`)).toHaveCount(1);
    await expect(page.locator(`button.${recorded.classNames![0]}`)).toBeInViewport();
    // The two stronger sub-queries inside the fingerprint strategy have to miss
    // for the class set to be the one that answers. Asserted rather than
    // assumed, so a page change cannot quietly move this row onto a different
    // query.
    await expect(page.locator(recorded.selector!)).toHaveCount(0);
    const xpathStillMatches = await page.evaluate(
      (xpath) => Boolean(document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue),
      recorded.xpath!
    );
    expect(xpathStillMatches).toBe(false);
    const clicks = await trackClicks(page);

    const reply = await harness.runAction({
      commandId: "veto:uncorroborated-class-set",
      actionType: "web.dom.click",
      options: recordedElement(recorded)
    });

    expect(reply).toMatchObject({
      status: "failed",
      failure: TARGET_NOT_FOUND,
      resolution: { strategy: "fingerprint" }
    });
    // The whole point of the row, read off the refusal itself: the match was on
    // the *acting* side of the threshold and was refused anyway, because
    // nothing the recording named agreed. If that score ever goes negative the
    // second rule has stopped being load-bearing here and this row should say
    // so rather than pass quietly.
    const refusal = reply.message?.match(/refused button scoring (-?[\d.]+) with nothing the recording named agreeing/u);
    expect(refusal, reply.message).not.toBeNull();
    expect(Number(refusal![1])).toBeGreaterThanOrEqual(0);
    expect(await clicks()).toEqual([]);
    await expect(page.getByRole("dialog", { name: "Get a free quote" })).toBeHidden();
  });
});

// And Level 1 is checked now, which is the last group of rows. Its strategies
// are not equally strong -- an id is unique, a class set is not -- and the weak
// ones used to act with no score and no floor at all. A page whose Save button
// had been replaced by a `btn btn-primary` "Delete workspace" was resolved by
// the class-set query and clicked, while Level 2 scored the same element well
// below zero and refused it. The veto scores what Level 1 chose before it is
// acted on and refuses a match the page contradicts; because a veto demotes the
// strategy to a miss rather than ending the resolution, a control that merely
// moved into another slot is now recovered instead of a neighbour being clicked.
// reports/v-level1-veto.md has the measurements and the threshold's derivation.
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
// description; `identity-fixtures.ts` holds the shared selectors and the scope
// caveat.

import { expect, test } from "../index.js";
import { DISPLAY_NAME, SAVE_BASELINE, TARGET_NOT_FOUND, describe, recordedElement } from "./identity-fixtures.js";

test.describe("the Level 1 veto: a fast answer is still checked before it is acted on", () => {
  test("the recorded class set on a destructive control is refused, not clicked", async ({ openHarness, page }) => {
    const harness = await openHarness("identity-drift");
    const recorded = await describe(harness, SAVE_BASELINE);
    expect(recorded).toMatchObject({ classNames: ["btn", "btn-primary"], visibleText: "Save changes" });

    // The redesign this page has to survive: the Save action is gone and the
    // slot now holds a destructive control wearing the same class pair. `btn
    // btn-primary` is one of the commonest class pairs on the web, so this is
    // not a contrived collision -- it is what a component library does.
    await page.locator(SAVE_BASELINE).evaluate((element) => {
      const replacement = element.ownerDocument.createElement("button");
      replacement.type = "button";
      replacement.className = "btn btn-primary";
      replacement.textContent = "Delete workspace";
      element.replaceWith(replacement);
    });
    await expect(page.locator("button.btn.btn-primary")).toHaveCount(1);
    await expect(page.locator("button.btn.btn-primary")).toHaveText("Delete workspace");

    const reply = await harness.runAction({
      commandId: "veto:class-set-destructive",
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
    // element's own text may be quoted here.
    expect(reply.message).toContain("element fingerprint (refused button");
    expect(reply.message).toContain("Delete workspace");
    expect((await harness.finalState()).state).toMatchObject({ saveCount: 0, discardCount: 0, savedInMode: null });
  });

  test("a vetoed strategy is a miss, not the end: the control that moved is still found", async ({ openHarness, page }) => {
    const harness = await openHarness("identity-drift");

    // A recording of a control the page names by nothing but its position. The
    // fixture's Save carries an id and a test id, so they are taken away before
    // it is described -- that is the only way to record the structural-path
    // selector this row is about, and it is the descriptor a real page with no
    // author-supplied identifiers produces.
    await page.locator(SAVE_BASELINE).evaluate((element) => {
      element.removeAttribute("id");
      element.removeAttribute("data-testid");
    });
    const recorded = await describe(harness, "button.btn.btn-primary");
    expect(recorded.id).toBeUndefined();
    expect(recorded.testId).toBeUndefined();
    expect(recorded.selector).toContain("button:nth-of-type(1)");

    // Then the page reorders its two actions, which is all it takes for a
    // positional selector to point at the wrong one. Discard is a native reset,
    // so clicking it throws the pending edit away.
    const displayName = await page.locator(DISPLAY_NAME).inputValue();
    await page.locator('[data-testid="primary-actions"]').evaluate((group) => {
      group.append(group.firstElementChild!);
    });
    await expect(page.locator('[data-testid="primary-actions"] button').first()).toHaveText("Discard changes");

    const reply = await harness.runAction({
      commandId: "veto:demoted-strategy-recovers",
      actionType: "web.dom.click",
      ...(recorded.selector ? { selector: recorded.selector } : {}),
      options: recordedElement(recorded)
    });

    // The recorded path resolves Discard, the veto refuses it, and resolution
    // carries on rather than stopping -- so scoring gets its turn and finds the
    // Save that merely moved. Before the veto this row clicked Discard.
    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.element).toMatchObject({ tagName: "button", visibleText: "Save changes" });
    await expect
      .poll(async () => (await harness.finalState()).state)
      .toMatchObject({ savedInMode: "baseline", savedDisplayName: displayName, saveCount: 1, discardCount: 0 });
  });

  test("a strong match is not second-guessed: the recorded id still resolves through the veto", async ({ openHarness, page }) => {
    const harness = await openHarness("identity-drift");
    const recorded = await describe(harness, SAVE_BASELINE);
    const displayName = await page.locator(DISPLAY_NAME).inputValue();

    // Nothing about this control is recognisable any more except the id the
    // author gave it: new class vocabulary, no test id, a shortened label. No
    // strategy is exempt from the veto, so this resolves on the score alone --
    // Core weighs an agreeing id at 26 against a class name's 5, which is the
    // differentiation an exemption list would have duplicated more crudely.
    await page.locator(SAVE_BASELINE).evaluate((element) => {
      element.removeAttribute("data-testid");
      element.setAttribute("class", "ui-button ui-button--accent");
      element.textContent = "Save";
    });

    const reply = await harness.runAction({
      commandId: "veto:strong-identifier-survives",
      actionType: "web.dom.click",
      ...(recorded.selector ? { selector: recorded.selector } : {}),
      options: recordedElement(recorded)
    });

    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.element).toMatchObject({ id: "save-settings" });
    await expect
      .poll(async () => (await harness.finalState()).state)
      .toMatchObject({ savedInMode: "baseline", savedDisplayName: displayName, saveCount: 1, discardCount: 0 });
  });

  test("a recording with no stable identifier: the score would act, corroboration refuses", async ({ openHarness, page }) => {
    const harness = await openHarness("identity-drift");

    // The ordinary recording, and the one the first proof left out: a control
    // the page gave neither an id nor a test id, so the descriptor falls back
    // to a structural path and the class set is the query that will fire.
    await page.locator(SAVE_BASELINE).evaluate((element) => {
      element.removeAttribute("id");
      element.removeAttribute("data-testid");
    });
    const recorded = await describe(harness, "button.btn.btn-primary");
    expect(recorded).toMatchObject({ classNames: ["btn", "btn-primary"], visibleText: "Save changes" });
    expect(recorded.id).toBeUndefined();
    expect(recorded.testId).toBeUndefined();
    // No authored name either, so the name query does not fire before the class
    // set does.
    expect(recorded.name).toBeUndefined();

    // The redesign: the action row moved into the page header, the Save action
    // is gone, and a nameless icon button wearing the same class pair stands in
    // its place. Nothing about that button says which control it is -- no text,
    // no accessible name, no identifier -- and that is exactly why the score
    // cannot refuse it: Core charges a *missing* text signal less than a
    // contradicting one, so the least informative candidate on the page is the
    // one that scores best.
    await page.locator('[data-testid="primary-actions"]').evaluate((group) => {
      const document_ = group.ownerDocument;
      const header = document_.querySelector("main > header")!;
      group.querySelector('button[type="submit"]')!.remove();
      // Discard moves too, so the old slot is empty. The recorded selector is
      // positional, and a button left behind in that slot is what it would
      // otherwise land on -- which would be the *first* rule refusing, not this
      // row's subject.
      header.append(group.querySelector('[data-testid="discard-changes"]')!);
      const icon = document_.createElement("button");
      icon.type = "button";
      icon.className = "btn btn-primary";
      // Sized explicitly, and in the header rather than the footer, because a
      // candidate below the fold loses Core's visibility weight and would score
      // *under* the threshold -- which is the first rule refusing again.
      icon.style.width = "32px";
      icon.style.height = "32px";
      header.append(icon);
    });
    await expect(page.locator("button.btn.btn-primary")).toHaveCount(1);
    await expect(page.locator('[data-testid="primary-actions"] button')).toHaveCount(0);
    // The two stronger sub-queries inside the fingerprint strategy have to miss
    // for the class set to be the one that answers. Asserted rather than
    // assumed, so a fixture change cannot quietly move this row onto a
    // different query.
    await expect(page.locator(recorded.selector!)).toHaveCount(0);
    const xpathStillMatches = await page.evaluate(
      (xpath) => Boolean(document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue),
      recorded.xpath!
    );
    expect(xpathStillMatches).toBe(false);

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
    const refusal = reply.message?.match(/refused button scoring (-?[\d.]+) with nothing the recording named agreeing/);
    expect(refusal, reply.message).not.toBeNull();
    expect(Number(refusal![1])).toBeGreaterThanOrEqual(0);
    expect((await harness.finalState()).state).toMatchObject({ saveCount: 0, discardCount: 0, savedInMode: null });
  });
});

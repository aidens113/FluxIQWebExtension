// How the content script chooses the element an action acts on, once the page
// has moved on from the recording (Phase 1.3 step 3).
//
// Three things are pinned here, and all three are changes from the resolver
// this suite's sibling `resolve-target.spec.ts` describes.
//
// A replayed action finds its control through whichever signal the drift left
// standing: identity-drift renders one Save action five ways, and each mode
// takes a different signal away. The rows below replay the *recorded*
// descriptor -- read off the baseline page through `web.dom.extract`, not
// hand-written -- so what is exercised is the resolution a real replay
// performs, not a fingerprint invented to suit it.
//
// And a visual target's document bounds now win over the viewport bounds
// recorded beside them. Viewport bounds say where the element was on screen
// when it was captured; after any scroll they point at whatever has since moved
// into that spot, which is how a click lands on a sticky header.
//
// Scored selection is here now. Core's element matcher ships to the browser
// from `fluxiq/automation-studio/fingerprinting`, and the resolver hands it the
// candidates whenever an exact answer is not one: a strategy that matched
// several elements the gate could not narrow, or every strategy missing. It
// resolves the winner only when the winner clears the floor and beats the
// runner-up by a margin.
//
// What scoring does *not* do is guess. On the identity-drift fixture a control
// whose text, id, class and test id have all changed at once scores below the
// floor against its own page -- the highest-scoring button there is the wrong
// one, Discard -- so the resolver refuses. The row that proves that is as
// important as the rows where scoring wins, and the measured scores behind the
// floor are in reports/w3-matcher-packaging.md.
//
// The `reworded-aria` rendering keeps the accessible name through that same
// drift, and scoring ranks the *right* control first. Whether the floor then
// admits it depends on a Core constant that changed during Wave 3: a candidate
// *missing* a stable identifier is now charged -0.1 rather than -0.55, which is
// the calibration `reports/v-matcher-calibration.md` recommended and Core took.
// That lifts the rendering from 0.218 to 0.389, over the 0.35 floor, so the row
// below now proves a resolution where it used to prove a refusal. **If that Core
// change is reverted, this row has to go back to expecting TARGET_NOT_FOUND.**
//
// One subject per file, since this one carried three and reached 715 lines.
// `identity-ambiguity.spec.ts` holds what happens when two controls answer to
// one description; `identity-veto.spec.ts` holds the check a fast Level 1
// answer passes before it is acted on; `identity-fixtures.ts` holds the
// selectors and the descriptor helpers all three share, and the scope caveat
// that applies to every row in all three.
//
// And the last group is what a resolution *reports* -- the strategy that
// answered, how many candidates it weighed, and the scores behind the choice.
// Read the four shapes together: an exact match, a tie broken at 1.000, a
// scored recovery at 0.389, and a refusal. The status alone cannot tell the
// middle two apart.

import type { Page } from "@playwright/test";
import { outputTargetFromPayload, webAutomationActionFromGatewayCommand, webAutomationOutputPayload } from "@fluxiq-web-extension/domain/client";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";
import {
  BELOW_FOLD,
  DISPLAY_NAME,
  DRIFT_MODES,
  PRIMARY,
  SAVE_BASELINE,
  SECONDARY,
  TARGET_AMBIGUOUS,
  TARGET_NOT_FOUND,
  armMode,
  describe,
  documentRect,
  recordedElement,
  viewportRect,
  visualTarget
} from "./identity-fixtures.js";

test.describe("identity-drift: a replayed action finds the control the drift left", () => {
  for (const drift of DRIFT_MODES) {
    test(`${drift.mode}: the recorded descriptor resolves the drifted Save action`, async ({ openHarness, page }) => {
      const harness = await openHarness("identity-drift");
      const recorded = await describe(harness, SAVE_BASELINE);
      const displayName = await page.locator(DISPLAY_NAME).inputValue();
      await armMode(harness, drift.mode);

      const reply = await harness.runAction({
        commandId: `replay-save:${drift.mode}`,
        actionType: "web.dom.click",
        // Exactly what a replay sends: the recorded selector, which three of
        // the four modes still answer to, and the recorded descriptor behind it.
        ...(recorded.selector ? { selector: recorded.selector } : {}),
        options: recordedElement(recorded)
      });

      expect(reply.status, reply.message).toBe("succeeded");
      expect(reply.element).toMatchObject({ tagName: "button", id: drift.saveId });
      await expect
        .poll(async () => (await harness.finalState()).state)
        .toMatchObject({ savedInMode: drift.mode, savedDisplayName: displayName, saveCount: 1 });
    });
  }

  test("selector-only: the recorded selector is gone, and the fingerprint's text recovers the control", async ({ openHarness, page }) => {
    const harness = await openHarness("identity-drift");
    const recorded = await describe(harness, SAVE_BASELINE);
    expect(recorded).toMatchObject({ selector: "#save-settings", testId: "save-changes", visibleText: "Save changes" });
    await armMode(harness, "selector-only");

    // Every stable signal the recording captured has drifted: the id, the test
    // id and the class names are all different, so the whole exact half of the
    // fingerprint misses and only its text is left to answer with.
    await expect(page.locator("#save-settings")).toHaveCount(0);
    await expect(page.locator('[data-testid="save-changes"]')).toHaveCount(0);
    await expect(page.locator(".btn-primary")).toHaveCount(0);

    const reply = await harness.runAction({
      commandId: "replay-save:selector-only-fingerprint-only",
      actionType: "web.dom.click",
      options: recordedElement(recorded)
    });
    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.element).toMatchObject({ id: "workspace-settings-submit" });
    await expect.poll(async () => (await harness.finalState()).state).toMatchObject({ savedInMode: "selector-only" });
  });
});

test.describe("scored selection: Core's matcher decides what an exact strategy could not", () => {
  for (const target of [
    { name: "secondary", selector: SECONDARY, result: "secondary" },
    { name: "primary", selector: PRIMARY, result: "primary" }
  ]) {
    test(`the recorded ${target.name} control wins the tie its selector could not break`, async ({ openHarness, page }) => {
      const harness = await openHarness("ambiguous-targets");
      const recorded = await describe(harness, target.selector);

      // `button` matches both Continue buttons and the gate prefers neither:
      // both are visible, enabled and of the recorded tag. Before scoring this
      // was TARGET_AMBIGUOUS; now the recorded test id decides it.
      const reply = await harness.runAction({
        commandId: `scored-tie:${target.name}`,
        actionType: "web.dom.click",
        selector: "button",
        options: recordedElement(recorded)
      });

      expect(reply).toMatchObject({ status: "succeeded", element: { selector: target.selector } });
      // The tie was broken by a signal that identifies the control, and the
      // measurement now rides on the success saying so: 1.000 against the twin's
      // 0.382, at Core's full confidence. `reworded-aria` below also succeeds,
      // at 0.389 and 0.366 -- the same status over a far weaker match, and a
      // Flow can only tell the two apart because the resolution is reported.
      expect(reply.resolution).toMatchObject({ strategy: "scored-candidate", candidateCount: 2 });
      expect(reply.resolution?.bestScore).toBe(1);
      expect(reply.resolution?.confidence).toBe(1);
      expect(reply.resolution?.runnerUpScore).toBeCloseTo(0.382, 3);
      await expect(page.getByTestId("result")).toHaveText(target.result);
      expect((await harness.finalState()).state).toEqual({ selected: target.result });
    });
  }

  test("a descriptor that cannot tell the twins apart leaves them tied, and the failure carries their scores", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");

    // Both buttons answer every signal this descriptor carries, so both score
    // at the top of the scale. A tie at 1.00 is still a tie.
    const reply = await harness.runAction({
      commandId: "scored-tie-unbroken",
      actionType: "web.dom.click",
      selector: "button",
      options: { element: { tagName: "button", visibleText: "Continue" } }
    });

    expect(reply).toMatchObject({
      status: "failed",
      failure: { ...TARGET_AMBIGUOUS, expected: "one element matching selector button" },
      resolution: { strategy: "selector", candidateCount: 2 }
    });
    expect(reply.message).toContain('button[data-testid="choice-primary"] "Continue" (1.00)');
    expect(reply.message).toContain('button[data-testid="choice-secondary"] "Continue" (1.00)');
    await expect(page.getByTestId("result")).toHaveText("None");
    expect((await harness.finalState()).state).toEqual({ selected: null });
  });

  // CS1d. A point lands on one element, so a twin never shows in its count: the
  // Flow lane's recorded bounds clicked the first of no-context's two identical
  // Continue buttons and reported success (`L-replay` Defect 1). The family is
  // now scored before a point is acted on, and a tie is reported as one.
  test("no-context: recorded bounds on one of two identical twins fail TARGET_AMBIGUOUS, not a click", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");
    const recorded = await describe(harness, PRIMARY);
    const documentBounds = await documentRect(harness, PRIMARY);
    const headers = { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" };
    expect((await fetch(`${harness.lab.origin}/api/ambiguous-targets/set-mode`, { method: "POST", headers, body: '{"mode":"no-context"}' })).ok).toBe(true);
    await page.goto(harness.url);
    await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);

    const reply = await harness.runAction({ commandId: "cs1d-no-context", actionType: "web.dom.click", selector: PRIMARY, visualTarget: visualTarget({ documentBounds }), options: recordedElement(recorded) });

    // Scoring decided, over a point that did land: the failure names the point among what was tried.
    expect(reply).toMatchObject({ status: "failed", failure: { ...TARGET_AMBIGUOUS, expected: expect.stringContaining("visual target") }, resolution: { strategy: "scored-candidate", candidateCount: 2 } });
    await expect(page.getByTestId("result")).toHaveText("None");
    expect((await harness.finalState()).state).toMatchObject({ selected: null, mode: "no-context" });
  });

  test("a control whose every recorded signal has drifted is refused, not approximated", async ({ openHarness, page }) => {
    const harness = await openHarness("identity-drift");
    const recorded = await describe(harness, SAVE_BASELINE);
    await armMode(harness, "selector-only");
    // selector-only already changes the id, the class and the test id. Taking
    // the text as well leaves nothing the recording knew this control by --
    // the one state no rendering of the fixture reaches on its own.
    await page.locator("#workspace-settings-submit").evaluate((element) => { element.textContent = "Apply changes"; });

    const reply = await harness.runAction({
      commandId: "scored-below-floor",
      actionType: "web.dom.click",
      ...(recorded.selector ? { selector: recorded.selector } : {}),
      options: recordedElement(recorded)
    });

    // Two buttons were weighed and neither cleared the floor. The higher-scoring
    // of the two is Discard, on a shared class prefix, which is exactly the
    // answer a resolver without a floor would have clicked.
    expect(reply).toMatchObject({
      status: "failed",
      failure: TARGET_NOT_FOUND,
      resolution: { strategy: "fingerprint", candidateCount: 2 }
    });
    expect(reply.message).toBe("No target resolved from selector #save-settings, element fingerprint.");
    expect((await harness.finalState()).state).toMatchObject({ saveCount: 0, discardCount: 0, savedInMode: null });
  });

  test("renamed-redesign: the fixture's own rendering of that drift is refused on both paths, and nothing is pressed", async ({ openHarness, page }) => {
    const harness = await openHarness("identity-drift");
    const recorded = await describe(harness, SAVE_BASELINE);
    const bounds = await documentRect(harness, SAVE_BASELINE);
    await armMode(harness, "renamed-redesign");
    // The row above as a rendering the fixture reaches by itself, without the id
    // and test id: the `reworded-aria` component with its aria-label gone and
    // its label renamed, so the accessible name changed as well.
    await expect(page.getByRole("button", { name: "Apply changes", exact: true })).toHaveAttribute("class", "ui-button ui-button--accent");
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
    const clicks = await trackClicks(page);

    // Measured with Core's matcher as it now stands, and the same on both
    // paths: the renamed Save ranks first at -0.104, Discard second at -0.360,
    // confidence 0 -- 0.454 under the 0.35 floor. The ranking is right and the
    // floor refuses it anyway, which is what sends this variant's live run to
    // the provider. The Flow path's point lands on the renamed Save and is
    // refused at the same score.
    for (const [shape, point] of [["replay", {}], ["flow", { visualTarget: visualTarget({ documentBounds: bounds }) }]] as const) {
      const reply = await harness.runAction({
        commandId: `renamed-redesign:${shape}`,
        actionType: "web.dom.click",
        ...(recorded.selector ? { selector: recorded.selector } : {}),
        ...point,
        options: recordedElement(recorded)
      });
      expect(reply, `${shape}: ${reply.message}`).toMatchObject({
        status: "failed",
        failure: TARGET_NOT_FOUND,
        resolution: { strategy: "fingerprint", candidateCount: 2, confidence: 0 }
      });
      expect(reply.resolution?.bestScore).toBeCloseTo(-0.104, 3);
      expect(reply.resolution?.runnerUpScore).toBeCloseTo(-0.36, 3);
      if (shape === "flow") expect(reply.message).toContain('refused button "Apply changes" scoring -0.10');
    }

    expect(await clicks()).toEqual([]);
    expect((await harness.finalState()).state).toMatchObject({ mode: "renamed-redesign", saveCount: 0, discardCount: 0, savedInMode: null, status: "" });
  });

  // D-1 (reports/w2-back-half-design.md). The row above is a recorded Flow with
  // no repair. This is the same node once a correct repair has been approved
  // and applied: its `target` names the renamed control, and its `element`
  // still names the Save that was recorded. The repaired selector used to
  // travel with the stale identity, so the veto refused the very control the
  // repair named, as uncorroborated by "Save changes", and scoring failed at
  // -0.104. The repair has to win on both halves, and the veto still has to
  // refuse a wrong element when judged against the repair.
  test("a persisted repair of the recorded Save resolves Apply changes on renamed-redesign, and the veto still refuses Discard", async ({ openHarness, page }) => {
    const harness = await openHarness("identity-drift");
    const recorded = await describe(harness, SAVE_BASELINE);
    const bounds = await documentRect(harness, SAVE_BASELINE);

    for (const [shape, point] of [["replay", {}], ["flow", { visualTarget: visualTarget({ documentBounds: bounds }) }]] as const) {
      await armMode(harness, "renamed-redesign");
      await expect(page.locator(REPAIRED_SAVE.selector)).toHaveText("Apply changes");
      const clicks = await trackClicks(page);

      const reply = await harness.runAction(dispatchedRepair(`persisted-repair:${shape}`, { element: recorded as unknown as NodePayload, ...point }));

      expect(reply, `${shape}: ${reply.message}`).toMatchObject({
        status: "succeeded",
        element: { tagName: "button", accessibleName: "Apply changes" },
        resolution: { strategy: "selector", candidateCount: 1 }
      });
      expect(await clicks()).toEqual(["Apply changes"]);
      await expect
        .poll(async () => (await harness.finalState()).state)
        .toMatchObject({ mode: "renamed-redesign", savedInMode: "renamed-redesign", saveCount: 1, discardCount: 0 });
    }

    // The same repaired node after the page moved on again: Apply changes is
    // gone, so the repaired selector now lands on Discard. Judged against the
    // repair, Discard answers nothing it named, and nothing is pressed.
    await armMode(harness, "renamed-redesign");
    await page.locator(REPAIRED_SAVE.selector).evaluate((element) => element.remove());
    await expect(page.locator(REPAIRED_SAVE.selector)).toHaveText("Discard changes");
    const staleClicks = await trackClicks(page);

    const refused = await harness.runAction(dispatchedRepair("persisted-repair:stale", { element: recorded as unknown as NodePayload, visualTarget: visualTarget({ documentBounds: bounds }) }));

    expect(refused, refused.message).toMatchObject({ status: "failed", failure: TARGET_NOT_FOUND });
    // Contradicted, not merely uncorroborated: Discard scores -0.13 against the
    // repair, and the selector, the point and the fingerprint all land on it.
    expect(refused.message).toContain('refused button[data-testid="discard-changes"] "Discard changes" scoring -0.13)');
    expect(refused.message).not.toContain("Apply changes");
    expect(await staleClicks()).toEqual([]);
    expect((await harness.finalState()).state).toMatchObject({ saveCount: 0, discardCount: 0, savedInMode: null });
  });

  test("reworded-aria: the surviving accessible name resolves the right control, and Discard is not touched", async ({ openHarness, page }) => {
    const harness = await openHarness("identity-drift");
    const recorded = await describe(harness, SAVE_BASELINE);
    const displayName = await page.locator(DISPLAY_NAME).inputValue();
    await armMode(harness, "reworded-aria");

    // One redesign took every signal Level 1 looks a target up by -- id, test
    // id, class names, exact text -- and left the accessible name standing.
    await expect(page.locator("#save-settings")).toHaveCount(0);
    await expect(page.locator('[data-testid="save-changes"]')).toHaveCount(0);
    await expect(page.locator("button.btn.btn-primary")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveText("Save");

    const reply = await harness.runAction({
      commandId: "replay-save:reworded-aria",
      actionType: "web.dom.click",
      ...(recorded.selector ? { selector: recorded.selector } : {}),
      options: recordedElement(recorded)
    });

    // Level 1 has nothing left to look the control up by, so Level 2 decides.
    // Measured with Core's matcher as it now stands: the redesigned Save scores
    // 0.389 against Discard's -0.360, so it clears the 0.35 floor and leads by
    // 0.749. Both numbers move with the missing-identifier constant named in
    // this file's header; the ranking does not.
    expect(reply.status, reply.message).toBe("succeeded");
    // A successful resolution now carries its measurement. It did not until
    // 2026-09-12 -- `resolveTarget` handed the verbs an Element and nothing
    // else, so the scores reached a Flow only on the failure path -- and this
    // row asserted the gap to keep it visible. The gap closed while this file
    // was being edited, so the assertion is inverted rather than deleted: a
    // Flow reading this reply can now tell a control recovered by a hair from
    // one matched outright.
    expect(reply.resolution).toMatchObject({ strategy: "scored-candidate", candidateCount: 2 });
    expect(reply.resolution?.bestScore).toBeGreaterThan(0.35);
    expect(reply.resolution?.runnerUpScore).toBeLessThan(0);
    // The numbers themselves, because they are what a Flow acts on: 0.389, a
    // measured 0.039 over the floor, at confidence 0.366 -- against the
    // 1.000/1.000 of the tie-break above, which both succeeded. Pinned rather
    // than bounded, so the Core constant this file's header names cannot move
    // without a row saying so.
    expect(reply.resolution?.bestScore).toBeCloseTo(0.389, 3);
    expect(reply.resolution?.confidence).toBeCloseTo(0.366, 3);
    expect(reply.element).toMatchObject({ tagName: "button", accessibleName: "Save changes", visibleText: "Save" });
    await expect
      .poll(async () => (await harness.finalState()).state)
      .toMatchObject({ savedInMode: "reworded-aria", savedDisplayName: displayName, saveCount: 1, discardCount: 0 });
  });
});

test.describe("long-document: a visual target prefers its document bounds", () => {
  test("document bounds win over the viewport bounds recorded beside them", async ({ openHarness, page }) => {
    const harness = await openHarness("long-document");
    const documentBounds = await documentRect(harness, BELOW_FOLD);
    // Where the sticky header sits: the spot the stale viewport bounds point at.
    const staleBounds = await viewportRect(harness, '[data-testid="sticky-header"]');
    await page.evaluate((top) => window.scrollTo(0, top), Math.round(documentBounds.y - 200));

    const reply = await harness.runAction({
      commandId: "document-bounds-win",
      actionType: "web.dom.click",
      visualTarget: visualTarget({ bounds: staleBounds, documentBounds })
    });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: BELOW_FOLD } });
    await expect(page.getByTestId("result")).toHaveText("Reached");
    expect((await harness.finalState()).state).toMatchObject({ reached: true });
  });

  test("stale viewport bounds no longer click whatever scrolled into their place", async ({ openHarness, page }) => {
    const harness = await openHarness("long-document");
    const documentBounds = await documentRect(harness, BELOW_FOLD);
    await page.evaluate((top) => window.scrollTo(0, top), Math.round(documentBounds.y - 200));
    const recordedBounds = await viewportRect(harness, BELOW_FOLD);
    await page.evaluate(() => window.scrollTo(0, 0));

    const reply = await harness.runAction({
      commandId: "stale-bounds-refused",
      actionType: "web.dom.click",
      visualTarget: visualTarget({ bounds: recordedBounds, documentBounds })
    });
    // The document bounds are still below the fold, so nothing is under them
    // and the action fails. It used to succeed, on the wrong element.
    expect(reply).toMatchObject({
      status: "failed",
      failure: TARGET_NOT_FOUND,
      resolution: { strategy: "visual-target" }
    });
    expect(reply.message).toContain("No target resolved from visual target");
    await expect(page.getByTestId("result")).toHaveText("Pending");
    expect((await harness.finalState()).state).toMatchObject({ reached: false });
  });
});

test.describe("a successful resolution says how sure it was", () => {
  // D1 promised structured resolution diagnostics -- strategy, candidate count,
  // best and runner-up score, confidence -- in *every* action result. Until
  // 2026-09-12 a failure carried them and a success carried nothing, because
  // `resolveTarget` was typed to return an `Element` and the measurement was
  // dropped one call below where the failure path's copy was kept. It was never
  // a decision; it fell out of a signature. `resolveTarget` now returns both and
  // every verb passes the measurement into the evidence it already builds.
  //
  // The rows above prove the numbers for each shape a resolution can take, and
  // between them they are the whole point of carrying the field. Measured on
  // these fixtures, with Core's matcher as it now stands:
  //
  //   exact, `#save-settings`  best 1.000, no runner-up,    confidence 1.000
  //   scored, recorded twin    best 1.000, runner-up 0.382, confidence 1.000
  //   scored, `reworded-aria`  best 0.389, runner-up -0.360, confidence 0.366
  //   refused by the veto      best -0.065, runner-up -0.360, confidence 0
  //
  // The exact row is the newest of the four and the one that used to be blank.
  // It carries no runner-up because an exact strategy weighed one element, and
  // that is the difference a reader should take from the table: 1.000 with
  // nothing to compare against is a selector that answered, while 1.000 over a
  // runner-up's 0.382 is a tie Core broke.
  //
  // The middle two both report `succeeded` and both clicked the right control.
  // A Flow reading only the status cannot tell them apart; reading the
  // confidence it can, and 1.000 against 0.366 is the difference between a
  // control matched on a signal that identifies it and one recovered by 0.039
  // over the floor. That is the distinction this field exists to carry.
  test("an exact match reports the strategy that answered, and claims no score it did not measure", async ({ openHarness }) => {
    const harness = await openHarness("identity-drift");
    const recorded = await describe(harness, SAVE_BASELINE);

    const reply = await harness.runAction({
      commandId: "diagnostics:exact",
      actionType: "web.dom.click",
      ...(recorded.selector ? { selector: recorded.selector } : {}),
      options: recordedElement(recorded)
    });

    // Nothing drifted, so the recorded selector answers at once and one element
    // survives the gate -- and it reports what that match scored, which it did
    // not until 2026-09-12. `identity/veto.ts` has always weighed an exact match
    // before it is acted on; it used to return the measurement only when it
    // refused and drop it when it accepted, so this row asserted an empty
    // resolution. The number is Core's, taken on the way past, and no element is
    // scored twice to get it.
    //
    // 1.000 at full confidence, because the descriptor was read off this very
    // page and nothing has moved: this is what a resolution looks like when the
    // recording and the page still agree completely, and it is the top of the
    // scale the other three rows are read against.
    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.resolution).toEqual({ strategy: "selector", candidateCount: 1, bestScore: 1, confidence: 1 });
    // No runner-up: one element was weighed, so there is nothing to compare it
    // with, and the field is absent rather than zero.
    expect(reply.resolution?.runnerUpScore).toBeUndefined();
  });

  test("a verb that resolves nothing gains no measurement", async ({ openHarness }) => {
    const harness = await openHarness("long-document");

    // Scrolling to a position resolves no element, so there is nothing to
    // report and the field stays absent. The pair matters: "no resolution" and
    // "a resolution with no scores" are different statements, and a reader of
    // the result can tell which they have.
    const reply = await harness.runAction({
      commandId: "diagnostics:no-target",
      actionType: "web.dom.scroll",
      options: { y: 200 }
    });

    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.resolution).toBeUndefined();
  });
});

/**
 * What `validateWebRuntimeTargetOverrideEvidence` resolves the model's
 * `{ element: "target.2" }` to on this page, copied from its output as
 * `domain/src/runtime/llm-evidence/tests/renamed-save-override.test.ts` pins it.
 * This is what an applied repair stores as the node's `target`.
 */
const REPAIRED_SAVE = {
  handles: { element: "target.2" },
  handleResolution: "named",
  tagName: "button",
  accessibleName: "Apply changes",
  selector: "main > form > section:nth-of-type(1) > div > button:nth-of-type(1)",
  metadata: { controlType: "submit", formId: "settings-form" }
} as const;

type NodePayload = Parameters<typeof webAutomationOutputPayload>[1];

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
function dispatchedRepair(commandId: string, recording: NodePayload): Parameters<ContentHarness["runAction"]>[0] {
  const node = webAutomationOutputPayload("web.dom.click", recording);
  const prepared = { ...node, target: normalizeAutomationStudioElementTarget({ ...REPAIRED_SAVE }, { source: "runtime" }) as unknown as NodePayload };
  const target = outputTargetFromPayload(prepared);
  const command = webAutomationActionFromGatewayCommand({ commandId, actionType: "web.dom.click", ...(target ? { target } : {}), parameters: prepared });
  if ("status" in command) throw new Error(`the domain rejected the repaired click: ${command.message}`);
  return command;
}

// The near-miss: a different action whose label contains the recorded one
// (design A, reports/i-resolver-safety.md "(a)", rows R1-R4 and R7-R8). Save is
// recorded, then the page puts "Save changes and exit" where a replay looks for
// it. Core gives that label the rung it gives "Save changes" shortened, so these
// pages had the resolver click the wrong action and report success: through
// Level 2 at 0.633 on a recording with no identifiers, through the Level 1 veto
// on the same recording, and at 0.359 on an authored one once the wrong action
// carried no identifiers of its own. `identity/corroboration.ts` now requires
// something that says which control this is to agree exactly.
//
// Each row replays as a replay sends it and as the Flow lane does, with the
// recorded bounds too, because a point is a third way onto the near-miss: R1
// was accepted through it at 0.088. Both must refuse, nothing may be clicked,
// and the oracle must record no save. The control is the same near-miss beside
// the Save it imitates. These rows live here rather than in a spec of their own
// because `e2e/content/tests/` is at its 25-file structure limit.

const NEAR_MISS = { id: "exit-btn", testId: "save-and-exit", text: "Save changes and exit" };

type NearMissPage = "R1" | "R2" | "R3" | "R4" | "R7" | "R8" | "control";

/** Records Save; `identifierLess` takes its id and test id off first, which is how a page with neither records it. */
async function recordSave(harness: ContentHarness, identifierLess: boolean) {
  if (identifierLess) {
    await harness.page.locator(SAVE_BASELINE).evaluate((element) => {
      element.removeAttribute("id");
      element.removeAttribute("data-testid");
    });
  }
  const selector = identifierLess ? "button.btn.btn-primary" : SAVE_BASELINE;
  return { recorded: await describe(harness, selector), bounds: await documentRect(harness, selector) };
}

/** Puts the near-miss where each row needs it; every shape but R7 and R8 gives it an id and a test id of its own. */
async function arrangeNearMiss(page: Page, row: NearMissPage): Promise<void> {
  await page.evaluate(({ which, nearMiss }) => {
    const group = document.querySelector('[data-testid="primary-actions"]')!;
    const save = group.querySelector('button[type="submit"]')!;
    const discard = group.querySelector('[data-testid="discard-changes"]')!;
    const button = document.createElement("button");
    button.type = "button";
    if (which !== "R7" && which !== "R8") {
      button.id = nearMiss.id;
      button.setAttribute("data-testid", nearMiss.testId);
    }
    button.textContent = nearMiss.text;
    if (which === "R1" || which === "R3" || which === "R7" || which === "R8") save.replaceWith(button);
    else document.querySelector("main > header")!.append(button);
    if (which === "R2" || which === "R4") save.remove();
    if (which === "R1" || which === "R2" || which === "R7") discard.remove();
  }, { which: row, nearMiss: NEAR_MISS });
}

/** Starts recording every click the page receives, whatever it lands on, and returns a reader for them. */
async function trackClicks(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    const clicks: string[] = [];
    (window as unknown as { __nearMissClicks: string[] }).__nearMissClicks = clicks;
    document.addEventListener("click", (event) => clicks.push(((event.target as Element | null)?.textContent ?? "").trim()), true);
  });
  return () => page.evaluate(() => (window as unknown as { __nearMissClicks: string[] }).__nearMissClicks);
}

test.describe("identity-drift near-miss: a label that contains the recorded one is not the recorded control", () => {
  for (const spec of [
    { row: "R1", identifierLess: false, page: "Save replaced in its slot by the near-miss, Discard removed" },
    { row: "R2", identifierLess: true, page: "Save and Discard gone, the near-miss in the header" },
    { row: "R3", identifierLess: true, page: "the near-miss in Save's slot, Discard kept" },
    { row: "R4", identifierLess: true, page: "Save gone, Discard left in the slot, the near-miss in the header" },
    { row: "R7", identifierLess: false, page: "Save replaced by the near-miss with no identifiers, Discard removed" },
    { row: "R8", identifierLess: false, page: "Save replaced by the near-miss with no identifiers, Discard kept" }
  ] as const) {
    test(`${spec.row}, ${spec.identifierLess ? "identifier-less" : "authored"} recording: ${spec.page}`, async ({ openHarness, page }) => {
      const harness = await openHarness("identity-drift");
      const { recorded, bounds } = await recordSave(harness, spec.identifierLess);
      await arrangeNearMiss(page, spec.row);
      await expect(page.getByRole("button", { name: NEAR_MISS.text, exact: true })).toHaveCount(1);
      const clicks = await trackClicks(page);

      const selector = recorded.selector ? { selector: recorded.selector } : {};
      for (const [shape, point] of [["replay", {}], ["flow", { visualTarget: visualTarget({ documentBounds: bounds }) }]] as const) {
        const reply = await harness.runAction({ commandId: `near-miss:${spec.row}:${shape}`, actionType: "web.dom.click", ...selector, ...point, options: recordedElement(recorded) });
        expect(reply, `${shape}: ${reply.message}`).toMatchObject({ status: "failed", failure: TARGET_NOT_FOUND });
      }

      expect(await clicks()).toEqual([]);
      expect((await harness.finalState()).state).toMatchObject({ saveCount: 0, discardCount: 0, savedInMode: null });
    });
  }

  test("control: the same near-miss beside the Save it imitates, and Save is what resolves", async ({ openHarness, page }) => {
    const harness = await openHarness("identity-drift");
    const { recorded } = await recordSave(harness, true);
    await arrangeNearMiss(page, "control");

    const reply = await harness.runAction({ commandId: "near-miss:control", actionType: "web.dom.click", ...(recorded.selector ? { selector: recorded.selector } : {}), options: recordedElement(recorded) });

    expect(reply.status, reply.message).toBe("succeeded");
    expect(reply.element).toMatchObject({ tagName: "button", visibleText: "Save changes" });
    await expect.poll(async () => (await harness.finalState()).state).toMatchObject({ saveCount: 1, discardCount: 0 });
  });
});

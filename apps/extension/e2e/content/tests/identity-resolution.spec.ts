// How the content script chooses the element an action acts on, once the page
// has moved on from the recording (Phase 1.3 step 3).
//
// Three things are pinned here, and all three are changes from the resolver
// this suite's sibling `resolve-target.spec.ts` describes.
//
// A replayed action finds its control through whichever signal the drift left
// standing: identity-drift renders one Save action four ways, and each mode
// takes a different signal away. The rows below replay the *recorded*
// descriptor -- read off the baseline page through `web.dom.extract`, not
// hand-written -- so what is exercised is the resolution a real replay
// performs, not a fingerprint invented to suit it.
//
// Scope, precisely: these rows hand the descriptor to the content script the
// way the background worker does, in `options.element`, and prove what the
// content script then does with it. They are not end-to-end proof of the
// plumbing that fills `options` on a live run. That half lives in the domain --
// `webAutomationOutputPayload` puts the fingerprint in a node's `parameters`
// and `webAutomationActionFromGatewayCommand` copies `parameters` into
// `options` -- and belongs to the domain's own tests. One difference between
// the two halves is worth knowing: the wire fingerprint is narrowed by
// `output-nodes/targets.ts`, which keeps every signal resolution reads
// (selector, xpath, id, test id, tag, class names, visible text, name,
// attributes) but drops `implicitRole`, so only an explicit `role` reaches the
// candidate family on a live run.
//
// An ambiguous target is now a failure rather than a guess. Two identical
// Continue buttons used to resolve to whichever came first in document order,
// which is an answer that looks right until the day it is not; ambiguous-targets
// now reports TARGET_AMBIGUOUS and names what tied. The gate is what narrows a
// tie honestly: disable or hide one of the two and the remaining one resolves,
// because a control a person could not use is not the control the Flow meant.
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

import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

type ActionCommand = Parameters<ContentHarness["runAction"]>[0];
type ActionOptions = NonNullable<ActionCommand["options"]>;
type Descriptor = NonNullable<Awaited<ReturnType<ContentHarness["runAction"]>>["element"]>;
type Rect = { x: number; y: number; width: number; height: number };

const SAVE_BASELINE = '[data-testid="save-changes"]';
const DISPLAY_NAME = '[data-testid="display-name"]';
const PRIMARY = '[data-testid="choice-primary"]';
const SECONDARY = '[data-testid="choice-secondary"]';
const BELOW_FOLD = '[data-testid="below-fold-target"]';

/** The closed set's record for an ambiguous target, exactly as Core stores it. */
const TARGET_AMBIGUOUS = { category: "target_ambiguous", code: "web.target.ambiguous", retryable: false, stage: "target_resolution" };
/** And for one that could not be found at all. */
const TARGET_NOT_FOUND = { category: "target_not_found", code: "web.target.not_found", retryable: true, stage: "target_resolution" };

/** Each drifted rendering, and the id the Save action carries in it. */
const DRIFT_MODES = [
  { mode: "selector-only", saveId: "workspace-settings-submit" },
  { mode: "text-only", saveId: "save-settings" },
  { mode: "moved", saveId: "save-settings" },
  { mode: "wrapped-aria", saveId: "save-settings" }
] as const;

/** The descriptor for one element, read through `web.dom.extract`, which changes nothing. */
async function describe(harness: ContentHarness, selector: string): Promise<Descriptor> {
  const reply = await harness.runAction({ commandId: `describe:${selector}`, actionType: "web.dom.extract", selector });
  if (reply.status !== "succeeded" || !reply.element) {
    throw new Error(`extract did not describe ${selector}: ${reply.status} ${reply.message ?? ""}`);
  }
  return reply.element;
}

/** A recorded descriptor as a replayed command carries it, in `options.element`. */
function recordedElement(descriptor: Descriptor): ActionOptions {
  return { element: descriptor } as unknown as ActionOptions;
}

/** Arms an identity-drift mode through the fixture's own `set-mode`, then reloads the page. */
async function armMode(harness: ContentHarness, mode: string): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/identity-drift/set-mode`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify({ mode })
  });
  expect(response.ok, `arming ${mode} answered ${response.status}`).toBe(true);
  await harness.page.goto(harness.url);
  await expect
    .poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady"))
    .toBe(true);
}

async function documentRect(harness: ContentHarness, selector: string): Promise<Rect> {
  return harness.page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
  });
}

async function viewportRect(harness: ContentHarness, selector: string): Promise<Rect> {
  const box = await harness.page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} has no layout box.`);
  return box;
}

/** A visual target as the background worker sends it; the content script reads only its bounds. */
function visualTarget(bounds: { bounds?: Rect; documentBounds?: Rect }) {
  return { namespace: "web" as const, statePath: "harness.target", ...bounds };
}

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

test.describe("ambiguous-targets: a tie is reported, not guessed", () => {
  test("an ambiguous selector fails TARGET_AMBIGUOUS and names what tied", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");
    await expect(page.locator("button")).toHaveCount(2);

    const reply = await harness.runAction({ commandId: "selector-ambiguous", actionType: "web.dom.click", selector: "button" });
    expect(reply).toMatchObject({
      status: "failed",
      failure: { ...TARGET_AMBIGUOUS, expected: "one element matching selector button", actual: /^2 elements matched: /u },
      resolution: { strategy: "selector", candidateCount: 2 }
    });
    expect(reply.message).toContain('button[data-testid="choice-primary"] "Continue"');
    expect(reply.message).toContain('button[data-testid="choice-secondary"] "Continue"');
    // Nothing was clicked: the old resolver would have taken the first button.
    await expect(page.getByTestId("result")).toHaveText("None");
    expect((await harness.finalState()).state).toEqual({ selected: null });
  });

  test("an ambiguous fingerprint text fails TARGET_AMBIGUOUS; a unique test id still resolves", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");
    const ambiguous = await harness.runAction({
      commandId: "fingerprint-text-ambiguous",
      actionType: "web.dom.click",
      options: { element: { tagName: "button", visibleText: "Continue" } }
    });
    expect(ambiguous).toMatchObject({
      status: "failed",
      failure: { ...TARGET_AMBIGUOUS, expected: "one element matching element fingerprint" },
      resolution: { strategy: "fingerprint", candidateCount: 2 }
    });
    await expect(page.getByTestId("result")).toHaveText("None");

    const exact = await harness.runAction({
      commandId: "fingerprint-testid-exact",
      actionType: "web.dom.click",
      options: { element: { attributes: { "data-testid": "choice-secondary" } } }
    });
    expect(exact).toMatchObject({ status: "succeeded", element: { selector: SECONDARY } });
    await expect(page.getByTestId("result")).toHaveText("secondary");
  });

  test("the gate breaks the tie: a disabled twin is not the control the Flow meant", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");
    await page.locator(PRIMARY).evaluate((element) => element.setAttribute("disabled", ""));

    const reply = await harness.runAction({ commandId: "gate-disabled", actionType: "web.dom.click", selector: "button" });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: SECONDARY } });
    await expect(page.getByTestId("result")).toHaveText("secondary");
  });

  test("the gate breaks the tie: a hidden twin is not a candidate", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");
    await page.locator(SECONDARY).evaluate((element) => element.setAttribute("style", "display:none"));

    const reply = await harness.runAction({ commandId: "gate-hidden", actionType: "web.dom.click", selector: "button" });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: PRIMARY } });
    await expect(page.getByTestId("result")).toHaveText("primary");
  });

  test("a single hidden match still resolves: whether it can be acted on is the actionability gate's question", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");
    await page.locator(PRIMARY).evaluate((element) => element.setAttribute("style", "display:none"));

    const reply = await harness.runAction({ commandId: "single-hidden", actionType: "web.dom.click", selector: PRIMARY });
    // Resolved, then refused for being hidden -- not reported as "no target".
    expect(reply.status).toBe("failed");
    expect(reply.message).toContain("Action rejected");
    expect(reply.element).toMatchObject({ selector: PRIMARY });
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

  test("a control whose every recorded signal has drifted is refused, not approximated", async ({ openHarness, page }) => {
    const harness = await openHarness("identity-drift");
    const recorded = await describe(harness, SAVE_BASELINE);
    await armMode(harness, "selector-only");
    // selector-only already changes the id, the class and the test id. Taking
    // the text as well leaves nothing the recording knew this control by, which
    // is the case the fixture's four modes each stop one step short of.
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

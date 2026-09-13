// An ambiguous target is now a failure rather than a guess. Two identical
// Continue buttons used to resolve to whichever came first in document order,
// which is an answer that looks right until the day it is not; ambiguous-targets
// now reports TARGET_AMBIGUOUS and names what tied. The gate is what narrows a
// tie honestly: disable or hide one of the two and the remaining one resolves,
// because a control a person could not use is not the control the Flow meant.
//
// The gate rows below are the negative controls for the two above them: a tie
// that stays a tie unless something narrows it honestly. Disable one twin, hide
// the other, and the survivor resolves -- because a control a person could not
// use is not the control the Flow meant. The last row is the control on *those*:
// a single hidden match still resolves, so the gate is narrowing a tie and not
// quietly refusing hidden elements.
//
// One row that belongs to this subject lives elsewhere on purpose. "A
// descriptor that cannot tell the twins apart leaves them tied" is in
// `identity-resolution.spec.ts`, beside the two scored tie-breaks it is the
// negative control for: it is what proves those two were decided by the
// recorded test id rather than by document order. Splitting it away from them
// would leave both halves unable to say why they pass.
//
// `identity-veto.spec.ts` holds the refusal of a fast answer;
// `identity-fixtures.ts` holds the shared selectors and the scope caveat.

import { expect, test } from "../index.js";
import { PRIMARY, SECONDARY, TARGET_AMBIGUOUS } from "./identity-fixtures.js";

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

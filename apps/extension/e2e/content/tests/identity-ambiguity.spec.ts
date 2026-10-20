// An ambiguous target is a failure rather than a guess. company-website draws
// "Get a free quote" twice on its home page -- once in the header, once in the
// hero -- and a step addressed to `button[data-open-quote]` used to resolve to
// whichever came first in document order, which is an answer that looks right
// until the day it is not. It now reports TARGET_AMBIGUOUS and names what tied.
// The gate is what narrows a tie honestly: disable or hide one of the two and
// the remaining one resolves, because a control a person could not use is not
// the control the Flow meant.
//
// The gate rows below are the negative controls for the two above them: a tie
// that stays a tie unless something narrows it honestly. Disable one twin, hide
// the other, and the survivor resolves. The last row is the control on *those*:
// a single hidden match still resolves, so the gate is narrowing a tie and not
// quietly refusing hidden elements. Both buttons open the same quote drawer, so
// which one was pressed is read from the click log, by landmark.
//
// One row that belongs to this subject lives elsewhere on purpose. "A
// descriptor that cannot tell the twins apart leaves them tied" is in
// `identity-resolution.spec.ts`, beside the scored tie-breaks it is the negative
// control for: it is what proves those were decided by the recorded name rather
// than by document order. Splitting it away from them would leave both halves
// unable to say why they pass.
//
// `identity-veto.spec.ts` holds the refusal of a fast answer;
// `identity-fixtures.ts` holds the shared helpers and the scope caveat.

import { expect, test } from "../index.js";
import { TARGET_AMBIGUOUS, describe, quoteDrawer, trackClicks } from "./identity-fixtures.js";

const HEADER = "header button[data-open-quote]";
const HERO = "main button[data-open-quote]";
const BOTH = "button[data-open-quote]";

test.describe("company-website's two Get a free quote buttons: a tie is reported, not guessed", () => {
  test("an ambiguous selector fails TARGET_AMBIGUOUS and names what tied", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.settle(harness);
    await expect(page.locator(BOTH)).toHaveCount(2);
    const clicks = await trackClicks(page);

    const reply = await harness.runAction({ commandId: "selector-ambiguous", actionType: "web.dom.click", selector: BOTH });
    expect(reply).toMatchObject({
      status: "failed",
      failure: { ...TARGET_AMBIGUOUS, expected: `one element matching selector ${BOTH}`, actual: /^2 elements matched: /u },
      resolution: { strategy: "selector", candidateCount: 2 }
    });
    expect(reply.message).toBe(`Target ambiguous: selector ${BOTH} matched 2 elements: button "Get a free quote", button "Get a free quote".`);
    // Nothing was pressed: the old resolver would have taken the header's.
    expect(await clicks()).toEqual([]);
    await expect(page.getByRole("dialog", { name: "Get a free quote" })).toBeHidden();
  });

  test("an ambiguous fingerprint text fails TARGET_AMBIGUOUS; one twin's own class set still does not separate them", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.settle(harness);
    const clicks = await trackClicks(page);
    const ambiguous = await harness.runAction({
      commandId: "fingerprint-text-ambiguous",
      actionType: "web.dom.click",
      options: { element: { tagName: "button", visibleText: "Get a free quote" } }
    });
    expect(ambiguous).toMatchObject({
      status: "failed",
      failure: { ...TARGET_AMBIGUOUS, expected: "one element matching element fingerprint", actual: '2 elements matched: button "Get a free quote" (1.00), button "Get a free quote" (1.00)' },
      resolution: { strategy: "fingerprint", candidateCount: 2 }
    });

    // The header's hashed class is the one signal in this fingerprint the hero
    // does not share, and it moves the hero to 0.86 -- inside the margin, so
    // still a tie. A class a component library hashed is not identity; neither
    // twin carries a test id or an id, which is what would decide it.
    const header = await describe(harness, HEADER);
    const withClass = await harness.runAction({
      commandId: "fingerprint-text-class",
      actionType: "web.dom.click",
      options: { element: { tagName: "button", visibleText: "Get a free quote", classNames: header.classNames ?? [] } }
    });
    expect(withClass).toMatchObject({
      status: "failed",
      failure: { ...TARGET_AMBIGUOUS, actual: '2 elements matched: button "Get a free quote" (1.00), button "Get a free quote" (0.86)' },
      resolution: { strategy: "fingerprint", candidateCount: 2 }
    });
    expect(await clicks()).toEqual([]);
  });

  test("the gate breaks the tie: a disabled twin is not the control the Flow meant", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.settle(harness);
    await page.locator(HEADER).evaluate((element) => element.setAttribute("disabled", ""));
    const hero = await describe(harness, HERO);
    const clicks = await trackClicks(page);

    const reply = await harness.runAction({ commandId: "gate-disabled", actionType: "web.dom.click", selector: BOTH });
    expect(reply, reply.message).toMatchObject({ status: "succeeded", element: { selector: hero.selector } });
    await expect(page.getByRole("dialog", { name: "Get a free quote" })).toBeVisible();
    expect(await clicks()).toContain("main|Get a free quote");
    expect(await clicks()).not.toContain("header|Get a free quote");
  });

  test("the gate breaks the tie: a hidden twin is not a candidate", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.settle(harness);
    const header = await describe(harness, HEADER);
    await page.locator(HERO).evaluate((element) => element.setAttribute("style", "display:none"));
    const clicks = await trackClicks(page);

    const reply = await harness.runAction({ commandId: "gate-hidden", actionType: "web.dom.click", selector: BOTH });
    expect(reply, reply.message).toMatchObject({ status: "succeeded", element: { selector: header.selector } });
    await expect(page.getByRole("dialog", { name: "Get a free quote" })).toBeVisible();
    expect(await clicks()).toEqual(["header|Get a free quote"]);
  });

  test("a single hidden match still resolves: whether it can be acted on is the actionability gate's question", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await quoteDrawer.settle(harness);
    const header = await describe(harness, HEADER);
    await page.locator(HEADER).evaluate((element) => element.setAttribute("style", "display:none"));

    const reply = await harness.runAction({ commandId: "single-hidden", actionType: "web.dom.click", selector: HEADER });
    // Resolved, then refused for being hidden -- not reported as "no target".
    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).toBe("web.target.not_shown");
    expect(reply.message).toContain("Action rejected");
    expect(reply.element).toMatchObject({ selector: header.selector });
    await expect(page.getByRole("dialog", { name: "Get a free quote" })).toBeHidden();
  });
});

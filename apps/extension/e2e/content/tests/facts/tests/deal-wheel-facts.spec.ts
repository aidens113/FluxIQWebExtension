// The fact check (plan B1) on a realistic page: everything-store's `deal-wheel`
// variant throws a spin-to-win wheel over its first results page. A batch of
// claims is sent as the background worker sends it (`fluxiq.evaluateFacts`)
// and answered by the real content script from the live document, with no
// provider and no wait.
//
// What is proven here and nowhere else: the dialog fact reads `true` while the
// wheel shows and `false` once a person has closed it; the wheel, which no
// interference classifier names, leaves a claim about a dialog *kind*
// `unknown` rather than `false`; the other kinds read the real page by the
// assertion's and resolver's own reads; and a claim about a document other
// than the one standing is `unknown`. An unreadable frame and a capture that
// throws are the worker's and the judge's to answer, and are proven in their
// unit tests (`runtime/tests/fact-check-runner.test.ts`,
// `content/facts/tests/`), because this harness has no background worker.

import type { WebAutomationFactCheckResult, WebAutomationFactQuery } from "@fluxiq-web-extension/domain/client";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const WHEEL = '[data-testid="deal-wheel"]';
const SEARCH_BOX = 'form[role="search"] input[name="k"]';

/** Applies one Scenario Lab operation to the harness's scenario. */
async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

/** Sends one batch as the worker sends a frame its share, and returns the page's answer. */
async function facts(harness: ContentHarness, queries: WebAutomationFactQuery[], documentTimeOrigin?: number): Promise<WebAutomationFactCheckResult> {
  const delivery = await harness.deliver({ type: "fluxiq.evaluateFacts", frameId: 0, request: { queries, ...(documentTimeOrigin === undefined ? {} : { documentTimeOrigin }) } });
  expect(delivery.responded, "the content script answered the fact check").toBe(true);
  return delivery.response as WebAutomationFactCheckResult;
}

function verdicts(result: WebAutomationFactCheckResult): string[] {
  return result.answers.map((answer) => answer.result);
}

const DIALOG_OPEN: WebAutomationFactQuery = { kind: "dialog", expected: true };
const WHEEL_BY_NAME: WebAutomationFactQuery = { kind: "dialog", expected: true, nameContains: "spin to win" };
const PROMOTION_OPEN: WebAutomationFactQuery = { kind: "dialog", expected: true, dialogKind: "promotion" };
const WHEEL_EXISTS: WebAutomationFactQuery = { kind: "exists", target: { selector: WHEEL }, expected: true };

test("everything-store deal wheel: the dialog fact is true while the wheel shows and false once it is closed", async ({ openHarness, page }) => {
  const harness = await openHarness("everything-store");
  // As dialog-dismissal.spec.ts arms it: the mode is set without reloading the
  // home page, so no other store modal is queued in front of the wheel.
  await apply(harness, "set-mode", { mode: "deal-wheel" });
  await page.goto(new URL("/scenarios/everything-store/s?k=earbuds", harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  const wheel = page.locator(WHEEL);
  await expect(wheel).toBeVisible({ timeout: 30_000 });

  const showing = await facts(harness, [
    DIALOG_OPEN,
    WHEEL_BY_NAME,
    PROMOTION_OPEN,
    WHEEL_EXISTS,
    { kind: "visible", target: { selector: WHEEL }, expected: true },
    { kind: "text", comparison: "contains", expected: "Spin to win up to 20% off!" },
    { kind: "url", comparison: "contains", expected: "/s?k=earbuds" },
    { kind: "count", target: { selector: '[role="dialog"]' }, comparison: ">=", expected: 1 },
    { kind: "enabled", target: { selector: `${WHEEL} [data-spin]` }, expected: true },
    { kind: "value", target: { selector: SEARCH_BOX }, comparison: "equals", expected: "earbuds" }
  ]);
  expect(verdicts(showing)).toEqual(["true", "true", "unknown", "true", "true", "true", "true", "true", "true", "true"]);
  // The wheel is a dialog no classifier names, so a claim that a promotion is
  // open cannot be answered either way (`layer-kind.ts` produces no `promotion`).
  expect(showing.answers[2]?.evidence?.reason).toBe("unclassified_dialog");
  expect(showing.answers[1]?.evidence?.excerpt).toBe("Spin to win up to 20% off!");
  expect(showing.answers[3]?.evidence?.element?.testId).toBe("deal-wheel");
  expect(showing.document?.readyState).not.toBe("loading");
  const timeOrigin = showing.document?.timeOrigin;
  expect(typeof timeOrigin).toBe("number");

  // Asked about another document, nothing is answered either way.
  const stale = await facts(harness, [DIALOG_OPEN, WHEEL_EXISTS], (timeOrigin as number) + 1);
  expect(stale.answers.map((answer) => [answer.result, answer.evidence?.reason])).toEqual([["unknown", "stale_document"], ["unknown", "stale_document"]]);

  // A person closes the wheel by its own way out.
  await page.locator(`${WHEEL} [data-decline]`).click();
  await expect(wheel).toBeHidden();

  const closed = await facts(harness, [
    DIALOG_OPEN,
    WHEEL_BY_NAME,
    PROMOTION_OPEN,
    WHEEL_EXISTS,
    { kind: "visible", target: { selector: WHEEL }, expected: false },
    { kind: "dialog", expected: false },
    { kind: "count", target: { selector: '[role="dialog"]' }, comparison: "=", expected: 0 }
  ], timeOrigin);
  expect(verdicts(closed)).toEqual(["false", "false", "false", "false", "true", "true", "true"]);
});

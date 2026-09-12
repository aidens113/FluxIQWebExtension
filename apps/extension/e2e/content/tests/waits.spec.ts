// The wait conditions, in the real content bundle on two Scenario Lab
// fixtures: a target that arrives late (delayed-ui) and a flow whose
// interstitial the page replaces with a result (intermediate-state).
//
// Each spec proves the wait observed the page reach the condition, and that a
// wait which ran out of time reports `timed_out` with Core's timeout category
// rather than a flattened failure. The fixtures are driven through Playwright's
// own trusted click and fill, so these specs are about the waits and not about
// the click and type verbs other Wave 2 workers are changing in parallel.
//
// `too-slow` is the bench corpus's W25 case expressed in the harness: a wait
// whose own timeout is shorter than the fixture's delay. The delayed-ui fixture
// declares no `too-slow` variant and the content harness has no variant
// control, so the case is made by the command's `timeoutMs`.

import type { BrowserActionResult } from "../../../src/shared/protocol.js";
import { expect, test } from "../index.js";

const BEGIN = '[data-testid="begin-delay"]';
const LATE = '[data-testid="late-action"]';
const PROCESSING = '[data-testid="processing"]';
const RESULT = '[data-testid="claim-result"]';

/** The validation's `actual`, or a failure naming the reason it was skipped. */
function actualOf(reply: BrowserActionResult): string {
  if (reply.validation.status === "none") throw new Error(`The reply reported no validation: ${reply.validation.reason}`);
  return reply.validation.actual;
}

/** Fills the claim form and submits it, as a person would; the fixture then takes 800 ms to answer. */
async function submitClaim(page: import("@playwright/test").Page): Promise<void> {
  await page.getByTestId("employee-name").fill("Ada Lovelace");
  await page.getByTestId("claim-amount").fill("42.50");
  await page.getByTestId("submit-claim").click();
}

test("present: the default condition waits for the late target and reports the element", async ({ openHarness, page }) => {
  const harness = await openHarness("delayed-ui");
  const pending = harness.runAction({ commandId: "late", actionType: "web.dom.wait_for_selector", selector: LATE, timeoutMs: 5_000 });
  await page.locator(BEGIN).click();
  expect(await pending).toMatchObject({
    status: "succeeded",
    message: "Selector found.",
    validation: { status: "passed", actual: "the element was found" },
    element: { selector: LATE }
  });
  await expect(page.locator(LATE)).toBeVisible();
});

test("too-slow: a wait shorter than the fixture's delay reports timed_out, not failed", async ({ openHarness, page }) => {
  const harness = await openHarness("delayed-ui");
  const pending = harness.runAction({ commandId: "too-slow", actionType: "web.dom.wait_for_selector", selector: LATE, timeoutMs: 25 });
  await page.locator(BEGIN).click();
  expect(await pending).toMatchObject({
    status: "timed_out",
    message: `Timed out waiting for selector: ${LATE}`,
    validation: { status: "failed", actual: "no element matched before the timeout" },
    failure: { category: "timeout", code: "web.action.timeout", retryable: true }
  });
  // The target does arrive: the wait was too short, the page was not at fault.
  await expect(page.locator(LATE)).toBeVisible();
});

test("visible: a present but unrendered element does not satisfy visible; a revealed one does", async ({ openHarness, page }) => {
  const harness = await openHarness("delayed-ui");
  await page.evaluate(() => {
    const box = document.createElement("p");
    box.dataset.testid = "revealed";
    box.textContent = "Revealed";
    box.style.display = "none";
    document.querySelector("main")?.append(box);
  });
  const selector = '[data-testid="revealed"]';

  const present = await harness.runAction({ commandId: "hidden-present", actionType: "web.dom.wait_for_selector", selector, timeoutMs: 5_000 });
  expect(present).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: "the element was found" } });

  const tooSoon = await harness.runAction({ commandId: "hidden-visible", actionType: "web.dom.wait_for_selector", selector, wait: { condition: "visible" }, timeoutMs: 150 });
  expect(tooSoon).toMatchObject({
    status: "timed_out",
    message: `Timed out waiting for a visible element: ${selector}`,
    validation: { status: "failed", actual: "the element was not visible before the timeout" },
    failure: { category: "timeout" }
  });

  const pending = harness.runAction({ commandId: "revealed", actionType: "web.dom.wait_for_selector", selector, wait: { condition: "visible" }, timeoutMs: 5_000 });
  await page.locator(selector).evaluate((element) => {
    setTimeout(() => { (element as HTMLElement).style.display = "block"; }, 150);
  });
  expect(await pending).toMatchObject({
    status: "succeeded",
    message: "The element is visible.",
    validation: { status: "passed", actual: "the element was visible" },
    element: { selector }
  });
});

test("enabled: the wait observes the disabled attribute clear", async ({ openHarness, page }) => {
  const harness = await openHarness("delayed-ui");
  await page.locator(BEGIN).evaluate((element) => {
    (element as HTMLButtonElement).disabled = true;
  });
  const pending = harness.runAction({ commandId: "enabled", actionType: "web.dom.wait_for_selector", selector: BEGIN, wait: { condition: "enabled" }, timeoutMs: 5_000 });
  await page.locator(BEGIN).evaluate((element) => {
    setTimeout(() => { (element as HTMLButtonElement).disabled = false; }, 150);
  });
  expect(await pending).toMatchObject({
    status: "succeeded",
    message: "The element is enabled.",
    validation: { status: "passed", actual: "the element was enabled" },
    element: { selector: BEGIN }
  });
  await expect(page.locator(BEGIN)).toBeEnabled();
});

test("url: a same-document address change, which mutates nothing, still satisfies the wait", async ({ openHarness, page }) => {
  const harness = await openHarness("delayed-ui");
  const pending = harness.runAction({
    commandId: "url",
    actionType: "web.dom.wait_for_selector",
    wait: { condition: "url", url: "?step=late" },
    timeoutMs: 5_000
  });
  await page.evaluate(() => {
    setTimeout(() => history.pushState({}, "", "?step=late"), 150);
  });
  const reply = await pending;
  expect(reply).toMatchObject({ status: "succeeded", message: "The URL matched.", validation: { status: "passed" } });
  expect(actualOf(reply)).toContain("?step=late");
  expect(page.url()).toContain("?step=late");
});

test("stable: the wait holds while the page keeps changing and resolves once it goes quiet", async ({ openHarness, page }) => {
  const harness = await openHarness("delayed-ui");
  await page.evaluate(() => {
    let remaining = 8;
    const tick = (): void => {
      const line = document.createElement("p");
      line.textContent = `tick ${remaining}`;
      document.querySelector("main")?.append(line);
      remaining -= 1;
      if (remaining > 0) setTimeout(tick, 50);
    };
    setTimeout(tick, 0);
  });
  const startedAt = Date.now();
  const reply = await harness.runAction({
    commandId: "stable",
    actionType: "web.dom.wait_for_selector",
    wait: { condition: "stable", stableForMs: 200 },
    timeoutMs: 5_000
  });
  expect(reply).toMatchObject({
    status: "succeeded",
    message: "The page is stable.",
    validation: { status: "passed", actual: "the page stopped changing for 200 ms" }
  });
  // Eight ticks 50 ms apart, then 200 ms of quiet: the wait cannot have resolved during the churn.
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(400);
  await expect(page.getByText("tick 1")).toBeVisible();
});

test("absent: the wait observes the interstitial leave the DOM", async ({ openHarness, page }) => {
  const harness = await openHarness("intermediate-state");
  await submitClaim(page);
  await expect(page.locator(PROCESSING)).toBeVisible();
  const reply = await harness.runAction({
    commandId: "processing-gone",
    actionType: "web.dom.wait_for_selector",
    selector: PROCESSING,
    wait: { condition: "absent" },
    timeoutMs: 5_000
  });
  expect(reply).toMatchObject({
    status: "succeeded",
    message: "The element is gone.",
    validation: { status: "passed", actual: "no element matched the selector" }
  });
  expect(reply.element).toBeUndefined();
  await expect(page.locator(RESULT)).toBeVisible();
});

test("visible: the wait observes the claim's result replace the interstitial", async ({ openHarness, page }) => {
  const harness = await openHarness("intermediate-state");
  const pending = harness.runAction({
    commandId: "result-visible",
    actionType: "web.dom.wait_for_selector",
    selector: RESULT,
    wait: { condition: "visible" },
    timeoutMs: 5_000
  });
  await submitClaim(page);
  expect(await pending).toMatchObject({
    status: "succeeded",
    message: "The element is visible.",
    validation: { status: "passed", actual: "the element was visible" },
    element: { selector: RESULT }
  });
  await expect(page.getByTestId("result-status")).toHaveText("Submitted for review");
});

test("wait_for_text: waits for the result's text, then for the interstitial's text to go", async ({ openHarness, page }) => {
  const harness = await openHarness("intermediate-state");
  const pending = harness.runAction({ commandId: "wait-text", actionType: "web.dom.wait_for_text", text: "Submitted for review", timeoutMs: 5_000 });
  await submitClaim(page);
  const found = await pending;
  expect(found).toMatchObject({ status: "succeeded", message: "Text found.", validation: { status: "passed", actual: "the text was found" } });
  expect(found.element).toBeUndefined();

  const gone = await harness.runAction({
    commandId: "text-gone",
    actionType: "web.dom.wait_for_text",
    text: "Processing your claim",
    wait: { condition: "absent" },
    timeoutMs: 5_000
  });
  expect(gone).toMatchObject({ status: "succeeded", message: "The text is gone.", validation: { status: "passed", actual: "the text was absent" } });
});

test("wait_for_text: a timeout reports timed_out with the text it never saw", async ({ openHarness }) => {
  const harness = await openHarness("delayed-ui");
  const reply = await harness.runAction({ commandId: "text-never", actionType: "web.dom.wait_for_text", text: "Never rendered", timeoutMs: 100 });
  expect(reply).toMatchObject({
    status: "timed_out",
    message: "Timed out waiting for text: Never rendered",
    validation: { status: "failed", expected: "page text containing Never rendered", actual: "the text did not appear before the timeout" },
    failure: { category: "timeout", code: "web.action.timeout", retryable: true }
  });
});

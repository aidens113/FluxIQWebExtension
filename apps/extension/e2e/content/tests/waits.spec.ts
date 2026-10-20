// The wait conditions, in the real content bundle on job-board's results
// page, whose job pane is the late content a person waits for: a click on a
// card swaps the pane for a skeleton, records the job in the address with
// `history.replaceState`, and shows the job at least 700 ms later. The second
// pane opened on a page never finishes until its Retry link is pressed, and
// every sixth results page is the rate limiter's notice, whose "Try again"
// button stays disabled through a five-second countdown.
//
// Each spec proves the wait observed the page reach the condition, and that a
// wait which ran out of time reports `timed_out` with Core's timeout category
// rather than a flattened failure. The page is driven through Playwright's
// own trusted click, so these specs are about the waits and not about the
// click verb.
//
// `too-slow` is the bench corpus's W25 case: a wait whose own timeout is
// shorter than the page's delay, made by the command's `timeoutMs`.
//
// The board's class names are a hash of its build; the scenario's own
// `boardClasses` names them for the seed the harness runs.

import type { Locator, Page } from "@playwright/test";
import type { BrowserActionResult } from "../../../src/shared/protocol.js";
import { getScenario } from "../../../../scenario-lab/src/registry.js";
import { boardClasses } from "../../../../scenario-lab/src/scenarios/job-board/board/index.js";
import { expect, test, type ContentHarness } from "../index.js";

const css = boardClasses(getScenario("job-board")!.seed);
/** A job's pane once it has loaded: its root carries the job key. */
const PANE = "aside div[data-jk]";
/** The skeleton the pane shows while a job loads. */
const SKELETON = `.${css.skeleton}`;
const RESULTS_PATH = "/scenarios/job-board/jobs?q=engineer";
/** Every sixth results page is the rate limiter's; five pages served before it make the next one the notice. */
const PAGES_BEFORE_NOTICE = 5;

/**
 * The recovery account a wait that timed out on its own `timeoutMs` carries
 * (`src/content/action-runtime/recovery/account.ts`, since 36daa680). The wait
 * spent the command's whole budget, so `budget.ts` refuses the retry and the
 * loop reports one attempt that absorbed the timeout: the defence was reached
 * and was not enough, which is what a reader of the record must be able to see.
 */
const SPENT_WAIT = "; the execution did not recover within its 1 attempt after absorbing timeout, waiting 0 ms";

/**
 * The element a reply names is the one the page holds: the reply carries the
 * content script's own unique selector for it (an id, or a structural path,
 * since the board's classes are hashed), not the selector the command sent.
 */
async function expectReportedElement(reply: BrowserActionResult, expected: Locator): Promise<void> {
  const selector = reply.element?.selector;
  expect(selector, "the reply names the element it found").toEqual(expect.any(String));
  expect(await expected.evaluate((element, unique) => document.querySelector(unique) === element, selector!), `${selector} is the element waited for`).toBe(true);
}

/** The validation's `actual`, or a failure naming the reason it was skipped. */
function actualOf(reply: BrowserActionResult): string {
  if (reply.validation.status === "none") throw new Error(`The reply reported no validation: ${reply.validation.reason}`);
  return reply.validation.actual;
}

/** Posts one of the board's own page mutations, as the page's `mutate` does. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.status, `${harness.scenarioId} ${operation}`).toBe(200);
}

/** A results page with consent answered, the alert offer declined and the chat minimised, as a returning visitor finds it. */
async function openResults(openHarness: (id: string) => Promise<ContentHarness>, before?: (harness: ContentHarness) => Promise<void>): Promise<ContentHarness> {
  const harness = await openHarness("job-board");
  await mutate(harness, "consent", { choice: "accepted" });
  await mutate(harness, "dismiss-alert-offer");
  await mutate(harness, "minimise-chat");
  await before?.(harness);
  await harness.page.goto(new URL(RESULTS_PATH, harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  return harness;
}

/** The nth job card on the page (0-based) and its job key. */
async function card(page: Page, index: number): Promise<{ title: ReturnType<Page["locator"]>; key: string }> {
  const article = page.locator("ol article[data-jk]").nth(index);
  const key = await article.getAttribute("data-jk");
  if (!key) throw new Error(`job card ${index} has no key`);
  return { title: article.locator("h2"), key };
}

test("present: the default condition waits for the late pane and reports the element", async ({ openHarness, page }) => {
  const harness = await openResults(openHarness);
  const first = await card(page, 0);
  const pending = harness.runAction({ commandId: "late", actionType: "web.dom.wait_for_selector", selector: PANE, timeoutMs: 5_000 });
  await first.title.click();
  const reply = await pending;
  expect(reply).toMatchObject({
    status: "succeeded",
    message: "Selector found.",
    validation: { status: "passed", actual: "the element was found" }
  });
  await expect(page.locator(PANE)).toHaveAttribute("data-jk", first.key);
  await expectReportedElement(reply, page.locator(PANE));
});

test("too-slow: a wait shorter than the pane's delay reports timed_out, not failed", async ({ openHarness, page }) => {
  const harness = await openResults(openHarness);
  const pending = harness.runAction({ commandId: "too-slow", actionType: "web.dom.wait_for_selector", selector: PANE, timeoutMs: 25 });
  await (await card(page, 0)).title.click();
  expect(await pending).toMatchObject({
    status: "timed_out",
    message: `Timed out waiting for selector: ${PANE}`,
    validation: { status: "failed", actual: `no element matched before the timeout${SPENT_WAIT}` },
    failure: { category: "timeout", code: "web.action.timeout", retryable: true }
  });
  // The pane does arrive: the wait was too short, the page was not at fault.
  await expect(page.locator(PANE)).toBeVisible();
});

test("visible: a filter menu present but hidden does not satisfy visible; opened by its pill, it does", async ({ openHarness, page }) => {
  const harness = await openResults(openHarness);
  // The "Date posted" pill's menu is in the page from the start, hidden until the pill is pressed.
  const selector = `.${css.filters} > .${css.pillWrap}:first-child > .${css.pillMenu}`;
  await expect(page.locator(selector)).toBeHidden();

  const present = await harness.runAction({ commandId: "hidden-present", actionType: "web.dom.wait_for_selector", selector, timeoutMs: 5_000 });
  expect(present).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: "the element was found" } });

  const tooSoon = await harness.runAction({ commandId: "hidden-visible", actionType: "web.dom.wait_for_selector", selector, wait: { condition: "visible" }, timeoutMs: 150 });
  expect(tooSoon).toMatchObject({
    status: "timed_out",
    message: `Timed out waiting for a visible element: ${selector}`,
    validation: { status: "failed", actual: `the element was not visible before the timeout${SPENT_WAIT}` },
    failure: { category: "timeout" }
  });

  const pending = harness.runAction({ commandId: "revealed", actionType: "web.dom.wait_for_selector", selector, wait: { condition: "visible" }, timeoutMs: 5_000 });
  await page.getByRole("button", { name: "Date posted" }).click();
  const revealed = await pending;
  expect(revealed).toMatchObject({
    status: "succeeded",
    message: "The element is visible.",
    validation: { status: "passed", actual: "the element was visible" }
  });
  await expectReportedElement(revealed, page.locator(selector));
});

test("enabled: the wait observes the rate limiter's Try again button come out of its countdown", async ({ openHarness, page }) => {
  const harness = await openResults(openHarness, async (opened) => {
    for (let served = 0; served < PAGES_BEFORE_NOTICE; served += 1) await mutate(opened, "results-view", { page: 1 });
  });
  const selector = `button.${css.retry}`;
  await expect(page.locator(selector)).toBeDisabled();
  const reply = await harness.runAction({ commandId: "enabled", actionType: "web.dom.wait_for_selector", selector, wait: { condition: "enabled" }, timeoutMs: 8_000 });
  expect(reply).toMatchObject({
    status: "succeeded",
    message: "The element is enabled.",
    validation: { status: "passed", actual: "the element was enabled" }
  });
  await expectReportedElement(reply, page.locator(selector));
  await expect(page.locator(selector)).toHaveText("Try again");
});

test("url: a same-document address change, which mutates nothing, still satisfies the wait", async ({ openHarness, page }) => {
  const harness = await openResults(openHarness);
  const first = await card(page, 0);
  const pending = harness.runAction({
    commandId: "url",
    actionType: "web.dom.wait_for_selector",
    wait: { condition: "url", url: `vjk=${first.key}` },
    timeoutMs: 5_000
  });
  // Opening a job records it in the address with history.replaceState: no navigation.
  await first.title.click();
  const reply = await pending;
  expect(reply).toMatchObject({ status: "succeeded", message: "The URL matched.", validation: { status: "passed" } });
  expect(actualOf(reply)).toContain(`vjk=${first.key}`);
  expect(page.url()).toContain(`vjk=${first.key}`);
});

test("stable: the wait holds while the page keeps changing and resolves once it goes quiet", async ({ openHarness, page }) => {
  // The rate limiter's notice is the page's own churn that stops by itself: its
  // button rewrites "Try again in N" once a second and then, enabled, settles
  // on "Try again". A quiet window longer than one tick holds through it.
  const harness = await openResults(openHarness, async (opened) => {
    for (let served = 0; served < PAGES_BEFORE_NOTICE; served += 1) await mutate(opened, "results-view", { page: 1 });
  });
  const button = page.locator(`button.${css.retry}`);
  const stableForMs = 1_200;
  const startedAt = Date.now();
  const pending = harness.runAction({
    commandId: "stable",
    actionType: "web.dom.wait_for_selector",
    wait: { condition: "stable", stableForMs },
    timeoutMs: 10_000
  });
  const countingDown = /^Try again in (\d+)$/.exec((await button.textContent()) ?? "");
  expect(countingDown, "the countdown was still running when the wait began").not.toBeNull();
  await expect(button).toBeDisabled();
  const reply = await pending;
  const elapsed = Date.now() - startedAt;
  expect(reply).toMatchObject({
    status: "succeeded",
    message: "The page is stable.",
    validation: { status: "passed", actual: `the page stopped changing for ${stableForMs} ms` }
  });
  // The countdown had to finish before the page could be quiet: the button is
  // already enabled when the reply lands, read once rather than polled for.
  expect(await button.isEnabled(), "the countdown ended before the wait resolved").toBe(true);
  expect(await button.textContent()).toBe("Try again");
  // "Try again in N" seen at the start leaves N one-second ticks (the first may
  // be under a second away), then the quiet window: the wait cannot have
  // resolved during the churn.
  const ticksLeft = Number(countingDown![1]);
  expect(elapsed).toBeGreaterThanOrEqual((ticksLeft - 1) * 1_000 + stableForMs);
});

test("absent: the wait observes the pane's skeleton leave the DOM", async ({ openHarness, page }) => {
  const harness = await openResults(openHarness);
  await (await card(page, 0)).title.click();
  await expect(page.locator(SKELETON)).toBeVisible();
  const reply = await harness.runAction({
    commandId: "skeleton-gone",
    actionType: "web.dom.wait_for_selector",
    selector: SKELETON,
    wait: { condition: "absent" },
    timeoutMs: 5_000
  });
  expect(reply).toMatchObject({
    status: "succeeded",
    message: "The element is gone.",
    validation: { status: "passed", actual: "no element matched the selector" }
  });
  expect(reply.element).toBeUndefined();
  await expect(page.locator(PANE)).toBeVisible();
});

test("visible: the wait observes the job replace the skeleton", async ({ openHarness, page }) => {
  const harness = await openResults(openHarness);
  const pending = harness.runAction({
    commandId: "pane-visible",
    actionType: "web.dom.wait_for_selector",
    selector: PANE,
    wait: { condition: "visible" },
    timeoutMs: 5_000
  });
  await (await card(page, 0)).title.click();
  const reply = await pending;
  expect(reply).toMatchObject({
    status: "succeeded",
    message: "The element is visible.",
    validation: { status: "passed", actual: "the element was visible" }
  });
  await expectReportedElement(reply, page.locator(PANE));
  await expect(page.locator(PANE).getByRole("heading", { name: "Full job description" })).toBeVisible();
});

test("wait_for_text: waits for the job's text, then for the stuck pane's text to go once Retry is pressed", async ({ openHarness, page }) => {
  const harness = await openResults(openHarness);
  const pending = harness.runAction({ commandId: "wait-text", actionType: "web.dom.wait_for_text", text: "Full job description", timeoutMs: 5_000 });
  await (await card(page, 0)).title.click();
  const found = await pending;
  expect(found).toMatchObject({ status: "succeeded", message: "Text found.", validation: { status: "passed", actual: "the text was found" } });
  expect(found.element).toBeUndefined();

  // The second pane opened on a page never loads: after 3 s it says so and offers Retry.
  await (await card(page, 1)).title.click();
  const stuck = page.getByText("This is taking longer than usual.");
  await expect(stuck).toBeVisible({ timeout: 6_000 });
  const gone = harness.runAction({
    commandId: "text-gone",
    actionType: "web.dom.wait_for_text",
    text: "This is taking longer than usual.",
    wait: { condition: "absent" },
    timeoutMs: 5_000
  });
  await page.locator("aside").getByRole("link", { name: "Retry" }).click();
  expect(await gone).toMatchObject({ status: "succeeded", message: "The text is gone.", validation: { status: "passed", actual: "the text was absent" } });
});

test("wait_for_text: a timeout reports timed_out with the text it never saw", async ({ openHarness }) => {
  const harness = await openResults(openHarness);
  const reply = await harness.runAction({ commandId: "text-never", actionType: "web.dom.wait_for_text", text: "Never rendered", timeoutMs: 100 });
  expect(reply).toMatchObject({
    status: "timed_out",
    message: "Timed out waiting for text: Never rendered",
    validation: { status: "failed", expected: "page text containing Never rendered", actual: `the text did not appear before the timeout${SPENT_WAIT}` },
    failure: { category: "timeout", code: "web.action.timeout", retryable: true }
  });
});

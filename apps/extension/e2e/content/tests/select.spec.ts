// The select verb against a real `<select>`: by value, by label, and by index,
// what the page observes when an option is chosen, and the three requests that
// must change nothing -- an option the select does not have, a target that is
// not a select, and a command that names no option at all.
//
// Every row checks the page as well as the reply, because the point of Phase
// 1.2's validation is that a reply cannot claim more than the page did: a
// missing option is `failed` with Core's `output_not_observed` and the select
// still holds what it held before.
//
// The select is everything-store's "Search in" department picker, in the
// header search form on every page: a native `<select name="i">` that the GET
// form carries to the results page. The row that submits the form proves the
// selection reached the form's data, not only its DOM: the address the form
// submitted to says which department was searched. (The store answers a
// session's first search with its soft check at that same address.)

import type { Page } from "@playwright/test";
import { expect, test, type ContentHarness } from "../index.js";

const DEPARTMENT = 'select[name="i"]';
const KEYWORDS = 'input[name="k"]';
const GO = '[data-testid="nav-search-submit"]';

/** The header renders "All" as the selected department on a page that searched none. */
const INITIAL_DEPARTMENT = "all";

/** Posts one of the store's own page mutations, as the page's `mutate` does. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.status, `${harness.scenarioId} ${operation}`).toBe(200);
}

/**
 * everything-store's home page as a returning shopper finds it: consent, the
 * notifications prompt (which makes the whole page inert) and the app banner
 * already answered.
 */
async function openStore(openHarness: (id: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openHarness("everything-store");
  await mutate(harness, "consent", { choice: "accept" });
  await mutate(harness, "dismiss-nudge", { nudge: "notifications" });
  await mutate(harness, "dismiss-nudge", { nudge: "app-banner" });
  await harness.page.goto(harness.url);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  return harness;
}

/** Records the `input` and `change` events reaching the select from now on, and whether each was trusted. */
async function watchSelectEvents(page: Page): Promise<() => Promise<string[]>> {
  await page.locator(DEPARTMENT).evaluate((element) => {
    const seen: string[] = [];
    (window as unknown as { __harnessSeenEvents: string[] }).__harnessSeenEvents = seen;
    for (const type of ["input", "change"]) {
      element.addEventListener(type, (event) => seen.push(`${event.type}:${event.isTrusted ? "trusted" : "untrusted"}`));
    }
  });
  return () => page.evaluate(() => (window as unknown as { __harnessSeenEvents: string[] }).__harnessSeenEvents);
}

test("by value: selects the option and validates the value the select ended up holding", async ({ openHarness, page }) => {
  const harness = await openStore(openHarness);
  const reply = await harness.runAction({ commandId: "select-value", actionType: "web.dom.select", selector: DEPARTMENT, option: { by: "value", value: "grocery" } });
  expect(reply).toMatchObject({
    status: "succeeded",
    message: "Option selected.",
    validation: { status: "passed", expected: 'selected value "grocery" (value "grocery")', actual: 'selected value "grocery"' },
    element: { selector: DEPARTMENT, selectedValue: "grocery" }
  });
  expect(reply.failure).toBeUndefined();
  await expect(page.locator(DEPARTMENT)).toHaveValue("grocery");
});

test("by value: the legacy `value` field still names the option, as a recorded change sends it", async ({ openHarness, page }) => {
  const harness = await openStore(openHarness);
  const reply = await harness.runAction({ commandId: "select-legacy", actionType: "web.dom.select", selector: DEPARTMENT, value: "toys" });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: 'selected value "toys"' } });
  await expect(page.locator(DEPARTMENT)).toHaveValue("toys");
});

test("by label: matches the option's visible text, not its value", async ({ openHarness, page }) => {
  const harness = await openStore(openHarness);
  const reply = await harness.runAction({ commandId: "select-label", actionType: "web.dom.select", selector: DEPARTMENT, option: { by: "label", label: "Home & Kitchen" } });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: 'selected value "home" (label "Home & Kitchen")', actual: 'selected value "home"' }
  });
  await expect(page.locator(DEPARTMENT)).toHaveValue("home");
});

test("by index: chooses the option at that position", async ({ openHarness, page }) => {
  const harness = await openStore(openHarness);
  const reply = await harness.runAction({ commandId: "select-index", actionType: "web.dom.select", selector: DEPARTMENT, option: { by: "index", index: 1 } });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: 'selected value "electronics" (index 1)', actual: 'selected value "electronics"' }
  });
  await expect(page.locator(DEPARTMENT)).toHaveValue("electronics");
});

test("the page observes the selection: untrusted input and change, and the search form carries the chosen department", async ({ openHarness, page }) => {
  const harness = await openStore(openHarness);
  const seen = await watchSelectEvents(page);
  await harness.runAction({ commandId: "fill-keywords", actionType: "web.dom.type", selector: KEYWORDS, text: "kettle" });
  expect(await harness.runAction({ commandId: "choose-department", actionType: "web.dom.select", selector: DEPARTMENT, option: { by: "label", label: "Home & Kitchen" } }))
    .toMatchObject({ status: "succeeded" });
  expect(await seen()).toEqual(["input:untrusted", "change:untrusted"]);
  // Submitted as a person submits it; what is under test is that the selection is in the form's data.
  await page.locator(GO).click();
  await page.waitForURL((url) => url.pathname.endsWith("/s"));
  const searched = new URL(page.url());
  expect(searched.searchParams.get("i")).toBe("home");
  expect(searched.searchParams.get("k")).toBe("kettle");
});

// t464: a missing option is its own code, not retryable, and the failure names
// the value sent (as JSON) and the options closest to it before the full list.
test("a value with no option changes nothing and reports option_not_offered", async ({ openHarness, page }) => {
  const harness = await openStore(openHarness);
  const reply = await harness.runAction({ commandId: "select-missing-value", actionType: "web.dom.select", selector: DEPARTMENT, value: "garden" });
  expect(reply).toMatchObject({
    status: "failed",
    message: 'No option matched value "garden".',
    validation: {
      status: "failed",
      expected: 'an option matching value "garden" is selected',
      actual: expect.stringMatching(/^no option matched: the value sent was "garden" \(6 characters\); the closest options offered are .+; the select still holds "all" and offers "all" \(All\), "electronics" \(Electronics\), "home" \(Home & Kitchen\), "grocery" \(Grocery\), "toys" \(Toys & Games\)$/u)
    },
    failure: { category: "output_not_observed", code: "web.validation.option_not_offered", retryable: false, stage: "verification" }
  });
  await expect(page.locator(DEPARTMENT)).toHaveValue(INITIAL_DEPARTMENT);
});

test("a label with no option, and an index past the end, each change nothing", async ({ openHarness, page }) => {
  const harness = await openStore(openHarness);
  expect(await harness.runAction({ commandId: "select-missing-label", actionType: "web.dom.select", selector: DEPARTMENT, option: { by: "label", label: "Garden" } }))
    .toMatchObject({
      status: "failed",
      message: 'No option matched label "Garden".',
      failure: { category: "output_not_observed" }
    });
  expect(await harness.runAction({ commandId: "select-missing-index", actionType: "web.dom.select", selector: DEPARTMENT, option: { by: "index", index: 7 } }))
    .toMatchObject({
      status: "failed",
      message: "No option matched index 7.",
      validation: { status: "failed", expected: "an option matching index 7 is selected" }
    });
  await expect(page.locator(DEPARTMENT)).toHaveValue(INITIAL_DEPARTMENT);
});

test("a target that is not a select changes nothing and says what the target is", async ({ openHarness, page }) => {
  const harness = await openStore(openHarness);
  const reply = await harness.runAction({ commandId: "select-non-select", actionType: "web.dom.select", selector: KEYWORDS, value: "home" });
  expect(reply).toMatchObject({
    status: "failed",
    message: "The target is not a select element.",
    validation: { status: "failed", expected: 'a select element to choose value "home" in', actual: "the target is a <input>" },
    failure: { category: "output_not_observed" }
  });
  await expect(page.locator(KEYWORDS)).toHaveValue("");
  await expect(page.locator(DEPARTMENT)).toHaveValue(INITIAL_DEPARTMENT);
});

test("a command naming no option at all reports the gap rather than selecting something", async ({ openHarness, page }) => {
  const harness = await openStore(openHarness);
  const reply = await harness.runAction({ commandId: "select-nothing", actionType: "web.dom.select", selector: DEPARTMENT });
  expect(reply).toMatchObject({
    status: "failed",
    message: "No option was named.",
    validation: { status: "failed", expected: "an option named by value, label, or index", actual: "the command named none" }
  });
  await expect(page.locator(DEPARTMENT)).toHaveValue(INITIAL_DEPARTMENT);
});

test("a disabled select is rejected with a code, not reported as a selection nobody observed", async ({ openHarness, page }) => {
  const harness = await openStore(openHarness);
  await page.locator(DEPARTMENT).evaluate((element) => { (element as HTMLSelectElement).disabled = true; });
  const reply = await harness.runAction({ commandId: "select-disabled", actionType: "web.dom.select", selector: DEPARTMENT, value: "home" });
  expect(reply).toMatchObject({
    status: "failed",
    message: "Action rejected: the element is disabled",
    validation: { status: "failed", expected: "a target that can be selected in", actual: "the element is disabled" },
    // Every refusal carries the closed set's one code, so the reason it was
    // refused rides in the record's `actual` as "<reason>: <what was observed>".
    failure: {
      category: "unexpected_state", code: "web.target.not_actionable", retryable: false, stage: "execution",
      expected: "a target that can be selected in", actual: "disabled: the element is disabled"
    }
  });
  await expect(page.locator(DEPARTMENT)).toHaveValue(INITIAL_DEPARTMENT);
});

test("a hidden select is rejected as hidden, so the reason is the capability's own rather than a guess", async ({ openHarness, page }) => {
  const harness = await openStore(openHarness);
  await page.locator(DEPARTMENT).evaluate((element) => { (element as HTMLElement).style.display = "none"; });
  const reply = await harness.runAction({ commandId: "select-hidden", actionType: "web.dom.select", selector: DEPARTMENT, value: "home" });
  expect(reply).toMatchObject({
    status: "failed",
    message: "Action rejected: the element's display is none",
    validation: { status: "failed", expected: "a target that can be selected in" },
    failure: {
      // Not shown is Core's `target_not_found` (t193-1002m), so a Flow run routes by state.
      category: "target_not_found", code: "web.target.not_shown", retryable: true,
      expected: "a target that can be selected in"
    }
  });
  // The reason heads both texts; the defence's account follows, because a hidden
  // target is an obstruction the runtime tries to clear before it reports.
  expect(reply.validation).toMatchObject({ actual: expect.stringMatching(/^the element's display is none;/u) });
  expect(reply.failure).toMatchObject({ actual: expect.stringMatching(/^hidden: the element's display is none;/u) });
  await expect(page.locator(DEPARTMENT)).toHaveValue(INITIAL_DEPARTMENT);
});

test("a disabled option cannot be selected, while an enabled one in the same select still can", async ({ openHarness, page }) => {
  const harness = await openStore(openHarness);
  await page.locator(DEPARTMENT).evaluate((element) => {
    const option = element.querySelector('option[value="home"]');
    if (option instanceof HTMLOptionElement) option.disabled = true;
  });
  const reply = await harness.runAction({ commandId: "select-disabled-option", actionType: "web.dom.select", selector: DEPARTMENT, option: { by: "label", label: "Home & Kitchen" } });
  expect(reply).toMatchObject({
    status: "failed",
    message: 'Action rejected: the option "home" (Home & Kitchen) is disabled',
    validation: { status: "failed", expected: 'a selectable option matching label "Home & Kitchen"', actual: 'the option "home" (Home & Kitchen) is disabled' },
    failure: {
      category: "unexpected_state", code: "web.target.not_actionable", retryable: false, stage: "execution",
      expected: 'a selectable option matching label "Home & Kitchen"', actual: 'disabled: the option "home" (Home & Kitchen) is disabled'
    }
  });
  await expect(page.locator(DEPARTMENT)).toHaveValue(INITIAL_DEPARTMENT);
  // The control: only the disabled option was refused, not the select itself.
  expect(await harness.runAction({ commandId: "select-enabled-option", actionType: "web.dom.select", selector: DEPARTMENT, value: "grocery" }))
    .toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  await expect(page.locator(DEPARTMENT)).toHaveValue("grocery");
});

// The select verb against a real `<select>`: by value, by label, and by index,
// what the page observes when an option is chosen, and the three requests that
// must change nothing -- an option the select does not have, a target that is
// not a select, and a command that names no option at all.
//
// Every row checks the page as well as the reply, because the point of Phase
// 1.2's validation is that a reply cannot claim more than the page did: a
// missing option is `failed` with Core's `output_not_observed` and the select
// still holds what it held before. The Scenario Lab's own state is the oracle
// for the one row that submits the form, so the selection is proven to have
// reached the page's `FormData`, not only its DOM.

import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";

const NAME = '[data-testid="name"]';
const PLAN = '[data-testid="plan"]';
const SUBMIT = '[data-testid="submit"]';
const RESULT = '[data-testid="result"]';

/** basic-form's select renders no `selected` attribute, so the browser starts it on the first option. */
const INITIAL_PLAN = "starter";

/** Records the `input` and `change` events reaching the select from now on, and whether each was trusted. */
async function watchSelectEvents(page: Page): Promise<() => Promise<string[]>> {
  await page.locator(PLAN).evaluate((element) => {
    const seen: string[] = [];
    (window as unknown as { __harnessSeenEvents: string[] }).__harnessSeenEvents = seen;
    for (const type of ["input", "change"]) {
      element.addEventListener(type, (event) => seen.push(`${event.type}:${event.isTrusted ? "trusted" : "untrusted"}`));
    }
  });
  return () => page.evaluate(() => (window as unknown as { __harnessSeenEvents: string[] }).__harnessSeenEvents);
}

test("by value: selects the option and validates the value the select ended up holding", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction({ commandId: "select-value", actionType: "web.dom.select", selector: PLAN, option: { by: "value", value: "team" } });
  expect(reply).toMatchObject({
    status: "succeeded",
    message: "Option selected.",
    validation: { status: "passed", expected: 'selected value "team" (value "team")', actual: 'selected value "team"' },
    element: { selector: PLAN, selectedValue: "team" }
  });
  expect(reply.failure).toBeUndefined();
  await expect(page.locator(PLAN)).toHaveValue("team");
});

test("by value: the legacy `value` field still names the option, as a recorded change sends it", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction({ commandId: "select-legacy", actionType: "web.dom.select", selector: PLAN, value: "enterprise" });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: 'selected value "enterprise"' } });
  await expect(page.locator(PLAN)).toHaveValue("enterprise");
});

test("by label: matches the option's visible text, not its value", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction({ commandId: "select-label", actionType: "web.dom.select", selector: PLAN, option: { by: "label", label: "Team" } });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: 'selected value "team" (label "Team")', actual: 'selected value "team"' }
  });
  await expect(page.locator(PLAN)).toHaveValue("team");
});

test("by index: chooses the option at that position", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction({ commandId: "select-index", actionType: "web.dom.select", selector: PLAN, option: { by: "index", index: 2 } });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: 'selected value "enterprise" (index 2)', actual: 'selected value "enterprise"' }
  });
  await expect(page.locator(PLAN)).toHaveValue("enterprise");
});

test("the page observes the selection: untrusted input and change, and the form submits the chosen plan", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const seen = await watchSelectEvents(page);
  await harness.runAction({ commandId: "fill-name", actionType: "web.dom.type", selector: NAME, text: "Ada" });
  expect(await harness.runAction({ commandId: "choose-plan", actionType: "web.dom.select", selector: PLAN, option: { by: "label", label: "Enterprise" } }))
    .toMatchObject({ status: "succeeded" });
  expect(await seen()).toEqual(["input:untrusted", "change:untrusted"]);
  await harness.runAction({ commandId: "submit", actionType: "web.dom.click", selector: SUBMIT });
  await expect(page.locator(RESULT)).toHaveText("Submitted");
  expect((await harness.finalState()).state).toMatchObject({ submitted: true, values: { name: "Ada", plan: "enterprise" } });
});

test("a value with no option changes nothing and reports output_not_observed", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction({ commandId: "select-missing-value", actionType: "web.dom.select", selector: PLAN, value: "platinum" });
  expect(reply).toMatchObject({
    status: "failed",
    message: 'No option matched value "platinum".',
    validation: {
      status: "failed",
      expected: 'an option matching value "platinum" is selected',
      actual: 'no option matched; the select still holds "starter" and offers "starter" (Starter), "team" (Team), "enterprise" (Enterprise)'
    },
    failure: { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true, stage: "verification" }
  });
  await expect(page.locator(PLAN)).toHaveValue(INITIAL_PLAN);
});

test("a label with no option, and an index past the end, each change nothing", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  expect(await harness.runAction({ commandId: "select-missing-label", actionType: "web.dom.select", selector: PLAN, option: { by: "label", label: "Platinum" } }))
    .toMatchObject({
      status: "failed",
      message: 'No option matched label "Platinum".',
      failure: { category: "output_not_observed" }
    });
  expect(await harness.runAction({ commandId: "select-missing-index", actionType: "web.dom.select", selector: PLAN, option: { by: "index", index: 7 } }))
    .toMatchObject({
      status: "failed",
      message: "No option matched index 7.",
      validation: { status: "failed", expected: "an option matching index 7 is selected" }
    });
  await expect(page.locator(PLAN)).toHaveValue(INITIAL_PLAN);
});

test("a target that is not a select changes nothing and says what the target is", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction({ commandId: "select-non-select", actionType: "web.dom.select", selector: NAME, value: "team" });
  expect(reply).toMatchObject({
    status: "failed",
    message: "The target is not a select element.",
    validation: { status: "failed", expected: 'a select element to choose value "team" in', actual: "the target is a <input>" },
    failure: { category: "output_not_observed" }
  });
  await expect(page.locator(NAME)).toHaveValue("");
  await expect(page.locator(PLAN)).toHaveValue(INITIAL_PLAN);
});

test("a command naming no option at all reports the gap rather than selecting something", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction({ commandId: "select-nothing", actionType: "web.dom.select", selector: PLAN });
  expect(reply).toMatchObject({
    status: "failed",
    message: "No option was named.",
    validation: { status: "failed", expected: "an option named by value, label, or index", actual: "the command named none" }
  });
  await expect(page.locator(PLAN)).toHaveValue(INITIAL_PLAN);
});

test("a disabled select is rejected with a code, not reported as a selection nobody observed", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.locator(PLAN).evaluate((element) => { (element as HTMLSelectElement).disabled = true; });
  const reply = await harness.runAction({ commandId: "select-disabled", actionType: "web.dom.select", selector: PLAN, value: "team" });
  expect(reply).toMatchObject({
    status: "failed",
    message: "Action rejected: the element is disabled",
    validation: { status: "failed", expected: "a target that can be selected in", actual: "the element is disabled" },
    failure: { category: "blocked_by_capability_or_policy", code: "web.action.disabled", retryable: false, stage: "execution" }
  });
  await expect(page.locator(PLAN)).toHaveValue(INITIAL_PLAN);
});

test("a hidden select is rejected as hidden, so the code is the capability's own rather than a guess", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.locator(PLAN).evaluate((element) => { (element as HTMLElement).style.display = "none"; });
  const reply = await harness.runAction({ commandId: "select-hidden", actionType: "web.dom.select", selector: PLAN, value: "team" });
  expect(reply).toMatchObject({
    status: "failed",
    message: "Action rejected: the element's display is none",
    validation: { status: "failed", expected: "a target that can be selected in", actual: "the element's display is none" },
    failure: { category: "blocked_by_capability_or_policy", code: "web.action.hidden", retryable: false }
  });
  await expect(page.locator(PLAN)).toHaveValue(INITIAL_PLAN);
});

test("a disabled option cannot be selected, while an enabled one in the same select still can", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.locator(PLAN).evaluate((element) => {
    const option = element.querySelector('option[value="team"]');
    if (option instanceof HTMLOptionElement) option.disabled = true;
  });
  const reply = await harness.runAction({ commandId: "select-disabled-option", actionType: "web.dom.select", selector: PLAN, option: { by: "label", label: "Team" } });
  expect(reply).toMatchObject({
    status: "failed",
    message: 'Action rejected: the option "team" (Team) is disabled',
    validation: { status: "failed", expected: 'a selectable option matching label "Team"', actual: 'the option "team" (Team) is disabled' },
    failure: { category: "blocked_by_capability_or_policy", code: "web.action.disabled", retryable: false, stage: "execution" }
  });
  await expect(page.locator(PLAN)).toHaveValue(INITIAL_PLAN);
  // The control: only the disabled option was refused, not the select itself.
  expect(await harness.runAction({ commandId: "select-enabled-option", actionType: "web.dom.select", selector: PLAN, value: "enterprise" }))
    .toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  await expect(page.locator(PLAN)).toHaveValue("enterprise");
});

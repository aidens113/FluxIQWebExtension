// Trusted-input emulation (decision D5), proven against live pages: the type,
// clear and keypress verbs and the keyboard capability behind them.
//
// These behaviours cannot be proven anywhere but in a real browser. The whole
// point of the emulation is that a synthetic `KeyboardEvent` has
// `isTrusted: false` and therefore triggers no default action, so what is under
// test is precisely what a DOM stub would fake: whether an untrusted Enter
// submits a form and reports the form's default button as the submitter,
// whether an untrusted keystroke drives a combobox that filters on `input`,
// and whether focus really moves on Tab.
//
// `keyboard-forms` is the fixture built for D5 (corpus rows W02 and W03). No
// handler in it reads `isTrusted`, as real widgets do not.

import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";

const NAME = '[data-testid="name"]';
const NOTES = '[data-testid="notes"]';
const PLAN = '[data-testid="plan"]';
const EDITABLE = '[data-testid="editable"]';
const RESULT = '[data-testid="result"]';

const DISPLAY_NAME = '[data-testid="display-name"]';
const COUNTRY = '[data-testid="country"]';
const LISTBOX = '[data-testid="country-listbox"]';
const PROFILE_STATUS = '[data-testid="profile-status"]';
const COUNTRY_STATUS = '[data-testid="country-status"]';
const CONTACT_EMAIL = '[data-testid="contact-email"]';

/** Records the key and edit events reaching `selector`, each with the detail that identifies it. */
async function watchKeyboard(page: Page, selector: string): Promise<() => Promise<string[]>> {
  await page.locator(selector).evaluate((element) => {
    const seen: string[] = [];
    (window as unknown as { __keyboardSeen: string[] }).__keyboardSeen = seen;
    for (const type of ["keydown", "beforeinput", "input", "keyup", "change"]) {
      element.addEventListener(type, (event) => {
        const key = event instanceof KeyboardEvent ? `:${event.key}` : "";
        const inputType = event instanceof InputEvent ? `:${event.inputType}` : "";
        seen.push(`${event.type}${key}${inputType}`);
      });
    }
  });
  return () => page.evaluate(() => (window as unknown as { __keyboardSeen: string[] }).__keyboardSeen);
}

test("type: every character is a keydown, beforeinput, input and keyup, and the field commits with change", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const seen = await watchKeyboard(page, NAME);
  const reply = await harness.runAction({ commandId: "type-ab", actionType: "web.dom.type", selector: NAME, text: "Ab" });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" }, message: "Text entered." });
  expect(await seen()).toEqual([
    "keydown:A", "beforeinput:insertText", "input:insertText", "keyup:A",
    "keydown:b", "beforeinput:insertText", "input:insertText", "keyup:b",
    "change"
  ]);
  await expect(page.locator(NAME)).toHaveValue("Ab");
});

test("type: replaces what the field already holds, and the read-back proves it", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.locator(NOTES).fill("draft");
  const reply = await harness.runAction({ commandId: "type-replace", actionType: "web.dom.type", selector: NOTES, text: "final" });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: 'the field holds "final"', actual: 'the field holds "final"' }
  });
  await expect(page.locator(NOTES)).toHaveValue("final");
});

test("type: a read-only field takes no text and reports output_not_observed", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.locator(NOTES).evaluate((element) => { (element as HTMLTextAreaElement).readOnly = true; });
  const seen = await watchKeyboard(page, NOTES);
  const reply = await harness.runAction({ commandId: "type-readonly", actionType: "web.dom.type", selector: NOTES, text: "blocked" });
  expect(reply).toMatchObject({
    status: "failed",
    validation: { status: "failed", expected: 'the field holds "blocked"', actual: 'the field holds ""' },
    message: "The field did not keep the text.",
    failure: { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true }
  });
  await expect(page.locator(NOTES)).toHaveValue("");
  // The keys reach a read-only field, as they do for a real user; no edit follows them.
  expect((await seen()).filter((entry) => entry.startsWith("input") || entry.startsWith("beforeinput"))).toEqual([]);
});

test("type: a contenteditable host is edited through InputEvent rather than a value setter", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.contentEditable = "true";
    host.dataset.testid = "editable";
    document.querySelector("main")?.append(host);
  });
  const seen = await watchKeyboard(page, EDITABLE);
  const reply = await harness.runAction({ commandId: "type-editable", actionType: "web.dom.type", selector: EDITABLE, text: "Ada" });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: 'the field holds "Ada"' } });
  await expect(page.locator(EDITABLE)).toHaveText("Ada");
  // An editable host has no value to commit, so it gets the edits without a trailing change.
  expect((await seen()).filter((entry) => entry.startsWith("input") || entry === "change"))
    .toEqual(["input:insertText", "input:insertText", "input:insertText"]);
});

test("clear: empties the field and proves it stayed empty", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.locator(NOTES).fill("draft");
  const reply = await harness.runAction({ commandId: "clear-notes", actionType: "web.dom.clear", selector: NOTES });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: "the field is empty", actual: "the field is empty" },
    message: "Field cleared."
  });
  await expect(page.locator(NOTES)).toHaveValue("");
});

test("keypress: Tab moves focus along the tabbable order", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction({ commandId: "tab", actionType: "web.dom.keypress", selector: NAME, key: "Tab" });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: "focus moves to the next tabbable element", actual: 'focus moved to [data-testid="plan"]' }
  });
  await expect(page.locator(PLAN)).toBeFocused();
});

test("keypress: modifiers reach the page, and a modified character types nothing", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.locator(NAME).evaluate((element) => {
    const seen: string[] = [];
    (window as unknown as { __modifiers: string[] }).__modifiers = seen;
    element.addEventListener("keydown", (event) => {
      const key = event as KeyboardEvent;
      seen.push(`${key.key}:ctrl=${key.ctrlKey}:shift=${key.shiftKey}:alt=${key.altKey}:meta=${key.metaKey}:${key.code}:${key.keyCode}`);
    });
  });
  const reply = await harness.runAction({
    commandId: "shortcut", actionType: "web.dom.keypress", selector: NAME, key: "a", modifiers: { ctrl: true, shift: true }
  });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  expect(await page.evaluate(() => (window as unknown as { __modifiers: string[] }).__modifiers))
    .toEqual(["a:ctrl=true:shift=true:alt=false:meta=false:KeyA:65"]);
  // Ctrl+A is a shortcut, not text: the character is not inserted.
  await expect(page.locator(NAME)).toHaveValue("");
});

test("W02: Enter on the display name submits the form and reports its default button as the submitter", async ({ openHarness, page }) => {
  const harness = await openHarness("keyboard-forms");
  const typed = await harness.runAction({ commandId: "w02-type", actionType: "web.dom.type", selector: DISPLAY_NAME, text: "Ada Lovelace" });
  expect(typed).toMatchObject({ status: "succeeded", validation: { status: "passed" } });

  const pressed = await harness.runAction({ commandId: "w02-enter", actionType: "web.dom.keypress", selector: DISPLAY_NAME, key: "Enter" });
  expect(pressed).toMatchObject({
    status: "succeeded",
    message: "Key pressed.",
    validation: {
      status: "passed",
      expected: 'Enter submits the form [data-testid="settings-form"]',
      actual: 'the form [data-testid="settings-form"] fired a submit event with [data-testid="save-profile"] as the submitter'
    }
  });
  await expect(page.locator(PROFILE_STATUS)).toHaveText("Saved: Ada Lovelace");
  // lastSubmitter is the D5 evidence: `requestSubmit()` with no argument reports null, a trusted Enter reports the button.
  expect((await harness.finalState()).state).toMatchObject({
    profile: { displayName: "Ada Lovelace", outcome: "saved", submissionCount: 1, lastSubmitter: "save-profile" }
  });
});

test("W03: typing opens and filters the combobox per keystroke, and Enter chooses without submitting", async ({ openHarness, page }) => {
  const harness = await openHarness("keyboard-forms");
  const typed = await harness.runAction({ commandId: "w03-type", actionType: "web.dom.type", selector: COUNTRY, text: "Ne" });
  expect(typed).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: 'the field holds "Ne"' } });
  // The listbox opens on keydown and filters on input, so both had to happen per character.
  await expect(page.locator(LISTBOX)).toBeVisible();
  await expect(page.getByRole("option")).toHaveText(["Nepal", "Netherlands", "New Zealand"]);

  const first = await harness.runAction({ commandId: "w03-down-1", actionType: "web.dom.keypress", selector: COUNTRY, key: "ArrowDown" });
  expect(first).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", actual: "the page handled ArrowDown and cancelled its default action" }
  });
  await expect(page.locator(COUNTRY)).toHaveAttribute("aria-activedescendant", "country-option-np");
  await harness.runAction({ commandId: "w03-down-2", actionType: "web.dom.keypress", selector: COUNTRY, key: "ArrowDown" });
  await expect(page.locator(COUNTRY)).toHaveAttribute("aria-activedescendant", "country-option-nl");

  const chosen = await harness.runAction({ commandId: "w03-enter", actionType: "web.dom.keypress", selector: COUNTRY, key: "Enter" });
  expect(chosen).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", actual: "the page handled Enter and cancelled its default action" }
  });
  await expect(page.locator(COUNTRY_STATUS)).toHaveText("Country: Netherlands");
  await expect(page.locator(COUNTRY)).toHaveValue("Netherlands");
  // The combobox is inside the profile form: an Enter the page cancels must not submit it.
  await expect(page.locator(PROFILE_STATUS)).toHaveText("Not saved");
  expect((await harness.finalState()).state).toMatchObject({ profile: { submissionCount: 0 }, preferences: { country: "NL" } });
});

test("keypress: a radio group's arrow keys are reported unsupported rather than faked", async ({ openHarness, page }) => {
  const harness = await openHarness("keyboard-forms");
  const reply = await harness.runAction({ commandId: "radio-arrow", actionType: "web.dom.keypress", selector: CONTACT_EMAIL, key: "ArrowDown" });
  expect(reply).toMatchObject({
    status: "failed",
    validation: { status: "failed", expected: "ArrowDown performs its default action on this target" },
    failure: { category: "blocked_by_capability_or_policy", code: "web.action.rejected", retryable: false }
  });
  expect(reply.validation).toMatchObject({ actual: expect.stringContaining("use web.dom.check instead") });
  // One code for every refusal, so the reason is what the record has to carry.
  expect(reply.failure).toMatchObject({
    actual: "unsupported_key: moving a radio group's selection needs a trusted key event; the key was delivered but nothing changed -- use web.dom.check instead"
  });
  // Nothing was faked: the group still holds its original selection.
  await expect(page.locator(CONTACT_EMAIL)).toBeChecked();
  expect((await harness.finalState()).state).toMatchObject({ preferences: { contactMethod: "email" } });
});

test("type: a disabled field is rejected with a code, and not one key reaches it", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.locator(NAME).evaluate((element) => { (element as HTMLInputElement).disabled = true; });
  const seen = await watchKeyboard(page, NAME);
  const reply = await harness.runAction({ commandId: "type-disabled", actionType: "web.dom.type", selector: NAME, text: "Ada" });
  expect(reply).toMatchObject({
    status: "failed",
    message: "Action rejected: the element is disabled",
    validation: { status: "failed", expected: "a target that can be typed into", actual: "the element is disabled" },
    failure: {
      category: "blocked_by_capability_or_policy", code: "web.action.rejected", retryable: false, stage: "execution",
      expected: "a target that can be typed into", actual: "disabled: the element is disabled"
    }
  });
  // The refusal is real, and it is a refusal rather than the `output_not_observed`
  // an ungated verb would report after typing into a field that took nothing.
  expect(await seen()).toEqual([]);
  await expect(page.locator(NAME)).toHaveValue("");
});

test("clear: a disabled field is rejected, and keeps the value it held", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.locator(NOTES).fill("draft");
  await page.locator(NOTES).evaluate((element) => { (element as HTMLTextAreaElement).disabled = true; });
  const reply = await harness.runAction({ commandId: "clear-disabled", actionType: "web.dom.clear", selector: NOTES });
  expect(reply).toMatchObject({
    status: "failed",
    message: "Action rejected: the element is disabled",
    validation: { status: "failed", expected: "a target that can be cleared", actual: "the element is disabled" },
    failure: {
      category: "blocked_by_capability_or_policy", code: "web.action.rejected", retryable: false, stage: "execution",
      expected: "a target that can be cleared", actual: "disabled: the element is disabled"
    }
  });
  await expect(page.locator(NOTES)).toHaveValue("draft");
});

test("keypress: a disabled target is rejected, so Enter cannot submit a form the keyboard never reached", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.locator(NAME).fill("Ada");
  await page.locator(NAME).evaluate((element) => { (element as HTMLInputElement).disabled = true; });
  const seen = await watchKeyboard(page, NAME);
  const reply = await harness.runAction({ commandId: "enter-disabled", actionType: "web.dom.keypress", selector: NAME, key: "Enter" });
  expect(reply).toMatchObject({
    status: "failed",
    message: "Action rejected: the element is disabled",
    validation: { status: "failed", expected: "a target that can receive the key press", actual: "the element is disabled" },
    failure: {
      category: "blocked_by_capability_or_policy", code: "web.action.rejected", retryable: false, stage: "execution",
      expected: "a target that can receive the key press", actual: "disabled: the element is disabled"
    }
  });
  expect(await seen()).toEqual([]);
  await expect(page.locator(RESULT)).toHaveText("Not submitted");
  expect((await harness.finalState()).state).toMatchObject({ submitted: false, submissionCount: 0 });
});

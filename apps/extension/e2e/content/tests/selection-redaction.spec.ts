// The selection proof: `snapshot.selectedText` must never carry text that came
// from, or reached into, a control the shared sensitivity rule protects.
//
// This is a separate leak from the one `redaction.spec.ts` proves. Every path
// that file covers reads a control's value through `readElementValue`, which
// refuses a sensitive control. The page selection does not go through it at
// all: `dom-snapshot.ts` copied `window.getSelection().toString()` straight
// into the snapshot, and Chromium's selection includes the text of a focused
// ordinary `<input>`. A select-all inside the card field therefore put its
// value into every snapshot, and from there into durable web state
// (`domain/src/recording/web-state/snapshot.ts`) and the LLM evidence packet
// (`domain/src/runtime/llm-evidence/page-evidence.ts`).
//
// It stayed invisible because Chromium returns nothing for `type="password"`,
// so the password field -- the only sensitive control the fixture had before
// Wave 3 -- hid it. A browser quirk is not a control, which is why these rows
// use the card field.
//
// Both directions are pinned. Two rows require the selection to be withheld;
// two require an ordinary selection to survive, because a snapshot that lost
// every selection would pass the security rows while destroying the evidence
// item they are protecting.
//
// No secret is written here. The card value is read off the fixture, so it
// exists in exactly one place in the repository.

import { expect, test } from "../index.js";

const CARD = '[data-testid="payment"]';
const EMAIL = 'input[name="username"]';
const HEADING = "main h1";
const FORM = '[data-testid="sensitive-form"]';

/** The fixture's email, which is not sensitive: the control that proves the withholding is targeted. */
const FIXTURE_EMAIL = "synthetic-user@example.test";

const LOUD = { captureMutations: false, captureInputValues: true, captureSnapshots: true };

/**
 * Selects everything inside `selector`'s text control, the way a user's
 * Ctrl+A inside a field does. Done through the DOM rather than the keyboard so
 * the row states exactly what it selected.
 */
async function selectAllInField(page: import("@playwright/test").Page, selector: string): Promise<void> {
  await page.locator(selector).focus();
  await page.evaluate((target) => {
    const field = document.querySelector(target);
    if (!(field instanceof HTMLInputElement)) throw new Error(`${target} is not an input`);
    field.setSelectionRange(0, field.value.length);
  }, selector);
}

test("a select-all inside the card field never reaches the snapshot", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  const prefilled = await page.locator(CARD).inputValue();
  expect(prefilled.length, "the card field has no value to leak").toBeGreaterThan(0);

  await selectAllInField(page, CARD);
  const snapshot = await harness.capture();

  expect(snapshot.selectedText, "the selection came out of a sensitive control and must be withheld").toBeUndefined();
  expect(JSON.stringify(snapshot)).not.toContain(prefilled);
});

test("a select-all inside the card field never reaches a recorded snapshot either", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  const prefilled = await page.locator(CARD).inputValue();

  await harness.setRecording(true, LOUD);
  await selectAllInField(page, CARD);
  // A bare modifier is the one interaction that makes the recorder attach a
  // snapshot (`content/snapshots.ts` attaches one to `dom.keydown`) without
  // disturbing the selection that is being tested.
  await page.keyboard.press("Shift");
  await harness.setRecording(false);

  const recorded = await harness.recordedEvents("dom.keydown");
  // Without this the row could pass by recording nothing at all.
  expect(recorded.some((event) => event.snapshot !== undefined), "no recorded event carried a snapshot").toBe(true);
  expect(JSON.stringify(await harness.messages())).not.toContain(prefilled);
});

test("a selection that touches no sensitive control still reaches the snapshot", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  await page.evaluate((target) => {
    const heading = document.querySelector(target);
    if (!heading) throw new Error(`${target} is missing`);
    window.getSelection()?.selectAllChildren(heading);
  }, HEADING);

  const snapshot = await harness.capture();
  expect(snapshot.selectedText, "an ordinary page selection is evidence and must survive").toContain("Synthetic sensitive input");
});

test("a select-all inside an ordinary field still reaches the snapshot", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  await selectAllInField(page, EMAIL);

  const snapshot = await harness.capture();
  expect(snapshot.selectedText).toContain(FIXTURE_EMAIL);
});

test("a selection that starts outside the form and runs into the card field is withheld", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  const prefilled = await page.locator(CARD).inputValue();

  await page.evaluate(([heading, form]) => {
    const start = document.querySelector(heading);
    const end = document.querySelector(form);
    if (!start || !end) throw new Error("the fixture is missing the heading or the form");
    const range = document.createRange();
    range.setStartBefore(start);
    range.setEndAfter(end);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [HEADING, FORM] as const);

  const snapshot = await harness.capture();
  expect(snapshot.selectedText, "the selection reaches into a sensitive control and must be withheld").toBeUndefined();
  expect(JSON.stringify(snapshot)).not.toContain(prefilled);
});

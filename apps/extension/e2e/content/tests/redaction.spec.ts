// The redaction proof (Phase 1.4 step 1): a sensitive control must never yield
// a value on any path the content script owns -- the recorded event stream, the
// element descriptor, the state snapshot, an action result's evidence, and an
// action result's validation strings.
//
// The sensitivity rule is the one shared `isSensitiveFieldSignature`
// (src/shared/sensitive-field.ts), read through `isSensitiveFormControl`. These
// rows assert the invariant end to end on a live page rather than the rule in
// isolation, because the leak this fixes was never in the rule: it was in the
// producers that never asked it.
//
// Every assertion searches the whole wire form of what the content script sent,
// not one field, so a value that reappears somewhere unexpected -- an attribute,
// a snapshot, a validation string -- still fails the row.
//
// Redaction has to stay targeted, so most rows carry a control on the fixture's
// ordinary email field, and the last row pins the other direction outright: an
// action on a field that is not sensitive still quotes what was sent and what
// the field kept, because a validation that cannot say whether the value
// matched is worthless. For a sensitive field the same rows require the
// validation to say whether it matched -- in words, never by quoting it.
//
// The fixture's two sensitive controls are both covered: the password field,
// and the card field, which is sensitive because it carries
// `autocomplete="cc-number"` as a real one does. Until Wave 3 it carried
// neither that nor `data-sensitive`, so the shared rule could not see it and
// this scenario -- tagged `redaction` and `security` -- proved the opposite of
// what it was for.

import { expect, test } from "../index.js";

/** The fixture's own pre-filled password. Synthetic, and it must still never leave the page. */
const FIXTURE_PASSWORD = "SYNTHETIC_PASSWORD_DO_NOT_USE";
/** Typed during a row, so a value that only exists after the recorder started is covered too. */
const TYPED_PASSWORD = "synthetic-typed-secret";
/** Typed into the card field. Not a card number: nothing here needs to look like one. */
const TYPED_CARD = "synthetic-card-entry";
/** The fixture's email, which is not sensitive: it is the control that proves redaction is targeted. */
const FIXTURE_EMAIL = "synthetic-user@example.test";
/** Appended to the email by keyboard, so a captured value is visible in the wire form. */
const EMAIL_SUFFIX = "+control";
/** Typed into the email field by an action, to read back the validation strings an ordinary field still gets. */
const CONTROL_TEXT = "synthetic-control-text";

const PASSWORD = '[data-testid="password"]';
const CARD = '[data-testid="payment"]';
const EMAIL = 'input[name="username"]';

const LOUD = { captureMutations: false, captureInputValues: true, captureSnapshots: true };
const QUIET = { captureMutations: false, captureInputValues: true, captureSnapshots: false };
const NO_VALUES = { captureMutations: false, captureInputValues: false, captureSnapshots: false };

test("no password value reaches any recorded message, typed or pre-filled", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  await harness.setRecording(true, LOUD);

  await page.locator(PASSWORD).focus();
  await page.keyboard.press("Control+a");
  await page.keyboard.type(TYPED_PASSWORD);
  // The control: a field that is not sensitive is still captured in the same session.
  await page.locator(EMAIL).focus();
  await page.keyboard.press("End");
  await page.keyboard.type(EMAIL_SUFFIX);
  await page.locator("form button").click();
  await harness.setRecording(false);

  const wire = JSON.stringify(await harness.messages());
  expect(wire).not.toContain(FIXTURE_PASSWORD);
  expect(wire).not.toContain(TYPED_PASSWORD);
  expect(wire).toContain(`${FIXTURE_EMAIL}${EMAIL_SUFFIX}`);
});

test("a key pressed in a sensitive field is recorded as a press, never as the character", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  await harness.setRecording(true, QUIET);
  await page.locator(PASSWORD).focus();
  await page.keyboard.type("abc");
  await page.keyboard.press("Tab");
  await harness.setRecording(false);

  const presses = (await harness.recordedEvents("dom.keydown"))
    .filter((event) => event.element?.selector === PASSWORD);
  // Three characters and the Tab that left the field.
  expect(presses).toHaveLength(4);
  expect(presses.slice(0, 3).map((event) => event.key)).toEqual([undefined, undefined, undefined]);
  // A key that carries no content still travels, so the interaction stays visible.
  expect(presses[3]?.key).toBe("Tab");
});

test("the recorded input event for a sensitive field reports the change without the value", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  await harness.setRecording(true, QUIET);
  await page.locator(PASSWORD).focus();
  await page.keyboard.type(TYPED_PASSWORD);
  await harness.setRecording(false);

  const inputs = (await harness.recordedEvents("dom.input"))
    .filter((event) => event.element?.selector === PASSWORD);
  expect(inputs).toHaveLength(1);
  expect(inputs[0]?.inputValue).toBeUndefined();
  // Presence still travels: the recording knows a value was entered.
  expect(inputs[0]?.element?.hasValue).toBe(true);
  expect(inputs[0]?.element?.value).toBeUndefined();
});

test("a snapshot reports a sensitive field's presence and never its value", async ({ openHarness }) => {
  const harness = await openHarness("sensitive-input");
  const snapshot = await harness.capture();

  const password = snapshot.interactiveElements.find((element) => element.selector === PASSWORD);
  expect(password, "the password field is missing from the snapshot").toBeTruthy();
  expect(password?.value).toBeUndefined();
  expect(password?.hasValue).toBe(true);
  expect(password?.inputType).toBe("password");
  expect(JSON.stringify(snapshot)).not.toContain(FIXTURE_PASSWORD);

  // The control: the same snapshot carries the ordinary field's value.
  const email = snapshot.interactiveElements.find((element) => element.selector === EMAIL);
  expect(email?.value).toBe(FIXTURE_EMAIL);
});

test("an action result's evidence describes a sensitive field without its value", async ({ openHarness }) => {
  const harness = await openHarness("sensitive-input");
  const result = await harness.runAction({ commandId: "click-password", actionType: "web.dom.click", selector: PASSWORD });

  expect(result.status).toBe("succeeded");
  expect(JSON.stringify(result)).not.toContain(FIXTURE_PASSWORD);
  expect(result.element?.value).toBeUndefined();
  expect(result.element?.hasValue).toBe(true);
});

test("captureInputValues off withholds every value, sensitive or not", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  await harness.setRecording(true, NO_VALUES);
  await page.locator(EMAIL).focus();
  await page.keyboard.press("End");
  await page.keyboard.type(EMAIL_SUFFIX);
  await harness.setRecording(false);

  const inputs = (await harness.recordedEvents("dom.input"))
    .filter((event) => event.element?.selector === EMAIL);
  expect(inputs).toHaveLength(1);
  expect(inputs[0]?.inputValue).toBeUndefined();
  expect(inputs[0]?.element?.value).toBeUndefined();
  // Presence is not a value, so it is unaffected by the setting.
  expect(inputs[0]?.element?.hasValue).toBe(true);
});

test("web.dom.type withholds a sensitive field's text from its validation and still reports the match", async ({ openHarness }) => {
  const harness = await openHarness("sensitive-input");
  const result = await harness.runAction({ commandId: "type-password", actionType: "web.dom.type", selector: PASSWORD, text: TYPED_PASSWORD });

  expect(JSON.stringify(result)).not.toContain(TYPED_PASSWORD);
  expect(JSON.stringify(result)).not.toContain(FIXTURE_PASSWORD);
  // Useful without being quotable: the read-back still says the field kept what was sent.
  expect(result).toMatchObject({
    status: "succeeded",
    validation: {
      status: "passed",
      expected: expect.stringContaining("a withheld value of"),
      actual: expect.stringContaining("the text that was sent")
    }
  });
});

test("web.dom.clear withholds a sensitive field's value from its validation", async ({ openHarness }) => {
  const harness = await openHarness("sensitive-input");
  const result = await harness.runAction({ commandId: "clear-password", actionType: "web.dom.clear", selector: PASSWORD });

  expect(JSON.stringify(result)).not.toContain(FIXTURE_PASSWORD);
  // An empty field is not a secret, so the passing case reads exactly as it always did.
  expect(result).toMatchObject({ status: "succeeded", validation: { status: "passed", expected: "the field is empty", actual: "the field is empty" } });
});

test("the card field is sensitive by the shared rule, so no path carries its value", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  // Read the fixture's own card value from the page rather than restating it here.
  const prefilled = await page.locator(CARD).inputValue();
  expect(prefilled.length, "the card field has no value to redact").toBeGreaterThan(0);

  const snapshot = await harness.capture();
  const card = snapshot.interactiveElements.find((element) => element.selector === CARD);
  expect(card, "the card field is missing from the snapshot").toBeTruthy();
  expect(card?.value).toBeUndefined();
  expect(card?.hasValue).toBe(true);
  expect(JSON.stringify(snapshot)).not.toContain(prefilled);

  // Typed at the caret rather than over a select-all, deliberately. A
  // select-all inside a sensitive text field puts its value in the page
  // selection, and `dom-snapshot.ts` copies `window.getSelection()` into
  // `snapshot.selectedText` without asking whether the focused control is
  // sensitive -- a live leak this brief does not own the file to fix, recorded
  // in reports/w3-redaction-followup.md. Chromium returns nothing for a
  // password field, which is why the rows above never met it.
  await harness.setRecording(true, LOUD);
  await page.locator(CARD).focus();
  await page.keyboard.type(TYPED_CARD);
  await harness.setRecording(false);
  const wire = JSON.stringify(await harness.messages());
  expect(wire).not.toContain(prefilled);
  expect(wire).not.toContain(TYPED_CARD);

  const result = await harness.runAction({ commandId: "type-card", actionType: "web.dom.type", selector: CARD, text: TYPED_CARD });
  expect(JSON.stringify(result)).not.toContain(TYPED_CARD);
  expect(result).toMatchObject({ status: "succeeded", validation: { status: "passed", expected: expect.stringContaining("a withheld value of") } });
});

test("a field that is not sensitive keeps validation strings that quote what was sent and what it kept", async ({ openHarness }) => {
  const harness = await openHarness("sensitive-input");
  const result = await harness.runAction({ commandId: "type-email", actionType: "web.dom.type", selector: EMAIL, text: CONTROL_TEXT });

  expect(result).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: `the field holds "${CONTROL_TEXT}"`, actual: `the field holds "${CONTROL_TEXT}"` }
  });
});

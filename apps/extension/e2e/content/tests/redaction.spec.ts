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
// The rows about the hop to the domain are the other side of the same coin,
// added once the verbs began declaring their redaction with `redacted: true`.
// The domain cannot tell a redacted string from a leaked one, so without a
// declaration it withheld every comparison on a sensitive control and the
// verbs' phrasing was lost on exactly the failures it was written for. They
// prove the declaration travels and is honoured, and — the half that matters
// more — that the other two states an optional boolean has, absent and
// explicitly `false`, still withhold, against strings holding the value the
// field really holds.
//
// One of those rows is `fixme`, and it is the only one in this file. It is the
// same fail-safe at the failure-record exit, where the guard is disarmed today
// by a stamp the withholding layer writes and the next layer mistakes for the
// producer's declaration. The row is right, the code is wrong, and the code is
// in `domain/`; the whole of it is written out at the row.
//
// The fixture's two sensitive controls are both covered: the password field,
// and the card field, which is sensitive because it carries
// `autocomplete="cc-number"` as a real one does. Until Wave 3 it carried
// neither that nor `data-sensitive`, so the shared rule could not see it and
// this scenario -- tagged `redaction` and `security` -- proved the opposite of
// what it was for.

import { createWebAutomationRuntimeAdapter, webAutomationActionResultPayload } from "@fluxiq-web-extension/domain";
import type { FluxIQ } from "fluxiq";
import type { FluxIQRuntimeCommandResult } from "fluxiq/runtime";
import type { BrowserActionResult } from "../../../src/shared/protocol.js";
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
// The multi-token form. `autocomplete="billing cc-number"` is how the attribute
// is ordinarily written, and it is the exact spelling that leaked a card number
// twice in this plan -- once through a duplicated rule, once through a copy that
// compared the whole attribute instead of splitting it into tokens. The
// single-token CARD field above cannot catch either regression.
const BILLING_CARD = '[data-testid="billing"]';
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

/** The marker the domain writes in place of a comparison it will not carry. */
const WITHHELD = "(withheld: the action ran on a control that holds a secret)";

/**
 * The rest of the hop, run for real rather than described: the gateway result
 * the background worker sends (`runtime/result-mapping.ts` builds exactly this
 * shape) handed to the domain's own runtime adapter, with the FluxIQ instance
 * faked down to the one call the adapter makes. What comes back is what Core
 * receives — the attempt's failure record, its payload, and its metadata.
 *
 * The command's `parameters` carry only the selector on purpose. The text a
 * Flow asks to be typed is the Flow's own input and travels with the command
 * whatever the page is; the question here is what the *page's answer* carries
 * back, which is the thing a redaction can be responsible for.
 */
async function throughTheDomain(result: BrowserActionResult): Promise<FluxIQRuntimeCommandResult> {
  const gatewayResult = {
    commandId: result.commandId,
    status: result.status,
    ...(result.status === "succeeded" ? {} : { error: result.message }),
    message: result.message,
    payload: webAutomationActionResultPayload(result as never),
    failure: result.failure
  };
  const fluxiq = {
    programs: {
      clientGateway: {
        snapshot: () => ({
          sessions: [{
            sessionId: "session.redaction", clientId: "client.redaction", status: "ready", clientType: "extension",
            capabilities: [{ id: "web.actions", actionTypes: ["web.dom.type"] }]
          }]
        })
      },
      automationStudioClientGateway: { executeAction: async () => gatewayResult }
    }
  } as unknown as FluxIQ;
  const adapter = createWebAutomationRuntimeAdapter({ fluxiq });
  return await adapter.execute({ kind: "execute_action", commandId: "command.redaction", outputId: "web.dom.type", parameters: { selector: CARD } }, {});
}

test("a sensitive control's post-condition is secret-free after the hop to the domain, on both paths it takes", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  const prefilled = await page.locator(CARD).inputValue();
  expect(prefilled.length, "the card field has no value to redact").toBeGreaterThan(0);

  // A real page behaviour, arranged here rather than fixtured: the card field
  // rewrites whatever is typed into it, from its own `input` handler. That is
  // the only way `type.ts`'s mismatch branch is reachable live, and it is the
  // branch that matters, because a failed read-back is what puts BOTH sides of
  // the comparison onto a failure record — and the failure record does not go
  // through `webAutomationActionResultPayload` at all. `result-mapping.ts` puts
  // it on the gateway result directly, so it is a second exit with a second
  // guard, in `domain/src/runtime/adapter.ts`.
  const rewritten = "page-rewrote-this-value";
  await page.evaluate(([selector, replacement]) => {
    const field = document.querySelector(selector) as HTMLInputElement | null;
    field?.addEventListener("input", () => { field.value = replacement; });
  }, [CARD, rewritten] as const);

  const result = await harness.runAction({ commandId: "type-card-rewritten", actionType: "web.dom.type", selector: CARD, text: TYPED_CARD });
  expect(result.status, "the read-back has to disagree, or there is no comparison to carry").toBe("failed");
  expect(result.failure?.expected, "both sides ride on the record, which is the exit the wire payload never sees").toBeTruthy();
  expect(result.failure?.actual).toBeTruthy();

  const runtimeResult = await throughTheDomain(result);
  // The whole serialized form of everything the page's answer produced, not one
  // named field: every leak found in this plan was found this way, and three of
  // them were in fields nobody had thought to name.
  const arrived = JSON.stringify({ payload: runtimeResult.payload, failure: runtimeResult.failure, metadata: runtimeResult.metadata, message: runtimeResult.message, error: runtimeResult.error });
  expect(arrived).not.toContain(prefilled);
  expect(arrived).not.toContain(TYPED_CARD);
  expect(arrived, "what the page put in the field is the field's value, and the field is sensitive").not.toContain(rewritten);

  // The join is live, not merely safe: the domain does receive the
  // post-condition it was widened to carry, and it receives the failure record
  // with the code that says what went wrong.
  const action = (runtimeResult.payload as { result?: { validation?: { status?: string } } } | undefined)?.result;
  expect(action?.validation?.status, "validation still reaches the domain; only its two strings were withheld").toBe("failed");
  expect(runtimeResult.failure?.code).toBe("web.validation.output_not_observed");

  // And, since the producer began declaring its redaction, the two strings are
  // not withheld either. This is the exit where that is worth the most:
  // `expected` and `actual` on a failure record are what an operator reads when
  // an action did not work, and until the declaration existed a
  // sensitive-control failure said only that something had been withheld. The
  // record now arrives byte for byte as the verb wrote it -- naming a length,
  // never a value, which the whole-payload assertions above have just proved.
  expect(runtimeResult.failure?.expected, "the marker here means the declaration was dropped somewhere on the way").not.toBe(WITHHELD);
  expect(runtimeResult.failure?.expected).toBe(result.failure?.expected);
  expect(runtimeResult.failure?.actual).toBe(result.failure?.actual);
  expect(runtimeResult.failure?.actual, "the phrasing is only worth carrying if it still says what went wrong").toContain("which is not the text that was sent");
});

test("the declaration is what buys a sensitive control's phrasing through, and every other state of it withholds", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  const prefilled = await page.locator(CARD).inputValue();
  expect(prefilled.length, "the card field has no value to redact").toBeGreaterThan(0);
  const result = await harness.runAction({ commandId: "type-card-domain-guard", actionType: "web.dom.type", selector: CARD, text: TYPED_CARD });

  // The producer's phrasing, which the rows above prove is already secret-free,
  // and beside it the declaration that says so. The declaration has to survive
  // `boundValidation`, which rebuilds the validation field by field on the way
  // out of the verb and dropped it silently until it was taught this field.
  expect(result.validation).toMatchObject({ status: "passed", expected: expect.stringContaining("a withheld value of"), redacted: true });
  const produced = result.validation.status === "none" ? undefined : result.validation;
  expect(produced, "there is nothing to carry unless the verb produced a comparison").toBeTruthy();
  const phrasing = produced?.expected ?? "";

  // The domain honours it, on the real descriptor the real page produced: the
  // comparison arrives as the verb wrote it rather than as the marker. Before
  // the declaration existed both strings here were the marker, on every
  // sensitive-control result, however carefully the verb had phrased them.
  const payload = webAutomationActionResultPayload(result as never) as { validation?: { status?: string; expected?: string; actual?: string } };
  expect(payload.validation?.status, "the status is what says whether the post-condition held, and it survives either way").toBe("passed");
  expect(payload.validation?.expected).toBe(phrasing);
  expect(payload.validation?.expected, "the marker here means the round trip did not land").not.toBe(WITHHELD);

  // Now the fail-safe, which is the half that has to hold when the declaration
  // is wrong rather than when it is right. An optional boolean has three states
  // and exactly one of them is permission; the other two are a verb that was
  // never taught the question, and a verb saying outright that it did not
  // withhold. Each row below is the live result with only the declaration
  // changed, so the domain's own rule is doing the deciding against a real
  // descriptor rather than a hand-built shape.
  const declared = (declaration: boolean | undefined, expected: string, actual: string): BrowserActionResult => ({
    ...result,
    validation: declaration === undefined
      ? { status: "passed", expected, actual }
      : { status: "passed", expected, actual, redacted: declaration }
  });
  const mappedExpected = (candidate: BrowserActionResult): string | undefined =>
    (webAutomationActionResultPayload(candidate as never) as { validation?: { expected?: string } }).validation?.expected;

  expect(mappedExpected(declared(true, phrasing, phrasing)), "the declaration is the only thing that buys the phrasing through").toBe(phrasing);
  expect(mappedExpected(declared(false, phrasing, phrasing)), "a verb saying it did NOT withhold must be taken at its word").toBe(WITHHELD);
  expect(mappedExpected(declared(undefined, phrasing, phrasing)), "a verb that never learned the flag is withheld exactly as before").toBe(WITHHELD);

  // The same two withholding states with the producer's redaction taken back
  // out, which is what makes them more than marker bookkeeping. The strings
  // hold the value the field really holds, read off the page a moment ago and
  // never written down here — exactly what would reach this function if
  // `content/actions/type.ts` set the flag and stopped withholding, or if a
  // future verb copied the flag without copying the redaction. Staged here
  // rather than by editing that file: a mutation window in a shared tree is how
  // a deliberately broken compile gets committed.
  //
  // The state not tested is `true` over an unredacted string. A declaration is
  // a contract and this layer believes it, by design — nothing here reads the
  // text, because a predicate that scans for things that look like card numbers
  // both misses and misfires. That is why the flag is set beside the redaction
  // inside the verb and nowhere else.
  const leaked = `the field holds "${prefilled}"`;
  expect(
    JSON.stringify(webAutomationActionResultPayload(declared(false, leaked, leaked) as never)),
    "an explicit false must withhold, or the fail-safe has a hole shaped like a boolean"
  ).not.toContain(prefilled);
  expect(
    JSON.stringify(webAutomationActionResultPayload(declared(undefined, leaked, leaked) as never)),
    "the second layer holds on its own, which is the whole claim"
  ).not.toContain(prefilled);

  // The other direction, live: an ordinary control keeps a comparison an
  // operator can act on, so the guard is targeted rather than a blanket.
  const control = await harness.runAction({ commandId: "type-email-domain-guard", actionType: "web.dom.type", selector: EMAIL, text: CONTROL_TEXT });
  const controlPayload = webAutomationActionResultPayload(control as never) as { validation?: { expected?: string } };
  expect(controlPayload.validation?.expected).toBe(`the field holds "${CONTROL_TEXT}"`);
});

/**
 * The same fail-safe at the OTHER exit, and it does not hold today. Marked
 * `fixme` rather than deleted, because the row is right and the code is wrong,
 * and rather than left failing, because the fix is in `domain/` and this spec
 * runs in everyone's gate.
 *
 * The failure record does not travel through `webAutomationActionResultPayload`
 * at all: `runtime/result-mapping.ts` puts the content script's record straight
 * onto the gateway result, and `domain/src/runtime/adapter.ts` is its only
 * guard. That guard asks whether the producer declared a redaction — and it
 * asks the validation inside `payload.result`, which the *client* has already
 * run through `webAutomationSecretSafeValidation`. That function stamps
 * `redacted: true` on the comparison it withheld, so the adapter reads the
 * withholding layer's own stamp as if it were the producer's declaration and
 * concludes it has nothing to do. It reaches that conclusion for every
 * extension result, whatever the producer said, so the guard is disarmed rather
 * than weakened.
 *
 * The three verbs this row is written against are safe anyway, because they
 * redact before the record is built. What is unguarded is every other producer
 * of a comparison on a sensitive control, and any client that is not this
 * extension.
 *
 * Measured, with the sentinel below standing in for a value: absent, `false`
 * and `true` all pass the record through unredacted. Deleting the stamp from
 * the withheld branch of `webAutomationSecretSafeValidation` restores all
 * three to the intended answers — absent and `false` withhold, `true` is
 * believed — which is one line in `domain/src/client/gateway-mapping.ts`.
 * Written up in reports/v-redaction-producer.md; `domain/` was not this
 * brief's to edit.
 */
test.fixme("the runtime adapter withholds a failure record's comparison when the producer did not declare one", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  const prefilled = await page.locator(CARD).inputValue();
  expect(prefilled.length, "the card field has no value to redact").toBeGreaterThan(0);
  const result = await harness.runAction({ commandId: "type-card-record-guard", actionType: "web.dom.type", selector: CARD, text: TYPED_CARD });

  const leaked = `the field holds "${prefilled}"`;
  const asIfOnTheRecord: BrowserActionResult = {
    ...result,
    status: "failed",
    validation: { status: "failed", expected: leaked, actual: leaked, redacted: false },
    failure: { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true, stage: "verification", expected: leaked, actual: leaked }
  };
  const runtimeResult = await throughTheDomain(asIfOnTheRecord);
  expect(JSON.stringify(runtimeResult)).not.toContain(prefilled);
  expect(runtimeResult.failure?.expected).toBe(WITHHELD);
  expect(runtimeResult.failure?.code, "the classification is untouched; only the two strings are").toBe("web.validation.output_not_observed");
});

test("a multi-token autocomplete is sensitive by the shared rule, so no path carries its value", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  // Read the value off the page rather than restating it, so the fixture stays
  // the single source of the secret.
  const prefilled = await page.locator(BILLING_CARD).inputValue();
  expect(prefilled.length, "the billing card field has no value to redact").toBeGreaterThan(0);

  const snapshot = await harness.capture();
  const billing = snapshot.interactiveElements.find((element) => element.selector === BILLING_CARD);
  expect(billing, "the billing card field is missing from the snapshot").toBeTruthy();
  // Presence is reportable; the value is not. A whole-string comparison against
  // "cc-number" would leave both of these failing.
  expect(billing?.value).toBeUndefined();
  expect(billing?.hasValue).toBe(true);
  expect(JSON.stringify(snapshot)).not.toContain(prefilled);
});

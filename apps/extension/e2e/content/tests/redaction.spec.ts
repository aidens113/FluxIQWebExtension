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
// The pages are bigbox-retail's checkout, the one realistic site with both
// kinds of secret a shopper types (t730):
// - the sign-in wall, whose "Password" field is `type="password"` and whose
//   "Email address" field (`autocomplete="username"`) is the ordinary control
//   beside it;
// - guest checkout, whose card form is the payment provider's cross-origin
//   frame "Secure card entry". Its "Card number" field is sensitive because it
//   carries `autocomplete="cc-number"`, as a real one does. The guest contact
//   "Email address" on the page around it is the ordinary control.
// The site pre-fills nothing, so a "pre-filled" value is one written into the
// field before the recorder started, and every value is synthetic.
//
// The harness answers through the top frame only, so the card rows talk to the
// frame's own content script, as the background worker addresses a frame by
// its id (frames.spec.ts does the same).
//
// Redaction has to stay targeted, so most rows carry a control on an ordinary
// email field, and one row pins the other direction outright: an action on a
// field that is not sensitive still quotes what was sent and what the field
// kept, because a validation that cannot say whether the value matched is
// worthless. For a sensitive field the same rows require the validation to say
// whether it matched -- in words, never by quoting it.
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
// The last of those rows is the same fail-safe at the failure-record exit, run
// through a client that stamps its withheld comparison `redacted: true` as well
// as through this one, because that stamp once disarmed the adapter's guard.
//
// A multi-token autocomplete (`billing cc-number`) has no field on any realistic
// site. `isSensitiveFormControl` hands the raw attribute to the shared rule
// (`content/element-traits.ts`), whose token split is proved in
// `src/shared/tests/sensitive-field.test.ts` ("every autocomplete token is
// checked, not only the whole value"); the DOM read itself is the card rows'.

import type { Frame, Page } from "@playwright/test";
import { createWebAutomationRuntimeAdapter, webAutomationActionResultPayload } from "@fluxiq-web-extension/domain";
import type { FluxIQ } from "fluxiq";
import type { FluxIQRuntimeCommandResult } from "fluxiq/runtime";
import type { BrowserActionCommand, BrowserActionResult, DomSnapshot, RecordingEventPayload } from "../../../src/shared/protocol.js";
import { expect, test, type ContentHarness, type HarnessDelivery, type HarnessRecordingSettings, type SentMessage } from "../index.js";

/** Written into the password field before the recorder starts. Synthetic, and it must still never leave the page. */
const PREFILLED_PASSWORD = "SYNTHETIC_PASSWORD_DO_NOT_USE";
/** Typed during a row, so a value that only exists after the recorder started is covered too. */
const TYPED_PASSWORD = "synthetic-typed-secret";
/** The card a shopper already entered: the public test number, never a real card. */
const CARD_ON_FILE = "4242424242424242";
/** Typed into the card field. Not a card number: nothing here needs to look like one. */
const TYPED_CARD = "synthetic-card-entry";
/** An ordinary email, which is not sensitive: it is the control that proves redaction is targeted. */
const SHOPPER_EMAIL = "synthetic-shopper@example.test";
/** Appended to the email by keyboard, so a captured value is visible in the wire form. */
const EMAIL_SUFFIX = "+control";
/** Typed into the email field by an action, to read back the validation strings an ordinary field still gets. */
const CONTROL_TEXT = "synthetic-control-text";

const PASSWORD = 'input[name="password"]';
const EMAIL = 'input[name="email"]';
const CARD = 'input[name="cardnumber"]';
const CARD_FRAME = 'iframe[title="Secure card entry"]';
const CHECKOUT = "/scenarios/bigbox-retail/checkout";

const LOUD = { captureMutations: false, captureInputValues: true, captureSnapshots: true };
const QUIET = { captureMutations: false, captureInputValues: true, captureSnapshots: false };
const NO_VALUES = { captureMutations: false, captureInputValues: false, captureSnapshots: false };

/** The page global e2e/content/runtime-stub.ts installs in every frame; harness.ts owns the name and exports none. */
const HARNESS_GLOBAL = "__fluxiqContentHarness";
/** A child frame id, as the background worker addresses one. The frame reads only "not the top one". */
const A_CHILD_FRAME = 1;

/** Applies one bigbox-retail operation through the site's own API, as its pages do. */
async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

/**
 * Opens bigbox-retail's checkout: the sign-in wall, or as a guest the contact
 * details and the card frame. The privacy choices are declined first, as a
 * shopper would, because their scrim eats every click.
 */
async function openCheckout(openHarness: (scenarioId: string) => Promise<ContentHarness>, as: "wall" | "guest"): Promise<ContentHarness> {
  const harness = await openHarness("bigbox-retail");
  await apply(harness, "consent", { choice: "reject" });
  if (as === "guest") await apply(harness, "start-guest-checkout");
  await harness.page.goto(new URL(CHECKOUT, harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await expect(harness.page.locator(as === "guest" ? CARD_FRAME : PASSWORD)).toBeVisible();
  return harness;
}

/** The card frame's own content script, spoken to as the background worker speaks to a child frame. */
type FrameChannel = {
  frame: Frame;
  runAction(command: BrowserActionCommand): Promise<BrowserActionResult>;
  capture(): Promise<DomSnapshot>;
  setRecording(recording: boolean, settings?: HarnessRecordingSettings): Promise<void>;
  messages(): Promise<SentMessage[]>;
  recordedEvents(kind: RecordingEventPayload["kind"]): Promise<RecordingEventPayload[]>;
};

async function cardFrame(page: Page): Promise<FrameChannel> {
  const frame = await (await page.locator(CARD_FRAME).elementHandle())?.contentFrame();
  if (!frame) throw new Error(`${CARD_FRAME} has no frame.`);
  await frame.waitForFunction((name) => {
    const stub = (window as unknown as Record<string, { sent?: Array<{ type?: string }> } | undefined>)[name];
    return Boolean(stub?.sent?.some((message) => message.type === "fluxiq.contentReady"));
  }, HARNESS_GLOBAL);
  await frame.locator(CARD).waitFor();
  const deliver = (message: Record<string, unknown>): Promise<HarnessDelivery> => frame.evaluate(([name, value]) => {
    const stub = (window as unknown as Record<string, { deliver(message: unknown): Promise<HarnessDelivery> } | undefined>)[name];
    if (!stub) throw new Error("The content-harness runtime stub is not installed in the card frame.");
    return stub.deliver(value);
  }, [HARNESS_GLOBAL, message] as const);
  const answer = async (message: Record<string, unknown>, what: string): Promise<unknown> => {
    const delivery = await deliver(message);
    if (!delivery.responded) throw new Error(`The card frame's content script did not answer ${what}.`);
    return delivery.response;
  };
  const messages = async (): Promise<SentMessage[]> => await frame.evaluate(
    (name) => (window as unknown as Record<string, { sent: SentMessage[] } | undefined>)[name]?.sent ?? [],
    HARNESS_GLOBAL
  );
  return {
    frame,
    runAction: async (command) => await answer(
      { type: "executeAction", action: { ...command, frameId: A_CHILD_FRAME }, frameId: A_CHILD_FRAME },
      `executeAction for ${command.actionType} (${command.commandId})`
    ) as BrowserActionResult,
    capture: async () => await answer({ type: "captureSnapshot" }, "captureSnapshot") as DomSnapshot,
    setRecording: async (recording, settings) => {
      await answer({ type: "recording", recording, ...(settings ? { settings } : {}) }, "the recording message");
    },
    messages,
    recordedEvents: async (kind) => (await messages())
      .filter((message) => message.type === "fluxiq.contentEvent")
      .map((message) => message.payload as RecordingEventPayload)
      .filter((event) => event.kind === kind)
  };
}

/** Guest checkout with a card already entered in the frame, before anything listens. */
async function cardOnFile(openHarness: (scenarioId: string) => Promise<ContentHarness>): Promise<{ harness: ContentHarness; card: FrameChannel }> {
  const harness = await openCheckout(openHarness, "guest");
  const card = await cardFrame(harness.page);
  await card.frame.locator(CARD).fill(CARD_ON_FILE);
  return { harness, card };
}

const named = (name: string) => (event: RecordingEventPayload) => event.element?.attributes?.name === name;
const describedAs = (snapshot: DomSnapshot, name: string) => snapshot.interactiveElements.find((element) => element.attributes?.name === name);

test("no password value reaches any recorded message, typed or pre-filled", async ({ openHarness, page }) => {
  const harness = await openCheckout(openHarness, "wall");
  await page.locator(PASSWORD).fill(PREFILLED_PASSWORD);
  await page.locator(EMAIL).fill(SHOPPER_EMAIL);
  await harness.setRecording(true, LOUD);

  await page.locator(PASSWORD).focus();
  await page.keyboard.press("Control+a");
  await page.keyboard.type(TYPED_PASSWORD);
  // The control: a field that is not sensitive is still captured in the same session.
  await page.locator(EMAIL).focus();
  await page.keyboard.press("End");
  await page.keyboard.type(EMAIL_SUFFIX);
  await page.keyboard.press("Tab");
  await harness.setRecording(false);

  const wire = JSON.stringify(await harness.messages());
  expect(wire).not.toContain(PREFILLED_PASSWORD);
  expect(wire).not.toContain(TYPED_PASSWORD);
  expect(wire).toContain(`${SHOPPER_EMAIL}${EMAIL_SUFFIX}`);
});

test("a key pressed in a sensitive field is recorded as a press, never as the character", async ({ openHarness, page }) => {
  const harness = await openCheckout(openHarness, "wall");
  await harness.setRecording(true, QUIET);
  await page.locator(PASSWORD).focus();
  await page.keyboard.type("abc");
  await page.keyboard.press("Tab");
  await harness.setRecording(false);

  const presses = (await harness.recordedEvents("dom.keydown")).filter(named("password"));
  // Three characters and the Tab that left the field.
  expect(presses).toHaveLength(4);
  expect(presses.slice(0, 3).map((event) => event.key)).toEqual([undefined, undefined, undefined]);
  // A key that carries no content still travels, so the interaction stays visible.
  expect(presses[3]?.key).toBe("Tab");
});

test("the recorded input event for a sensitive field reports the change without the value", async ({ openHarness, page }) => {
  const harness = await openCheckout(openHarness, "wall");
  await harness.setRecording(true, QUIET);
  await page.locator(PASSWORD).focus();
  await page.keyboard.type(TYPED_PASSWORD);
  await harness.setRecording(false);

  const inputs = (await harness.recordedEvents("dom.input")).filter(named("password"));
  expect(inputs).toHaveLength(1);
  expect(inputs[0]?.inputValue).toBeUndefined();
  // Presence still travels: the recording knows a value was entered.
  expect(inputs[0]?.element?.hasValue).toBe(true);
  expect(inputs[0]?.element?.value).toBeUndefined();
});

test("a snapshot reports a sensitive field's presence and never its value", async ({ openHarness, page }) => {
  const harness = await openCheckout(openHarness, "wall");
  await page.locator(PASSWORD).fill(PREFILLED_PASSWORD);
  await page.locator(EMAIL).fill(SHOPPER_EMAIL);
  const snapshot = await harness.capture();

  const password = describedAs(snapshot, "password");
  expect(password, "the password field is missing from the snapshot").toBeTruthy();
  expect(password?.value).toBeUndefined();
  expect(password?.hasValue).toBe(true);
  expect(password?.inputType).toBe("password");
  expect(JSON.stringify(snapshot)).not.toContain(PREFILLED_PASSWORD);

  // The control: the same snapshot carries the ordinary field's value.
  expect(describedAs(snapshot, "email")?.value).toBe(SHOPPER_EMAIL);
});

test("an action result's evidence describes a sensitive field without its value", async ({ openHarness, page }) => {
  const harness = await openCheckout(openHarness, "wall");
  await page.locator(PASSWORD).fill(PREFILLED_PASSWORD);
  const result = await harness.runAction({ commandId: "click-password", actionType: "web.dom.click", selector: PASSWORD });

  expect(result.status).toBe("succeeded");
  expect(JSON.stringify(result)).not.toContain(PREFILLED_PASSWORD);
  expect(result.element?.value).toBeUndefined();
  expect(result.element?.hasValue).toBe(true);
});

test("captureInputValues off withholds every value, sensitive or not", async ({ openHarness, page }) => {
  const harness = await openCheckout(openHarness, "wall");
  await page.locator(EMAIL).fill(SHOPPER_EMAIL);
  await harness.setRecording(true, NO_VALUES);
  await page.locator(EMAIL).focus();
  await page.keyboard.press("End");
  await page.keyboard.type(EMAIL_SUFFIX);
  await harness.setRecording(false);

  const inputs = (await harness.recordedEvents("dom.input")).filter(named("email"));
  expect(inputs).toHaveLength(1);
  expect(inputs[0]?.inputValue).toBeUndefined();
  expect(inputs[0]?.element?.value).toBeUndefined();
  // Presence is not a value, so it is unaffected by the setting.
  expect(inputs[0]?.element?.hasValue).toBe(true);
  expect(JSON.stringify(await harness.messages())).not.toContain(SHOPPER_EMAIL);
});

test("web.dom.type withholds a sensitive field's text from its validation and still reports the match", async ({ openHarness }) => {
  const harness = await openCheckout(openHarness, "wall");
  const result = await harness.runAction({ commandId: "type-password", actionType: "web.dom.type", selector: PASSWORD, text: TYPED_PASSWORD });

  expect(JSON.stringify(result)).not.toContain(TYPED_PASSWORD);
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

test("web.dom.clear withholds a sensitive field's value from its validation", async ({ openHarness, page }) => {
  const harness = await openCheckout(openHarness, "wall");
  await page.locator(PASSWORD).fill(PREFILLED_PASSWORD);
  const result = await harness.runAction({ commandId: "clear-password", actionType: "web.dom.clear", selector: PASSWORD });

  expect(JSON.stringify(result)).not.toContain(PREFILLED_PASSWORD);
  // An empty field is not a secret, so the passing case reads exactly as it always did.
  expect(result).toMatchObject({ status: "succeeded", validation: { status: "passed", expected: "the field is empty", actual: "the field is empty" } });
  await expect(page.locator(PASSWORD)).toHaveValue("");
});

test("the card field is sensitive by the shared rule, so no path carries its value", async ({ openHarness }) => {
  const { card } = await cardOnFile(openHarness);

  const snapshot = await card.capture();
  const described = describedAs(snapshot, "cardnumber");
  expect(described, "the card field is missing from the frame's snapshot").toBeTruthy();
  expect(described?.value).toBeUndefined();
  expect(described?.hasValue).toBe(true);
  expect(JSON.stringify(snapshot)).not.toContain(CARD_ON_FILE);

  // Typed at the caret rather than over a select-all, deliberately: a
  // select-all inside a sensitive text field puts its value in the page
  // selection, which selection-redaction.spec.ts proves is withheld. This row
  // is about the recorder's own paths.
  await card.setRecording(true, LOUD);
  await card.frame.locator(CARD).focus();
  await card.frame.locator(CARD).press("End");
  await card.frame.page().keyboard.type(TYPED_CARD);
  await card.setRecording(false);
  const recorded = await card.recordedEvents("dom.input");
  expect(recorded.some(named("cardnumber")), "the frame recorded no input for the card field, so the row proves nothing").toBe(true);
  const wire = JSON.stringify(await card.messages());
  expect(wire).not.toContain(CARD_ON_FILE);
  expect(wire).not.toContain(TYPED_CARD);

  const result = await card.runAction({ commandId: "type-card", actionType: "web.dom.type", selector: CARD, text: TYPED_CARD });
  expect(JSON.stringify(result)).not.toContain(TYPED_CARD);
  expect(result).toMatchObject({ status: "succeeded", validation: { status: "passed", expected: expect.stringContaining("a withheld value of") } });
});

test("a field that is not sensitive keeps validation strings that quote what was sent and what it kept", async ({ openHarness }) => {
  const harness = await openCheckout(openHarness, "wall");
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
 *
 * `stamped` sends the validation as a client built before 1b6f5df did for a
 * producer that did not declare: withheld, and stamped `redacted: true`.
 */
async function throughTheDomain(result: BrowserActionResult, stamped = false): Promise<FluxIQRuntimeCommandResult> {
  const payload = webAutomationActionResultPayload(result as never) as Record<string, unknown>;
  const gatewayResult = {
    commandId: result.commandId,
    status: result.status,
    ...(result.status === "succeeded" ? {} : { error: result.message }),
    message: result.message,
    payload: stamped ? { ...payload, validation: { status: result.validation.status, expected: WITHHELD, actual: WITHHELD, redacted: true } } : payload,
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

test("a sensitive control's post-condition is secret-free after the hop to the domain, on both paths it takes", async ({ openHarness }) => {
  const { card } = await cardOnFile(openHarness);

  // A page behaviour, arranged here rather than found on the site: the card
  // field rewrites whatever is typed into it, from its own `input` handler. That
  // is the only way `type.ts`'s mismatch branch is reachable live, and it is the
  // branch that matters, because a failed read-back is what puts BOTH sides of
  // the comparison onto a failure record — and the failure record does not go
  // through `webAutomationActionResultPayload` at all. `result-mapping.ts` puts
  // it on the gateway result directly, so it is a second exit with a second
  // guard, in `domain/src/runtime/adapter.ts`.
  const rewritten = "page-rewrote-this-value";
  await card.frame.evaluate(([selector, replacement]) => {
    const field = document.querySelector(selector) as HTMLInputElement | null;
    field?.addEventListener("input", () => { field.value = replacement; });
  }, [CARD, rewritten] as const);

  const result = await card.runAction({ commandId: "type-card-rewritten", actionType: "web.dom.type", selector: CARD, text: TYPED_CARD });
  expect(result.status, "the read-back has to disagree, or there is no comparison to carry").toBe("failed");
  expect(result.failure?.expected, "both sides ride on the record, which is the exit the wire payload never sees").toBeTruthy();
  expect(result.failure?.actual).toBeTruthy();

  const runtimeResult = await throughTheDomain(result);
  // The whole serialized form of everything the page's answer produced, not one
  // named field: every leak found in this plan was found this way, and three of
  // them were in fields nobody had thought to name.
  const arrived = JSON.stringify({ payload: runtimeResult.payload, failure: runtimeResult.failure, metadata: runtimeResult.metadata, message: runtimeResult.message, error: runtimeResult.error });
  expect(arrived).not.toContain(CARD_ON_FILE);
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

test("the declaration is what buys a sensitive control's phrasing through, and every other state of it withholds", async ({ openHarness }) => {
  const { harness, card } = await cardOnFile(openHarness);
  const result = await card.runAction({ commandId: "type-card-domain-guard", actionType: "web.dom.type", selector: CARD, text: TYPED_CARD });

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
  // hold the value the field really holds, read off the page a moment ago —
  // exactly what would reach this function if `content/actions/type.ts` set the
  // flag and stopped withholding, or if a future verb copied the flag without
  // copying the redaction. Staged here rather than by editing that file: a
  // mutation window in a shared tree is how a deliberately broken compile gets
  // committed.
  //
  // The state not tested is `true` over an unredacted string. A declaration is
  // a contract and this layer believes it, by design — nothing here reads the
  // text, because a predicate that scans for things that look like card numbers
  // both misses and misfires. That is why the flag is set beside the redaction
  // inside the verb and nowhere else.
  const held = await card.frame.locator(CARD).inputValue();
  expect(held.length, "the card field has no value to leak").toBeGreaterThan(0);
  const leaked = `the field holds "${held}"`;
  expect(
    JSON.stringify(webAutomationActionResultPayload(declared(false, leaked, leaked) as never)),
    "an explicit false must withhold, or the fail-safe has a hole shaped like a boolean"
  ).not.toContain(held);
  expect(
    JSON.stringify(webAutomationActionResultPayload(declared(undefined, leaked, leaked) as never)),
    "the second layer holds on its own, which is the whole claim"
  ).not.toContain(held);

  // The other direction, live: an ordinary control on the page around the
  // frame keeps a comparison an operator can act on, so the guard is targeted
  // rather than a blanket.
  const control = await harness.runAction({ commandId: "type-email-domain-guard", actionType: "web.dom.type", selector: EMAIL, text: CONTROL_TEXT });
  const controlPayload = webAutomationActionResultPayload(control as never) as { validation?: { expected?: string } };
  expect(controlPayload.validation?.expected).toBe(`the field holds "${CONTROL_TEXT}"`);
});

/**
 * The same fail-safe at the OTHER exit. The failure record never travels
 * through `webAutomationActionResultPayload`: `runtime/result-mapping.ts` puts
 * the content script's record straight onto the gateway result, and
 * `domain/src/runtime/adapter.ts` is its only guard. That guard asks whether the
 * producer declared a redaction, of a validation the client has already run
 * through its own withholding layer, and until 1b6f5df that layer stamped
 * `redacted: true` on what it withheld: the adapter took the stamp for a
 * declaration and let every record through (reports/v-redaction-producer.md
 * section 4, fixed in reports/f-adapter-guard.md). A client built before then
 * still stamps, so each state runs through this client and through one that
 * stamps, against strings holding the value the field really holds.
 */
test("the runtime adapter withholds a failure record's comparison when the producer did not declare one", async ({ openHarness }) => {
  const { card } = await cardOnFile(openHarness);
  const result = await card.runAction({ commandId: "type-card-record-guard", actionType: "web.dom.type", selector: CARD, text: TYPED_CARD });
  const held = await card.frame.locator(CARD).inputValue();
  expect(held.length, "the card field has no value to leak").toBeGreaterThan(0);

  const leaked = `the field holds "${held}"`;
  for (const declaration of [undefined, false] as const) {
    const asIfOnTheRecord: BrowserActionResult = {
      ...result,
      status: "failed",
      validation: declaration === undefined ? { status: "failed", expected: leaked, actual: leaked } : { status: "failed", expected: leaked, actual: leaked, redacted: declaration },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true, stage: "verification", expected: leaked, actual: leaked }
    };
    for (const stamped of [false, true]) {
      // Soft, so one run names every state that leaks rather than the first.
      const state = `declaration ${String(declaration)}, ${stamped ? "a client that stamps" : "this client"}`;
      const runtimeResult = await throughTheDomain(asIfOnTheRecord, stamped);
      expect.soft(JSON.stringify(runtimeResult), state).not.toContain(held);
      expect.soft(runtimeResult.failure?.expected, state).toBe(WITHHELD);
      expect.soft(runtimeResult.failure?.code, "the classification is untouched; only the two strings are").toBe("web.validation.output_not_observed");
    }
  }
});

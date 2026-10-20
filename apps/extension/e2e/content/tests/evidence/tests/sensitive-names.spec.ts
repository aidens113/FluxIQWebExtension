// What page evidence may never quote: the contents of a sensitive control,
// reached by any of the routes that compute a name, a context or a state.
//
// Each row captures and searches the whole wire -- every descriptor and its
// `context`, every evidence item, and the reply around them -- for the secrets
// on the page. The ordinary controls beside the sensitive ones keep their
// words, so a blanket drop fails these rows as surely as a leak does.
//
// The first row is realistic (t730): bigbox-retail's card frame, where each
// label wraps its own control, so the accessible name of "Card number" is
// computed from a label that embeds the field holding the card. The accessible
// name algorithm includes an embedded text field's value, which is exactly the
// route that must not carry it.
//
// The four rows after it (t730 C2) read bigbox-retail's sign-in wall armed
// into its `account-recovery` rendering, where the "Forgot your password?"
// panel holds what they need: sensitive controls and `data-sensitive` spans
// inside the text that names, heads or labels another element, and a group
// marked `data-sensitive` beside an ordinary one. The panel's hidden values
// come from the scenario itself, so every row searches for all of them.

import type { Frame } from "@playwright/test";
import { ACCOUNT_RECOVERY_VALUES } from "../../../../../../scenario-lab/src/scenarios/bigbox-retail/index.js";
import type { RecordingEventPayload } from "../../../../../src/shared/protocol.js";
import { expect, test, type ContentHarness, type HarnessDelivery } from "../../../index.js";
import { capture, type CapturedSnapshot } from "./captured-snapshot.js";

/** The public test card number and a synthetic expiry, never a real card. */
const CARD_ON_FILE = "4242424242424242";
const EXPIRY_ON_FILE = "04/39";
const CARD_FRAME = 'iframe[title="Secure card entry"]';
/** The page global e2e/content/runtime-stub.ts installs in every frame; harness.ts owns the name and exports none. */
const HARNESS_GLOBAL = "__fluxiqContentHarness";

/** Opens bigbox-retail's guest checkout, with the privacy choices declined as a shopper would, and returns the card frame once its content script is loaded. */
async function openCardFrame(openHarness: (scenarioId: string) => Promise<ContentHarness>): Promise<Frame> {
  const harness = await openHarness("bigbox-retail");
  for (const [operation, payload] of [["consent", { choice: "reject" }], ["start-guest-checkout", {}]] as Array<[string, object]>) {
    const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
      method: "POST",
      headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
  }
  await harness.page.goto(new URL("/scenarios/bigbox-retail/checkout", harness.lab.origin).href);
  const frame = await (await harness.page.locator(CARD_FRAME).elementHandle())?.contentFrame();
  if (!frame) throw new Error(`${CARD_FRAME} has no frame.`);
  await frame.waitForFunction((name) => {
    const stub = (window as unknown as Record<string, { sent?: Array<{ type?: string }> } | undefined>)[name];
    return Boolean(stub?.sent?.some((message) => message.type === "fluxiq.contentReady"));
  }, HARNESS_GLOBAL);
  return frame;
}

/** Hands one message to the card frame's content script, as the background worker addresses a child frame. */
async function askFrame(frame: Frame, message: Record<string, unknown>): Promise<unknown> {
  const delivery = await frame.evaluate(([name, value]) => {
    const stub = (window as unknown as Record<string, { deliver(message: unknown): Promise<HarnessDelivery> } | undefined>)[name];
    if (!stub) throw new Error("The content-harness runtime stub is not installed in the card frame.");
    return stub.deliver(value);
  }, [HARNESS_GLOBAL, message] as const);
  if (!delivery.responded) throw new Error(`The card frame's content script did not answer ${String(message.type)}.`);
  return delivery.response;
}

test("bigbox-retail: no name in page evidence quotes a card field through the label that embeds it", async ({ openHarness }) => {
  const frame = await openCardFrame(openHarness);
  await frame.locator('input[name="cardnumber"]').fill(CARD_ON_FILE);
  await frame.locator('input[name="exp"]').fill(EXPIRY_ON_FILE);

  const snapshot = await askFrame(frame, { type: "captureSnapshot" }) as CapturedSnapshot;
  const reply = await askFrame(frame, { type: "executeAction", action: { commandId: "capture-card-names", actionType: "web.dom.capture_snapshot", frameId: 1 }, frameId: 1 });
  expect(reply).toMatchObject({ status: "succeeded" });
  for (const wire of [JSON.stringify(snapshot), JSON.stringify(reply)]) {
    for (const secret of [CARD_ON_FILE, EXPIRY_ON_FILE]) expect(wire).not.toContain(secret);
  }

  // Each name keeps the label's own words.
  const described = (name: string) => snapshot.interactiveElements.find((element) => element.attributes?.name === name);
  expect(described("cardnumber"), "the card field is missing from the frame's snapshot").toMatchObject({ accessibleName: "Card number", label: "Card number", hasValue: true });
  expect(described("exp")).toMatchObject({ accessibleName: "Expiration (MM/YY)", label: "Expiration (MM/YY)", hasValue: true });
  const controls = (snapshot.evidence?.forms ?? []).flatMap((form) => form.controls);
  expect(controls.map((control) => control.label)).toEqual(expect.arrayContaining(["Card number", "Expiration (MM/YY)"]));
});

/**
 * Everything bigbox-retail's "Forgot your password?" panel shows that the page
 * itself marks hidden: the security details, the password hint, the one-time
 * code, the reset-link address and the masked card details. They are on the
 * page from the start, so no row's snapshot, reply or recording may carry any.
 */
const PAGE_SECRETS = [
  ...ACCOUNT_RECOVERY_VALUES.securityAnswers.flatMap((answer) => [answer.value, answer.label]),
  ACCOUNT_RECOVERY_VALUES.passwordHint, ACCOUNT_RECOVERY_VALUES.oneTimeCode.value, ACCOUNT_RECOVERY_VALUES.oneTimeCode.label,
  ACCOUNT_RECOVERY_VALUES.resetEmail, ACCOUNT_RECOVERY_VALUES.savedCardsHeading, ACCOUNT_RECOVERY_VALUES.cardColumn,
  ACCOUNT_RECOVERY_VALUES.billingAddress, ACCOUNT_RECOVERY_VALUES.nicknameCard, ACCOUNT_RECOVERY_VALUES.billingZip
];

/**
 * Opens bigbox-retail's checkout armed into its `account-recovery` rendering:
 * the sign-in wall with the "Forgot your password?" panel open beside it, the
 * privacy choices declined as a shopper would.
 */
async function openAccountRecovery(openHarness: (scenarioId: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openHarness("bigbox-retail");
  // Arming starts the shopper over, so it goes first.
  for (const [operation, payload] of [["set-mode", { mode: "account-recovery" }], ["consent", { choice: "reject" }]] as Array<[string, object]>) {
    const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
      method: "POST",
      headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
  }
  await harness.page.goto(new URL("/scenarios/bigbox-retail/checkout", harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await expect(harness.page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
  return harness;
}

/** The descriptor of the control the page names `name`: the generated ids change with the seed, the names do not. */
function byName(snapshot: CapturedSnapshot, name: string): CapturedSnapshot["interactiveElements"][number] | undefined {
  return snapshot.interactiveElements.find((element) => element.attributes?.name === name);
}

test("bigbox-retail: no name in page evidence quotes a sensitive control's contents, whichever route computes it", async ({ openHarness, page }) => {
  const harness = await openAccountRecovery(openHarness);
  // Every route by which `accessibleNameFor` reads page content, each reaching
  // it through a different evidence reader: a button named through
  // `aria-labelledby` by a label holding the marked password-hint textarea, and
  // by one holding the code select the shared rule marks by its
  // `autocomplete="one-time-code"`; a button whose own text holds the marked
  // reset-link address; and the "Saved cards" landmark, named through a
  // reference to a heading holding a marked card. The "Send codes by" button,
  // named the same way by an ordinary select, keeps its words, so the filter is
  // not a blanket drop.
  const snapshot = await capture(harness);
  const reply = await harness.runAction({ commandId: "capture-naming", actionType: "web.dom.capture_snapshot" });
  expect(reply).toMatchObject({ status: "succeeded" });
  // The whole of both: descriptors and their `context`, every evidence item, and the reply around them.
  for (const wire of [JSON.stringify(snapshot), JSON.stringify(reply)]) {
    for (const secret of PAGE_SECRETS) expect(wire).not.toContain(secret);
  }

  // Each name keeps the words around what was left out.
  const controls = (snapshot.evidence?.forms ?? []).flatMap((form) => form.controls);
  const labelOf = (name: string) => controls.find((control) => control.name === name)?.label;
  expect(labelOf("showHint")).toBe("Password hint");
  expect(labelOf("useCode")).toBe("Verification code");
  expect(labelOf("changeChannel")).toBe("Send codes by Text message");
  expect(labelOf("emailResetLink")).toBe("Email a reset link to");
  const savedCards = (snapshot.evidence?.regions ?? []).filter((region) => region.role === "region" && region.label === "Saved cards");
  expect(savedCards).toHaveLength(1);
  const headingId = await page.evaluate((selector) => document.querySelector(selector)?.querySelector(":scope > h3")?.id ?? "", savedCards[0]?.selector ?? "");
  expect(headingId, "the region the evidence names is the section the saved-cards heading names").not.toBe("");
  // Every descriptor inside the saved cards names its landmark by the same
  // words. The panel itself is a named section too, so the descriptors are
  // narrowed by where they sit and not by the name under test: selecting them
  // by that name would assert nothing.
  const inRegion = snapshot.interactiveElements.filter((element) => element.context?.landmark === "region");
  const inSavedCards = new Set(await page.evaluate(
    (selectors) => selectors.filter((selector) => document.querySelector(selector)?.closest("section")?.firstElementChild?.tagName === "H3"),
    inRegion.map((element) => element.selector)
  ));
  expect(inSavedCards.size).toBeGreaterThan(0);
  for (const element of inRegion) {
    if (inSavedCards.has(element.selector)) expect(element.context).toMatchObject({ landmarkName: "Saved cards" });
  }
});

test("bigbox-retail: no descriptor's context or label quotes a sensitive control's contents", async ({ openHarness }) => {
  const harness = await openAccountRecovery(openHarness);
  // Every other place `identity/context.ts` and `identity/label.ts` read page
  // text, each holding a marked card detail in the saved cards: a fieldset's
  // legend, the heading before a control, a table's column header, a
  // `<label for>`, and the short text beside an unlabelled control. The label's
  // text is also the control's accessible name, and so the forms evidence's
  // `label`.
  const snapshot = await capture(harness);
  const reply = await harness.runAction({ commandId: "capture-context", actionType: "web.dom.capture_snapshot" });
  expect(reply).toMatchObject({ status: "succeeded" });
  // The whole of both: descriptors and their `context`, every evidence item, and the reply around them.
  for (const wire of [JSON.stringify(snapshot), JSON.stringify(reply)]) {
    for (const secret of PAGE_SECRETS) expect(wire).not.toContain(secret);
  }

  // Each keeps the words around what was left out.
  expect(byName(snapshot, "billingStreet")).toMatchObject({ context: { fieldsetLegend: "Billing address on file" } });
  expect(byName(snapshot, "saveCards")).toMatchObject({ context: { heading: "Saved cards" } });
  expect(byName(snapshot, "removeCard")).toMatchObject({ context: { tablePosition: { row: 2, column: 1, columnHeader: "Card" } } });
  expect(byName(snapshot, "cardNickname")).toMatchObject({ label: "Nickname for", accessibleName: "Nickname for" });
  expect(byName(snapshot, "billingZip")).toMatchObject({ label: "Billing ZIP code" });
});

/** Typed below into the text field in the marked group; no snapshot, action reply or recorded message may carry it. */
const TYPED_IN_MARKED_GROUP = "copper-lantern-harbor-27";
/** Typed into the ordinary field in the same session, which must still be carried. */
const CONTROL_TEXT = "Dee Whitfield";

/**
 * The panel's group the site marks `data-sensitive` -- "Your security
 * details": a text field, a select and a box that starts ticked -- and its
 * ordinary "Contact preferences" fieldset holding the same three.
 *
 * Not one of the three is marked itself. The group is, so what its controls
 * hold is part of what it holds and is withheld as a marked control's own
 * contents are (D2) -- the case the descriptor's value reader already covers
 * for text, extended to the two state readers beside it. The ordinary group is
 * the other direction of the same rule: it keeps everything, so a blanket drop
 * fails these rows as surely as a leak does. The page gives the two groups
 * different shapes, so they cannot be read as one repeating run.
 */
const MARKED = { text: "recoveryPhrase", select: "securityAnswer", check: "rememberDevice" };
const PLAIN = { text: "preferredName", select: "callTime", check: "accountEmails" };
const field = (name: string) => `[name="${name}"]`;

test("bigbox-retail: no descriptor carries the checked state, options or selection of a control inside a marked element", async ({ openHarness }) => {
  const harness = await openAccountRecovery(openHarness);
  await harness.page.locator(field(MARKED.text)).fill(TYPED_IN_MARKED_GROUP);

  const snapshot = await capture(harness);
  const reply = await harness.runAction({ commandId: "capture-marked-state", actionType: "web.dom.capture_snapshot" });
  expect(reply).toMatchObject({ status: "succeeded" });
  // The whole of both: every descriptor, every evidence item, and the reply around them.
  for (const wire of [JSON.stringify(snapshot), JSON.stringify(reply)]) {
    for (const secret of [...PAGE_SECRETS, TYPED_IN_MARKED_GROUP]) expect(wire).not.toContain(secret);
  }

  const markedSelect = byName(snapshot, MARKED.select);
  expect(markedSelect, `${MARKED.select} is missing from the snapshot, so this row proves nothing`).toBeTruthy();
  expect(markedSelect?.options).toBeUndefined();
  expect(markedSelect?.selectedValue).toBeUndefined();
  expect(markedSelect?.value).toBeUndefined();
  // Presence still travels, as it does for a marked control itself.
  expect(markedSelect?.hasValue).toBe(true);
  expect(byName(snapshot, MARKED.text)).toMatchObject({ hasValue: true });
  const markedCheck = byName(snapshot, MARKED.check);
  expect(markedCheck, `${MARKED.check} is missing from the snapshot, so this row proves nothing`).toBeTruthy();
  expect(await harness.page.locator(field(MARKED.check)).isChecked(), "the box really is ticked").toBe(true);
  expect(markedCheck?.checked).toBeUndefined();

  // The ordinary group keeps the state the marked one withholds.
  expect(byName(snapshot, PLAIN.select)).toMatchObject({
    options: [{ value: "mornings", label: "Mornings" }, { value: "evenings", label: "Evenings" }],
    selectedValue: "mornings"
  });
  expect(byName(snapshot, PLAIN.check)).toMatchObject({ checked: true });
});

test("bigbox-retail: no recorded event carries the value, checked state or options of a control inside a marked element", async ({ openHarness, page }) => {
  const harness = await openAccountRecovery(openHarness);
  // The recorder's three routes into what a control holds: the debounced
  // `dom.input`, the `dom.change` a toggle and a select report through, and the
  // keydown path -- which carries typed text one character at a time and so
  // never passes a value reader at all.
  //
  // This row sits with the evidence specs because the brief that added it owns
  // them; redaction.spec.ts is the thematic home for recorded-value leaks.
  await harness.setRecording(true, { captureMutations: false, captureInputValues: true, captureSnapshots: false });
  await page.locator(field(MARKED.text)).focus();
  await page.keyboard.type(TYPED_IN_MARKED_GROUP);
  // Tab acts on the text rather than typing it, so it sends the debounced input.
  await page.keyboard.press("Tab");
  await page.locator(field(MARKED.check)).click();
  // A real key press, not selectOption: the synthetic events that dispatches are
  // untrusted, and the recorder ignores those by design.
  await page.locator(field(MARKED.select)).focus();
  await page.keyboard.press("ArrowDown");
  // The control: an ordinary field typed into in the same session is recorded in full.
  await page.locator(field(PLAIN.text)).focus();
  await page.keyboard.type(CONTROL_TEXT);
  await harness.setRecording(false);

  const wire = JSON.stringify(await harness.messages());
  for (const secret of [...PAGE_SECRETS, TYPED_IN_MARKED_GROUP]) expect(wire).not.toContain(secret);
  expect(wire).toContain(CONTROL_TEXT);

  const named = (name: string) => (event: RecordingEventPayload) => event.element?.attributes?.name === name;
  const typed = (await harness.recordedEvents("dom.input")).filter(named(MARKED.text));
  expect(typed).toHaveLength(1);
  expect(typed[0]?.inputValue).toBeUndefined();
  expect(typed[0]?.element?.value).toBeUndefined();
  // Presence still travels: the recording knows the field was typed into.
  expect(typed[0]?.element?.hasValue).toBe(true);

  // Every character key pressed in the group is withheld; the key that left it
  // carries no content of its own and still travels.
  const presses = (await harness.recordedEvents("dom.keydown")).filter(named(MARKED.text));
  expect(presses.length).toBeGreaterThanOrEqual(TYPED_IN_MARKED_GROUP.length);
  expect(presses.map((event) => event.key).filter((key) => key !== undefined)).toEqual(["Tab"]);

  const changes = await harness.recordedEvents("dom.change");
  const toggled = changes.find(named(MARKED.check));
  expect(toggled, "no dom.change was recorded for the checkbox in the marked group").toBeTruthy();
  expect(toggled?.element?.checked).toBeUndefined();
  expect(toggled?.inputValue).toBeUndefined();
  const selected = changes.find(named(MARKED.select));
  expect(selected, "no dom.change was recorded for the select in the marked group").toBeTruthy();
  expect(selected?.element?.options).toBeUndefined();
  expect(selected?.element?.selectedValue).toBeUndefined();
  expect(selected?.inputValue).toBeUndefined();

  // The control at the event level: the ordinary field's value is recorded.
  const control = (await harness.recordedEvents("dom.input")).filter(named(PLAIN.text));
  expect(control).toHaveLength(1);
  expect(control[0]?.inputValue).toBe(CONTROL_TEXT);
});

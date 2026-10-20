// The selection proof: `snapshot.selectedText` must never carry text that came
// from, or reached into, a control the shared sensitivity rule protects.
//
// This is a separate leak from the one `redaction.spec.ts` proves. Every path
// that file covers reads a control's value through `readElementValue`, which
// refuses a sensitive control. The page selection does not go through it at
// all: `dom-snapshot.ts` copied `window.getSelection().toString()` straight
// into the snapshot, and Chromium's selection includes the text of a focused
// ordinary `<input>`. A select-all inside a card field therefore put its value
// into every snapshot, and from there into durable web state
// (`domain/src/recording/web-state/snapshot.ts`) and the LLM evidence packet
// (`domain/src/runtime/llm-evidence/page-evidence.ts`).
//
// It stayed invisible because Chromium returns nothing for `type="password"`,
// so a password field hides it. A browser quirk is not a control, which is why
// most rows use a card field.
//
// The pages are bigbox-retail's checkout (t730). The card field is "Card
// number" (`autocomplete="cc-number"`) in the payment provider's cross-origin
// frame "Secure card entry" on guest checkout; the harness answers through the
// top frame only, so those rows talk to the frame's own content script, as the
// background worker addresses a frame by its id. The ordinary controls are
// guest checkout's heading and its "First name" field, and the sign-in wall is
// the login form a selection can run across.
//
// Both directions are pinned. Three rows require the selection to be withheld;
// two require an ordinary selection to survive, because a snapshot that lost
// every selection would pass the security rows while destroying the evidence
// item they are protecting.
//
// The card value is the public test number and the rest is synthetic.

import type { Frame, Page } from "@playwright/test";
import type { DomSnapshot, RecordingEventPayload } from "../../../src/shared/protocol.js";
import { expect, test, type ContentHarness, type HarnessDelivery, type HarnessRecordingSettings, type SentMessage } from "../index.js";

const CARD = 'input[name="cardnumber"]';
const CARD_FRAME = 'iframe[title="Secure card entry"]';
const FIRST_NAME = 'input[name="firstName"]';
const PASSWORD = 'input[name="password"]';
const CHECKOUT = "/scenarios/bigbox-retail/checkout";

/** The card a shopper already entered: the public test number, never a real card. */
const CARD_ON_FILE = "4242424242424242";
/** Written into the password field; Chromium would not select it, and the row must not depend on that. */
const PASSWORD_ON_FILE = "SYNTHETIC_PASSWORD_DO_NOT_USE";
/** An ordinary first name: the control that proves the withholding is targeted. */
const FIRST_NAME_ON_FILE = "Synthetic";

const LOUD = { captureMutations: false, captureInputValues: true, captureSnapshots: true };

/** The page global e2e/content/runtime-stub.ts installs in every frame; harness.ts owns the name and exports none. */
const HARNESS_GLOBAL = "__fluxiqContentHarness";

/** Opens bigbox-retail's checkout -- the sign-in wall, or as a guest the contact details and the card frame -- with the privacy choices declined. */
async function openCheckout(openHarness: (scenarioId: string) => Promise<ContentHarness>, as: "wall" | "guest"): Promise<ContentHarness> {
  const harness = await openHarness("bigbox-retail");
  const operations: Array<[string, object]> = [["consent", { choice: "reject" }]];
  if (as === "guest") operations.push(["start-guest-checkout", {}]);
  for (const [operation, payload] of operations) {
    const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
      method: "POST",
      headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
  }
  await harness.page.goto(new URL(CHECKOUT, harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await expect(harness.page.locator(as === "guest" ? CARD_FRAME : PASSWORD)).toBeVisible();
  return harness;
}

/** The card frame's own content script, spoken to as the background worker speaks to a child frame. */
type FrameChannel = {
  frame: Frame;
  capture(): Promise<DomSnapshot>;
  setRecording(recording: boolean, settings?: HarnessRecordingSettings): Promise<void>;
  messages(): Promise<SentMessage[]>;
};

/** The card frame, with the card already entered, its content script loaded. */
async function cardOnFile(page: Page): Promise<FrameChannel> {
  const frame = await (await page.locator(CARD_FRAME).elementHandle())?.contentFrame();
  if (!frame) throw new Error(`${CARD_FRAME} has no frame.`);
  await frame.waitForFunction((name) => {
    const stub = (window as unknown as Record<string, { sent?: Array<{ type?: string }> } | undefined>)[name];
    return Boolean(stub?.sent?.some((message) => message.type === "fluxiq.contentReady"));
  }, HARNESS_GLOBAL);
  await frame.locator(CARD).fill(CARD_ON_FILE);
  const answer = async (message: Record<string, unknown>, what: string): Promise<unknown> => {
    const delivery = await frame.evaluate(([name, value]) => {
      const stub = (window as unknown as Record<string, { deliver(message: unknown): Promise<HarnessDelivery> } | undefined>)[name];
      if (!stub) throw new Error("The content-harness runtime stub is not installed in the card frame.");
      return stub.deliver(value);
    }, [HARNESS_GLOBAL, message] as const);
    if (!delivery.responded) throw new Error(`The card frame's content script did not answer ${what}.`);
    return delivery.response;
  };
  return {
    frame,
    capture: async () => await answer({ type: "captureSnapshot" }, "captureSnapshot") as DomSnapshot,
    setRecording: async (recording, settings) => {
      await answer({ type: "recording", recording, ...(settings ? { settings } : {}) }, "the recording message");
    },
    messages: async () => await frame.evaluate(
      (name) => (window as unknown as Record<string, { sent: SentMessage[] } | undefined>)[name]?.sent ?? [],
      HARNESS_GLOBAL
    )
  };
}

/**
 * Selects everything inside `selector`'s text control, the way a user's
 * Ctrl+A inside a field does. Done through the DOM rather than the keyboard so
 * the row states exactly what it selected.
 */
async function selectAllInField(frame: Frame, selector: string): Promise<void> {
  await frame.locator(selector).focus();
  await frame.evaluate((target) => {
    const field = document.querySelector(target);
    if (!(field instanceof HTMLInputElement)) throw new Error(`${target} is not an input`);
    field.setSelectionRange(0, field.value.length);
  }, selector);
}

test("a select-all inside the card field never reaches the snapshot", async ({ openHarness, page }) => {
  await openCheckout(openHarness, "guest");
  const card = await cardOnFile(page);

  await selectAllInField(card.frame, CARD);
  // The premise: the browser really does report the card's digits as the selection.
  expect(await card.frame.evaluate(() => window.getSelection()?.toString() ?? "")).toContain(CARD_ON_FILE);
  const snapshot = await card.capture();

  expect(snapshot.selectedText, "the selection came out of a sensitive control and must be withheld").toBeUndefined();
  expect(JSON.stringify(snapshot)).not.toContain(CARD_ON_FILE);
});

test("a select-all inside the card field never reaches a recorded snapshot either", async ({ openHarness, page }) => {
  await openCheckout(openHarness, "guest");
  const card = await cardOnFile(page);

  await card.setRecording(true, LOUD);
  await selectAllInField(card.frame, CARD);
  // A bare modifier is the one interaction that makes the recorder attach a
  // snapshot (`content/snapshots.ts` attaches one to `dom.keydown`) without
  // disturbing the selection that is being tested.
  await page.keyboard.press("Shift");
  await card.setRecording(false);

  const recorded = (await card.messages())
    .filter((message) => message.type === "fluxiq.contentEvent")
    .map((message) => message.payload as RecordingEventPayload)
    .filter((event) => event.kind === "dom.keydown");
  // Without this the row could pass by recording nothing at all.
  expect(recorded.some((event) => event.snapshot !== undefined), "no recorded event carried a snapshot").toBe(true);
  expect(JSON.stringify(await card.messages())).not.toContain(CARD_ON_FILE);
});

test("a selection that touches no sensitive control still reaches the snapshot", async ({ openHarness, page }) => {
  const harness = await openCheckout(openHarness, "guest");
  await page.evaluate(() => {
    const heading = document.querySelector("main h1");
    if (!heading) throw new Error("checkout has no heading");
    window.getSelection()?.selectAllChildren(heading);
  });

  const snapshot = await harness.capture();
  expect(snapshot.selectedText, "an ordinary page selection is evidence and must survive").toContain("Checkout");
});

test("a select-all inside an ordinary field still reaches the snapshot", async ({ openHarness, page }) => {
  const harness = await openCheckout(openHarness, "guest");
  await page.locator(FIRST_NAME).fill(FIRST_NAME_ON_FILE);
  await selectAllInField(page.mainFrame(), FIRST_NAME);

  const snapshot = await harness.capture();
  expect(snapshot.selectedText).toContain(FIRST_NAME_ON_FILE);
});

test("a selection that runs across the card form and over the card field is withheld", async ({ openHarness, page }) => {
  await openCheckout(openHarness, "guest");
  const card = await cardOnFile(page);

  // From before the form's first words to after its last control, with focus
  // elsewhere, so only the range itself reaches the card field.
  await card.frame.evaluate(() => {
    const form = document.querySelector("form");
    if (!form) throw new Error("the card frame has no form");
    (document.activeElement as HTMLElement | null)?.blur();
    const range = document.createRange();
    range.setStartBefore(form);
    range.setEndAfter(form);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  // The premise: there is a selection to withhold, the form's own words.
  expect(await card.frame.evaluate(() => window.getSelection()?.toString() ?? "")).toContain("Card number");

  const snapshot = await card.capture();
  expect(snapshot.selectedText, "the selection reaches into a sensitive control and must be withheld").toBeUndefined();
  expect(JSON.stringify(snapshot)).not.toContain(CARD_ON_FILE);
});

test("a selection that starts at the sign-in heading and runs over the password field is withheld", async ({ openHarness, page }) => {
  const harness = await openCheckout(openHarness, "wall");
  await page.locator(PASSWORD).fill(PASSWORD_ON_FILE);

  // The heading and the password field share the sign-in card. Chromium would
  // not put the password's contents in this selection, which is exactly why
  // the rule may not depend on it (`dom-snapshot.ts`, question 3).
  await page.evaluate((password) => {
    const heading = document.querySelector("main h1");
    const field = document.querySelector(password);
    if (!heading || !field) throw new Error("the sign-in wall is missing its heading or its password field");
    (document.activeElement as HTMLElement | null)?.blur();
    const range = document.createRange();
    range.setStartBefore(heading);
    range.setEndAfter(field);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, PASSWORD);
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toContain("Sign in or create your account");

  const snapshot = await harness.capture();
  expect(snapshot.selectedText, "the selection reaches into a sensitive control and must be withheld").toBeUndefined();
  expect(JSON.stringify(snapshot)).not.toContain(PASSWORD_ON_FILE);
});

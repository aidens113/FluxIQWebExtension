// `web.dom.extract_list` beside sensitive controls: what a read may never carry
// off the page, and what it may.
//
// What these rows are really proving:
// - a field that resolves to a sensitive control, or to an element inside one
//   such as its option, refuses the whole read;
// - a text field skips the contents of sensitive controls inside it, keeping
//   the words around them;
// - an excluded field is never read, so excluding a sensitive control's value
//   leaves the read to succeed while reading it refuses the whole read (D12);
// - an ordinary control beside a sensitive one is still read in full, so a
//   blanket drop fails these rows as surely as a leak does.
//
// Every row searches the whole reply, its page snapshot included, for the
// secrets on the page.
//
// The realistic rows (t730) read bigbox-retail's checkout: the sign-in wall,
// whose "Password" is `type="password"` beside an ordinary "Email address", and
// the payment provider's cross-origin card frame, whose "Card number" and
// "Expiration" carry `autocomplete="cc-number"` and `"cc-exp"`. The harness
// answers through the top frame only, so the card row talks to the frame's own
// content script. The site pre-fills nothing; every value is synthetic.
//
// The last two rows (t730 C2) need a sensitive `<select>` and a sensitive
// `<textarea>`: they read the "Forgot your password?" panel bigbox-retail's
// sign-in wall opens when armed into its `account-recovery` rendering.

import type { Page } from "@playwright/test";
import { ACCOUNT_RECOVERY_VALUES } from "../../../../../../scenario-lab/src/scenarios/bigbox-retail/index.js";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test, type ContentHarness, type HarnessDelivery } from "../../../index.js";

const CHECKOUT = "/scenarios/bigbox-retail/checkout";
const CARD_FRAME = 'iframe[title="Secure card entry"]';
/** The sign-in card: the one block on the wall that holds the heading and both fields. */
const SIGN_IN = "main div:has(> h1)";
const PASSWORD = 'input[name="password"]';
const EMAIL = 'input[name="email"]';

/** The public test card number and a synthetic expiry, never a real card. */
const CARD_ON_FILE = "4242424242424242";
const EXPIRY_ON_FILE = "04/39";
const PASSWORD_ON_FILE = "SYNTHETIC_PASSWORD_DO_NOT_USE";
/** Ordinary page content, not a secret: the control that proves a read is targeted. */
const SHOPPER_EMAIL = "synthetic-shopper@example.test";

/** The page global e2e/content/runtime-stub.ts installs in every frame; harness.ts owns the name and exports none. */
const HARNESS_GLOBAL = "__fluxiqContentHarness";
/** A child frame id, as the background worker addresses one. The frame reads only "not the top one". */
const A_CHILD_FRAME = 1;

/** Opens bigbox-retail's checkout -- the sign-in wall, or as a guest the card frame -- with the privacy choices declined. */
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

/** Runs one action in the card frame, as the background worker addresses a child frame, with the card already entered. */
async function inCardFrame(page: Page): Promise<(command: BrowserActionCommand) => Promise<BrowserActionResult>> {
  const frame = await (await page.locator(CARD_FRAME).elementHandle())?.contentFrame();
  if (!frame) throw new Error(`${CARD_FRAME} has no frame.`);
  await frame.waitForFunction((name) => {
    const stub = (window as unknown as Record<string, { sent?: Array<{ type?: string }> } | undefined>)[name];
    return Boolean(stub?.sent?.some((message) => message.type === "fluxiq.contentReady"));
  }, HARNESS_GLOBAL);
  await frame.locator('input[name="cardnumber"]').fill(CARD_ON_FILE);
  await frame.locator('input[name="exp"]').fill(EXPIRY_ON_FILE);
  return async (command) => {
    const message: Record<string, unknown> = { type: "executeAction", action: { ...command, frameId: A_CHILD_FRAME }, frameId: A_CHILD_FRAME };
    const delivery = await frame.evaluate(([name, value]) => {
      const stub = (window as unknown as Record<string, { deliver(message: unknown): Promise<HarnessDelivery> } | undefined>)[name];
      if (!stub) throw new Error("The content-harness runtime stub is not installed in the card frame.");
      return stub.deliver(value);
    }, [HARNESS_GLOBAL, message] as const);
    if (!delivery.responded) throw new Error(`The card frame's content script did not answer ${command.commandId}.`);
    return delivery.response as BrowserActionResult;
  };
}

/** The sign-in wall with both fields filled. */
async function signInFilled(openHarness: (scenarioId: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openCheckout(openHarness, "wall");
  await harness.page.locator(EMAIL).fill(SHOPPER_EMAIL);
  await harness.page.locator(PASSWORD).fill(PASSWORD_ON_FILE);
  return harness;
}

test.describe("on bigbox-retail checkout", () => {
  test("a field that resolves to a sensitive control refuses the whole read", async ({ openHarness, page }) => {
    await openCheckout(openHarness, "guest");
    const runAction = await inCardFrame(page);
    // Each of the card form's labels wraps its control; two of the three are sensitive.
    const reply = await runAction({
      commandId: "extract-card-fields",
      actionType: "web.dom.extract_list",
      extractList: { item: "form label", fields: { value: "input@value" } }
    });
    expect(reply).toMatchObject({
      status: "failed",
      failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" }
    });
    expect(reply).not.toHaveProperty("extracted");
    const wire = JSON.stringify(reply);
    for (const secret of [CARD_ON_FILE, EXPIRY_ON_FILE]) expect(wire).not.toContain(secret);
  });

  test("a value field refuses a sensitive control and reads an ordinary one", async ({ openHarness }) => {
    const harness = await signInFilled(openHarness);
    const refused = await harness.runAction({
      commandId: "extract-sensitive-value",
      actionType: "web.dom.extract_list",
      extractList: { item: SIGN_IN, fields: { password: { kind: "value", selector: PASSWORD } } }
    });
    expect(refused).toMatchObject({ status: "failed", failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" } });
    expect(refused).not.toHaveProperty("extracted");
    expect(JSON.stringify(refused)).not.toContain(PASSWORD_ON_FILE);

    const read = await harness.runAction({
      commandId: "extract-ordinary-value",
      actionType: "web.dom.extract_list",
      extractList: { item: SIGN_IN, fields: { email: { kind: "value", selector: EMAIL } } }
    });
    expect(read).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(read.extracted).toEqual([{ email: SHOPPER_EMAIL }]);
    expect(JSON.stringify(read)).not.toContain(PASSWORD_ON_FILE);
  });

  test("an excluded field is never read, so excluding a sensitive control leaves the read to succeed", async ({ openHarness }) => {
    const harness = await signInFilled(openHarness);
    const reply = await harness.runAction({
      commandId: "extract-excluded-sensitive",
      actionType: "web.dom.extract_list",
      extractList: {
        item: SIGN_IN,
        fields: {
          email: { kind: "value", selector: EMAIL },
          password: { kind: "value", selector: PASSWORD, handling: "exclude" }
        }
      }
    });
    // Reading the excluded field would refuse the whole read, as the row above
    // shows. The read succeeding is what proves it was never read.
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", expected: "at least 1 record, each carrying email" },
      extraction: { recordCount: 1, fieldNames: ["email"] }
    });
    expect(reply.extracted).toEqual([{ email: SHOPPER_EMAIL }]);
    expect(JSON.stringify(reply)).not.toContain(PASSWORD_ON_FILE);
  });
});

/** Everything the "Forgot your password?" panel shows that the page itself marks hidden; no reply may carry any. */
const PANEL_SECRETS = [
  ...ACCOUNT_RECOVERY_VALUES.securityAnswers.flatMap((answer) => [answer.value, answer.label]),
  ACCOUNT_RECOVERY_VALUES.passwordHint, ACCOUNT_RECOVERY_VALUES.oneTimeCode.value, ACCOUNT_RECOVERY_VALUES.oneTimeCode.label,
  ACCOUNT_RECOVERY_VALUES.resetEmail, ACCOUNT_RECOVERY_VALUES.savedCardsHeading, ACCOUNT_RECOVERY_VALUES.cardColumn,
  ACCOUNT_RECOVERY_VALUES.billingAddress, ACCOUNT_RECOVERY_VALUES.nicknameCard, ACCOUNT_RECOVERY_VALUES.billingZip
];
/** The panel's "Confirm it's you" group: three labels, each wrapping a control and naming the button beside it. */
const CONFIRM_LABELS = '[role="group"][aria-label="Confirm it\'s you"] label';
const CODE_SELECT = 'select[name="verificationCode"]';

/**
 * Opens bigbox-retail's checkout armed into its `account-recovery` rendering:
 * the sign-in wall with the "Forgot your password?" panel open beside it, the
 * privacy choices declined.
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
  await harness.page.goto(new URL(CHECKOUT, harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await expect(harness.page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
  return harness;
}

// The panel holds a sensitive <select> -- the verification code, marked by its
// `autocomplete="one-time-code"` -- and a sensitive <textarea>, the saved
// password hint marked `data-sensitive`, each inside a label.
test.describe("on bigbox-retail's account-recovery panel", () => {
  test("a field that resolves inside a sensitive control, such as one of its options, refuses the whole read", async ({ openHarness }) => {
    const harness = await openAccountRecovery(openHarness);
    // An option carries its sensitive select's value and label, so reading the
    // option is reading the control (decision D2).
    const reads = [
      { why: "an option's text", item: `${CONFIRM_LABELS}:has(${CODE_SELECT})`, fields: { code: "option" } },
      { why: "an option's value attribute", item: `${CONFIRM_LABELS}:has(${CODE_SELECT})`, fields: { code: "option@value" } },
      { why: "an item that is itself an option", item: `${CODE_SELECT} option`, fields: { code: "" } }
    ];
    for (const [index, { why, item, fields }] of reads.entries()) {
      const reply = await harness.runAction({
        commandId: `extract-inside-sensitive-${index}`,
        actionType: "web.dom.extract_list",
        extractList: { item, fields }
      });
      expect(reply, why).toMatchObject({
        status: "failed",
        failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" }
      });
      expect(reply, why).not.toHaveProperty("extracted");
      const wire = JSON.stringify(reply);
      for (const secret of PANEL_SECRETS) expect(wire, why).not.toContain(secret);
    }
  });

  test("a text field skips the contents of sensitive controls inside it", async ({ openHarness }) => {
    const harness = await openAccountRecovery(openHarness);
    const reply = await harness.runAction({
      commandId: "extract-label-text",
      actionType: "web.dom.extract_list",
      extractList: { item: CONFIRM_LABELS, fields: { label: "" } }
    });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    // The hint's textarea and the code's select are left out; the ordinary
    // select's words stay, so the reader skips sensitive controls rather than
    // every control.
    expect(reply.extracted).toEqual(["Password hint", "Verification code", "Send codes by Text message"].map((label) => ({ label })));
    // The whole reply, its page snapshot included: no element descriptor quotes
    // a sensitive control's contents either.
    const wire = JSON.stringify(reply);
    for (const secret of PANEL_SECRETS) expect(wire).not.toContain(secret);
  });
});

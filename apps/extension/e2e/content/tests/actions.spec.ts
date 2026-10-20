// Every action type the content script executes, once, on a real page: the
// reply the background worker receives and what changed on the page.
//
// Since Phase 1.2 step 1 every reply also carries a `validation`: `passed` or
// `failed` with what was compared, or `none` with a reason -- `evidence-only`
// for a verb that only observes, `not-yet-validated` for one whose
// post-condition is still to be written. A wait that runs out of time now
// reports `timed_out` rather than `failed`.
//
// The rows below pin the behaviour Wave 2 established, not the audit baseline
// it replaced: type enters text one character at a time and validates that the
// field kept it, an untrusted Enter performs the default action a trusted one
// would so the form submits, and a select asked for an option it does not have
// changes nothing and reports `output_not_observed`. Each verb's own spec --
// keyboard.spec.ts, select.spec.ts, waits.spec.ts and the rest -- covers it in
// depth; this file keeps one row per action type, so a verb that breaks
// outright is caught here.
//
// Pages (t730: browser specs open only the ten realistic scenarios). The
// everything-store home page holds every construct the rows need: the header's
// search box and its "Search in" department select, and the footer's
// newsletter form, which the store handles in place -- its submit is
// cancelled, the address is sent to the server, and the form is replaced with
// a thank-you -- so a submitted form can be observed on the same document and
// in the store's own state. The store's app banner, inserted two seconds after
// a page loads, is the element a wait observes arrive. Its consent banner, app
// banner and notifications prompt are otherwise answered first through the
// store's `/api` mutations. The sensitive rows read photo-social's login page
// under its `saved-logins` rendering, armed through `set-mode`, where the
// device remembers its accounts: the form comes pre-filled, its password
// served in the field's `value` attribute, and offers a marked password hint
// and security answer, and a marked list box of login codes and a marked
// recovery note stand below it. The spec writes nothing into the page; the
// only value it supplies is a card number typed into the Verified payment
// form's own field, as a person types it.

import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";
import type { DomElementDescriptor } from "../../../src/shared/protocol.js";
import { createStoreState } from "../../../../scenario-lab/src/scenarios/everything-store/state/index.js";
import { SAVED_LOGINS_VALUES } from "../../../../scenario-lab/src/scenarios/photo-social/index.js";

const STORE = "/scenarios/everything-store/";
const SEARCH_BOX = 'input[name="k"]';
const DEPARTMENT = 'select[name="i"]';
const NEWSLETTER = "form[data-newsletter]";
const NEWSLETTER_EMAIL = 'form[data-newsletter] input[name="email"]';
const SUBSCRIBE = 'form[data-newsletter] button[type="submit"]';
const CART_COUNT = '[data-testid="cart-count"]';
const APP_BANNER = '[aria-label="Brightaisle app"]';
const THANKS = "Thanks! Check your inbox to confirm.";
/** The store's own home-page title. */
const STORE_TITLE = "Brightaisle.com. Spend less. Smile more.";

type StoreFacts = { newsletter: "none" | "subscribed"; guard: { flagged: string | null } };

/** Sends one of the scenario's own page mutations, as its page script would. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${harness.scenarioId} answered ${response.status} to ${operation}.`);
}

/** Opens the store's home page with consent given and the app banner and notifications prompt answered. */
async function openCalmStore(openHarness: (id: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openHarness("everything-store");
  await mutate(harness, "consent", { choice: "accept" });
  await mutate(harness, "dismiss-nudge", { nudge: "app-banner" });
  await mutate(harness, "dismiss-nudge", { nudge: "notifications" });
  await harness.page.goto(new URL(STORE, harness.lab.origin).href);
  return harness;
}

const storeFacts = async (harness: ContentHarness): Promise<StoreFacts> => (await harness.finalState()).state as unknown as StoreFacts;

/** Whether the selector a reply reports names the element the request named; on a site without test ids the content script reports its own. */
async function sameElement(page: Page, reported: string | undefined, requested: string): Promise<boolean> {
  if (!reported) return false;
  return await page.evaluate(([a, b]) => {
    const found = document.querySelector(a);
    return found !== null && found === document.querySelector(b);
  }, [reported, requested] as const);
}

/** The snapshot's descriptor for the element `selector` names on the page, matched by the selector each descriptor carries. */
async function descriptorOf(page: Page, elements: readonly DomElementDescriptor[], selector: string): Promise<DomElementDescriptor | undefined> {
  for (const element of elements) {
    if (await sameElement(page, element.selector, selector)) return element;
  }
  return undefined;
}

/** Records which of `types` reach `selector` from now on, and whether each was trusted. */
async function watchEvents(page: Page, selector: string, types: string[]): Promise<() => Promise<string[]>> {
  await page.locator(selector).evaluate((element, eventTypes) => {
    const seen: string[] = [];
    (window as unknown as { __harnessSeenEvents: string[] }).__harnessSeenEvents = seen;
    for (const type of eventTypes) {
      element.addEventListener(type, (event) => {
        const key = event instanceof KeyboardEvent ? `:${event.key}` : "";
        seen.push(`${event.type}${key}:${event.isTrusted ? "trusted" : "untrusted"}`);
      });
    }
  }, types);
  return () => page.evaluate(() => (window as unknown as { __harnessSeenEvents: string[] }).__harnessSeenEvents);
}

test("captureSnapshot request: answers with the page and its interactive elements", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  const snapshot = await harness.capture();
  expect(snapshot).toMatchObject({ url: new URL(STORE, harness.lab.origin).href, title: STORE_TITLE });
  for (const selector of [SEARCH_BOX, DEPARTMENT, NEWSLETTER_EMAIL, SUBSCRIBE]) {
    expect(await descriptorOf(page, snapshot.interactiveElements, selector), selector).toBeDefined();
  }
});

test("capture_snapshot: succeeds with the snapshot and changes nothing", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  const reply = await harness.runAction({ commandId: "capture", actionType: "web.dom.capture_snapshot" });
  expect(reply).toMatchObject({
    commandId: "capture",
    actionType: "web.dom.capture_snapshot",
    status: "succeeded",
    validation: { status: "none", reason: "evidence-only" },
    message: "Snapshot captured.",
    url: new URL(STORE, harness.lab.origin).href,
    title: STORE_TITLE
  });
  for (const selector of [SEARCH_BOX, DEPARTMENT, NEWSLETTER_EMAIL, SUBSCRIBE]) {
    expect(await descriptorOf(page, reply.snapshot?.interactiveElements ?? [], selector), selector).toBeDefined();
  }
  await expect(page.locator(NEWSLETTER)).toBeVisible();
  expect((await storeFacts(harness)).newsletter).toBe("none");
});

test("type with submit: enters the text, then presses Enter, and the form is sent as a person's Enter sends it (t193)", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  const reply = await harness.runAction({ commandId: "type-submit", actionType: "web.dom.type", selector: NEWSLETTER_EMAIL, text: "ada@example.test", submit: true });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" }, message: "Text entered, then Enter pressed in the field." });
  await expect(page.getByText(THANKS)).toBeVisible();
  await expect.poll(async () => (await storeFacts(harness)).newsletter).toBe("subscribed");
});

test("type: enters the text per character and validates that the field kept it", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  const seen = await watchEvents(page, NEWSLETTER_EMAIL, ["input", "change"]);
  const reply = await harness.runAction({ commandId: "type", actionType: "web.dom.type", selector: NEWSLETTER_EMAIL, text: "Ada" });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: 'the field holds "Ada"', actual: 'the field holds "Ada"' },
    // The field is in the form, and typing does not send it (t193 run 37): the result says so and names the form's own button.
    message: `Text entered. Typing pressed no other key, so the field's form was not sent: if the page has not answered the text, press its "Subscribe" button (or Enter in the field) to send it, or type with submit set to true.`
  });
  expect(await sameElement(page, reply.element?.selector, NEWSLETTER_EMAIL)).toBe(true);
  await expect(page.locator(NEWSLETTER_EMAIL)).toHaveValue("Ada");
  // One input per character since w2-keyboard-input, so a widget that filters per keystroke sees each one.
  expect(await seen()).toEqual(["input:untrusted", "input:untrusted", "input:untrusted", "change:untrusted"]);
  expect((await storeFacts(harness)).newsletter).toBe("none");
});

test("clear: empties the field", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  await page.locator(SEARCH_BOX).fill("draft");
  const reply = await harness.runAction({ commandId: "clear", actionType: "web.dom.clear", selector: SEARCH_BOX });
  expect(reply).toMatchObject({ status: "succeeded", message: "Field cleared." });
  expect(await sameElement(page, reply.element?.selector, SEARCH_BOX)).toBe(true);
  await expect(page.locator(SEARCH_BOX)).toHaveValue("");
});

test("select: chooses the option and reports it on the element", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  const reply = await harness.runAction({ commandId: "select", actionType: "web.dom.select", selector: DEPARTMENT, value: "electronics" });
  expect(reply).toMatchObject({ status: "succeeded", message: "Option selected.", element: { selectedValue: "electronics" } });
  expect(await sameElement(page, reply.element?.selector, DEPARTMENT)).toBe(true);
  await expect(page.locator(DEPARTMENT)).toHaveValue("electronics");
});

test("select: a value with no option changes nothing and reports output_not_observed", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  const reply = await harness.runAction({ commandId: "select-missing", actionType: "web.dom.select", selector: DEPARTMENT, value: "platinum" });
  expect(reply).toMatchObject({
    status: "failed",
    message: 'No option matched value "platinum".',
    failure: { category: "output_not_observed" }
  });
  // The select keeps the option it started on, rather than being blanked.
  await expect(page.locator(DEPARTMENT)).toHaveValue("all");
});

test("click: submits the filled form, which the store records", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  await harness.runAction({ commandId: "fill-email", actionType: "web.dom.type", selector: NEWSLETTER_EMAIL, text: "ada@example.test" });
  const reply = await harness.runAction({ commandId: "click", actionType: "web.dom.click", selector: SUBSCRIBE });
  expect(reply).toMatchObject({ status: "succeeded", message: "Element clicked." });
  await expect(page.getByText(THANKS)).toBeVisible();
  // The store took the address, and the off-screen "Website" honeypot beside it was left alone.
  await expect.poll(async () => await storeFacts(harness)).toMatchObject({ newsletter: "subscribed", guard: { flagged: null } });
});

test("scroll: moves the window to the requested offset", async ({ openHarness, page }) => {
  await page.setViewportSize({ width: 800, height: 200 });
  const harness = await openCalmStore(openHarness);
  expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeGreaterThanOrEqual(60);
  const reply = await harness.runAction({ commandId: "scroll", actionType: "web.dom.scroll", options: { x: 0, y: 60 } });
  expect(reply).toMatchObject({ status: "succeeded", message: "Page scrolled.", snapshot: { viewport: { scrollX: 0, scrollY: 60 } } });
  expect(await page.evaluate(() => window.scrollY)).toBe(60);
});

test("keypress: an untrusted Enter performs the default action a trusted one would, so the form submits", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  await page.locator(NEWSLETTER_EMAIL).fill("ada@example.test");
  const seen = await watchEvents(page, NEWSLETTER_EMAIL, ["keydown", "keyup"]);
  const reply = await harness.runAction({ commandId: "keypress", actionType: "web.dom.keypress", selector: NEWSLETTER_EMAIL, key: "Enter" });
  expect(reply).toMatchObject({
    status: "succeeded",
    // The newsletter form has no id or test id to name it by, so the expectation names no selector.
    validation: { status: "passed", expected: "Enter submits the form" },
    message: "Key pressed.",
    // The store replaced the form with its thank-you, so the field is described rather than found again.
    element: { tagName: "input", inputType: "email" }
  });
  // The events are still untrusted; w2-keyboard-input emulates the default action the browser withholds.
  expect(await seen()).toEqual(["keydown:Enter:untrusted", "keyup:Enter:untrusted"]);
  await expect(page.getByText(THANKS)).toBeVisible();
  await expect.poll(async () => (await storeFacts(harness)).newsletter).toBe("subscribed");
});

test("wait_for_selector: succeeds when a matching element appears (the store's app banner, two seconds in)", async ({ openHarness, page }) => {
  const harness = await openHarness("everything-store");
  await page.reload();
  await expect(page.locator(APP_BANNER), "the banner has not arrived yet").toHaveCount(0);
  const reply = await harness.runAction({ commandId: "wait-selector", actionType: "web.dom.wait_for_selector", selector: APP_BANNER, timeoutMs: 5_000 });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", actual: "the element was found" },
    message: "Selector found."
  });
  expect(await sameElement(page, reply.element?.selector, APP_BANNER)).toBe(true);
});

test("wait_for_selector: a timeout reports timed_out with Core's timeout category", async ({ openHarness }) => {
  const harness = await openCalmStore(openHarness);
  const reply = await harness.runAction({ commandId: "wait-never", actionType: "web.dom.wait_for_selector", selector: '[data-testid="never"]', timeoutMs: 100 });
  expect(reply).toMatchObject({
    status: "timed_out",
    message: 'Timed out waiting for selector: [data-testid="never"]',
    // The recovery account (recovery/account.ts, since 36daa680): the wait spent
    // its own timeout, so the defence was reached with no budget left to retry.
    validation: { status: "failed", actual: "no element matched before the timeout; the execution did not recover within its 1 attempt after absorbing timeout, waiting 0 ms" },
    failure: { category: "timeout", code: "web.action.timeout", retryable: true }
  });
});

test("wait_for_text: succeeds when the text appears (the store's app banner, two seconds in)", async ({ openHarness, page }) => {
  const harness = await openHarness("everything-store");
  await page.reload();
  await expect(page.getByText("Shop faster with the Brightaisle app"), "the banner has not arrived yet").toHaveCount(0);
  const reply = await harness.runAction({ commandId: "wait-text", actionType: "web.dom.wait_for_text", text: "Shop faster with the Brightaisle app", timeoutMs: 5_000 });
  expect(reply).toMatchObject({ status: "succeeded", message: "Text found." });
  expect(reply.element).toBeUndefined();
});

test("extract: text by default, one attribute, or a field's value", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  // The header badge counts the account's cart as the store created it.
  const count = String(createStoreState(0).cart.reduce((sum, line) => sum + line.quantity, 0));
  expect(await harness.runAction({ commandId: "extract-text", actionType: "web.dom.extract", selector: CART_COUNT }))
    .toMatchObject({
      status: "succeeded",
      validation: { status: "none", reason: "evidence-only" },
      message: "Value extracted.",
      extracted: count,
      element: { selector: CART_COUNT }
    });
  expect(await harness.runAction({ commandId: "extract-attribute", actionType: "web.dom.extract", selector: `a:has(> ${CART_COUNT})`, options: { mode: "attribute", attribute: "aria-label" } }))
    .toMatchObject({ status: "succeeded", extracted: `${count} items in cart` });
  await page.locator(SEARCH_BOX).fill("kettle");
  expect(await harness.runAction({ commandId: "extract-value", actionType: "web.dom.extract", selector: SEARCH_BOX }))
    .toMatchObject({ status: "succeeded", extracted: "kettle" });
});

/** photo-social's two forms that hold secrets: the login behind "Switch accounts", and the Verified payment page. */
const LOGIN = "/scenarios/photo-social/accounts/login/";
const SUBSCRIBE_PAGE = "/scenarios/photo-social/verified/subscribe/";
const LOGIN_FORM = 'form:has(input[name="password"])';
const PASSWORD = 'input[name="password"]';
const USERNAME = 'input[name="username"]';
const CARD = 'input[autocomplete="cc-number"]';
/** Typed into the Verified payment form's card number field, as a person types it; no reply may carry it. */
const CARD_SECRET = "4111111111111111";

/** Every way `web.dom.extract` reads: text or a live value by default, one attribute, and inner HTML. */
const EXTRACT_MODES = [undefined, { mode: "attribute", attribute: "value" }, { mode: "html" }] as const;

/**
 * Opens photo-social's login page under its `saved-logins` rendering, armed
 * through `set-mode` as every rendering is: the device remembers its accounts,
 * so the form comes pre-filled with the remembered sign-in, its password served
 * in the field's `value` attribute, and offers a marked password hint (a
 * textarea, inside a label that names a "Show" control by reference), a marked
 * security answer (a select) and an ordinary "Stay logged in" select. Below it
 * stand a marked list box of recent login codes and a marked editable recovery
 * note holding a phone number in a `<data>` value.
 */
async function openSavedLogins(openHarness: (id: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openHarness("photo-social");
  await mutate(harness, "set-mode", { mode: "saved-logins" });
  await harness.page.goto(new URL(LOGIN, harness.lab.origin).href);
  return harness;
}

const HINT = 'textarea[name="passwordHint"]';
const ANSWER = 'select[name="securityAnswer"]';
const STAY_LOGGED_IN = 'select[name="stayLoggedIn"]';
/** The "Show" control the hint's label names by reference. */
const SHOW_HINT = `${LOGIN_FORM} [role="button"][aria-labelledby]`;
const RECOVERY_NOTE = '[contenteditable="true"][aria-label="Recovery note"]';
const V = SAVED_LOGINS_VALUES;
/** Everything the `saved-logins` page itself keeps hidden; no reply may carry any of it. */
const SAVED_LOGIN_SECRETS = [
  V.password, V.passwordHint, V.securityAnswer.value, V.securityAnswer.label,
  ...V.accounts.map((account) => account.password), ...V.backupCodes, ...V.loginCodes,
  V.recoveryNote.words, V.recoveryNote.contact, V.recoveryNote.phone
];
/** What a text read of the `saved-logins` login form gives. */
const FORM_TEXT = "Log inSorry, your password was incorrect. Please double-check your password.Password hint Show Security question Stay logged in For 30 days";

test("extract: a sensitive control is refused in every mode (photo-social's password and card number)", async ({ openHarness, page }) => {
  // The `saved-logins` form serves the remembered password in the field's
  // `value` attribute, so the attribute and HTML reads have a secret to withhold.
  const harness = await openSavedLogins(openHarness);
  const refuse = async (selector: string): Promise<void> => {
    for (const options of EXTRACT_MODES) {
      const label = `${selector} read ${options ? JSON.stringify(options) : "by default"}`;
      const reply = await harness.runAction({ commandId: "extract-sensitive", actionType: "web.dom.extract", selector, ...(options ? { options } : {}) });
      expect(reply, label).toMatchObject({
        status: "failed",
        failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" }
      });
      expect(reply, label).not.toHaveProperty("extracted");
      const wire = JSON.stringify(reply);
      for (const secret of [...SAVED_LOGIN_SECRETS, CARD_SECRET]) expect(wire, label).not.toContain(secret);
    }
  };
  await refuse(PASSWORD);
  // The rule is targeted: the form's ordinary username field is still read.
  expect(await harness.runAction({ commandId: "extract-username", actionType: "web.dom.extract", selector: USERNAME }))
    .toMatchObject({ status: "succeeded", extracted: V.username });

  await page.goto(new URL(SUBSCRIBE_PAGE, harness.lab.origin).href);
  await page.locator(CARD).fill(CARD_SECRET);
  await refuse(CARD);
});

test("extract: a text read of a container skips the contents of sensitive controls inside it", async ({ openHarness }) => {
  const harness = await openSavedLogins(openHarness);
  const reply = await harness.runAction({ commandId: "extract-form-text", actionType: "web.dom.extract", selector: LOGIN_FORM });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "none", reason: "evidence-only" } });
  // The form's own words and every label and the ordinary select's option are
  // read; the marked hint's text and the marked answer's option are not. The
  // page's fields carry their names as attributes, not text; the read takes
  // the words the markup holds, so the form's hidden error line is read too,
  // run on from "Log in" as the markup runs it on.
  expect(reply.extracted).toBe(FORM_TEXT);
  // The whole reply, its page snapshot included: no element descriptor quotes
  // a sensitive control's contents either.
  const wire = JSON.stringify(reply);
  for (const secret of SAVED_LOGIN_SECRETS) expect(wire).not.toContain(secret);
});

test("extract: an HTML read of a container removes sensitive descendants' value attributes and contents", async ({ openHarness }) => {
  const harness = await openSavedLogins(openHarness);
  const reply = await harness.runAction({ commandId: "extract-form-html", actionType: "web.dom.extract", selector: LOGIN_FORM, options: { mode: "html" } });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "none", reason: "evidence-only" } });
  const html = String(reply.extracted);
  // The sensitive controls are still in the markup, emptied of what they hold:
  // the password loses the remembered value it was served with.
  expect(html).toMatch(/<input class="[^"]+" name="password" type="password" aria-label="Password" placeholder="Password" autocomplete="current-password">/u);
  expect(html).toMatch(/<textarea class="[^"]+" name="passwordHint" data-sensitive="true" rows="1" readonly=""><\/textarea>/u);
  expect(html).toMatch(/<select class="[^"]+" name="securityAnswer" data-sensitive="true"><\/select>/u);
  // Ordinary controls keep their contents.
  expect(html).toMatch(/<input class="[^"]+" name="username" aria-label="Phone number, username, or email"[^>]* value="tamsin\.reyes">/u);
  expect(html).toContain('<option value="30-days">For 30 days</option>');
  // The whole reply, its page snapshot included: no element descriptor quotes
  // a sensitive control's contents either.
  const wire = JSON.stringify(reply);
  for (const secret of SAVED_LOGIN_SECRETS) expect(wire).not.toContain(secret);
});

test("extract: an element inside a sensitive control is refused in every mode, as the control is", async ({ openHarness }) => {
  const harness = await openSavedLogins(openHarness);
  // An option of a marked select holds the select's value and a label; the
  // `<data>` inside the marked recovery note holds a name and a phone number
  // in its `value` attribute.
  for (const selector of [`${ANSWER} option`, `${RECOVERY_NOTE} data`]) {
    for (const options of EXTRACT_MODES) {
      const label = `${selector} read ${options ? JSON.stringify(options) : "by default"}`;
      const reply = await harness.runAction({ commandId: "extract-inside-sensitive", actionType: "web.dom.extract", selector, ...(options ? { options } : {}) });
      expect(reply, label).toMatchObject({ status: "failed", failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" } });
      expect(reply, label).not.toHaveProperty("extracted");
      const wire = JSON.stringify(reply);
      for (const secret of SAVED_LOGIN_SECRETS) expect(wire, label).not.toContain(secret);
    }
  }
  // The rule is targeted: an ordinary select's option is still read.
  expect(await harness.runAction({
    commandId: "extract-ordinary-option", actionType: "web.dom.extract", selector: `${STAY_LOGGED_IN} option`, options: { mode: "attribute", attribute: "value" }
  })).toMatchObject({ status: "succeeded", extracted: "30-days" });
});

test("capture_snapshot: no descriptor quotes a sensitive control's contents, and a container's text leaves them out", async ({ openHarness, page }) => {
  const harness = await openSavedLogins(openHarness);
  const snapshot = await harness.capture();
  const reply = await harness.runAction({ commandId: "capture-sensitive", actionType: "web.dom.capture_snapshot" });
  expect(reply).toMatchObject({ status: "succeeded" });
  // The whole of both: every descriptor, the page evidence, and the reply
  // around them. The marked list box's options render, so they could be
  // described on their own; the recovery note is a marked editable region; the
  // "Show" control is named through a label holding the marked hint.
  expect(reply.snapshot?.interactiveElements.length ?? 0).toBeGreaterThan(0);
  for (const wire of [JSON.stringify(snapshot), JSON.stringify(reply)]) {
    for (const secret of SAVED_LOGIN_SECRETS) expect(wire).not.toContain(secret);
  }

  const elements = snapshot.interactiveElements;
  const labelReading = (words: string) => elements.find((element) => element.tagName === "label" && element.text?.startsWith(words));
  // The page's own password field is described by its name and never its value.
  expect(await descriptorOf(page, elements, PASSWORD)).toMatchObject({ accessibleName: "Password" });
  // A sensitive control gives no text, and keeps the name its label gives it.
  const hint = await descriptorOf(page, elements, HINT);
  expect(hint).toMatchObject({ accessibleName: "Password hint", label: "Password hint" });
  expect(hint).not.toHaveProperty("text");
  expect(hint).not.toHaveProperty("visibleText");
  const note = await descriptorOf(page, elements, RECOVERY_NOTE);
  expect(note).toMatchObject({ accessibleName: "Recovery note" });
  expect(note).not.toHaveProperty("text");
  // A label wrapping one reads as its own words; an ordinary select's contents are kept.
  for (const words of ["Password hint", "Security question", "Recent login codes"]) {
    expect(labelReading(words), words).toMatchObject({ text: words, visibleText: words, accessibleName: words });
  }
  expect(labelReading("Stay logged in")).toMatchObject({ text: "Stay logged in For 30 days", accessibleName: "Stay logged in For 30 days" });
  // A name drawn from a reference holding sensitive contents keeps the reference's other words.
  expect(await descriptorOf(page, elements, SHOW_HINT)).toMatchObject({ text: "Show", accessibleName: "Password hint" });
});

test("navigate: not a content-script action; the content script rejects it", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  const before = page.url();
  const reply = await harness.runAction({ commandId: "navigate", actionType: "web.browser.navigate", url: "http://127.0.0.1/" });
  expect(reply).toMatchObject({ status: "failed", message: "Unsupported action type: web.browser.navigate" });
  expect(page.url()).toBe(before);
});

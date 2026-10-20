// Trusted-input emulation (decision D5), proven against live pages: the type,
// clear and keypress verbs and the keyboard capability behind them.
//
// These behaviours cannot be proven anywhere but in a real browser. The whole
// point of the emulation is that a synthetic `KeyboardEvent` has
// `isTrusted: false` and therefore triggers no default action, so what is under
// test is precisely what a DOM stub would fake: whether an untrusted Enter
// submits a form and reports the form's default button as the submitter,
// whether an untrusted keystroke drives a list that filters on `input`,
// whether a key the page cancels is reported as the page's, and whether focus
// really moves on Tab.
//
// Every row runs on one of the realistic scenarios, on the control a person
// would use there:
//
// - job-board's home search form (What and Where, a GET form whose default
//   button is "Find jobs"), whose consent wall cancels Enter outside itself;
// - company-website's newsletter page, a one-field form whose own submit
//   handler posts the address, and its quote drawer, with a native radio group
//   and a faux select that opens on Enter;
// - everything-store's header search, whose suggestion listbox filters on every
//   `input` event and hides on Escape, and which, armed with the store's
//   `keyboard-suggestions` redesign, is a combobox whose arrow keys move a
//   highlight and whose Enter on it is cancelled inside the search form;
// - social-network-feed's chat, a contenteditable message box.
//
// A row that needs a state the page does not start in (read-only, disabled)
// sets it on the real control, as a page's own script would. The overlays each
// site opens on a timer are answered through the site's own mutations before
// the page is reloaded, as a visitor who answered them earlier would find it.

import type { Locator, Page } from "@playwright/test";
import { rotatingId } from "../../../../scenario-lab/src/scenarios/job-board/board/index.js";
import { getScenario } from "../../../../scenario-lab/src/registry.js";
import { expect, test, type ContentHarness } from "../index.js";

const WHAT = 'input[name="q"]';
const WHERE = 'input[name="l"]';
const NEWSLETTER_EMAIL = 'form[data-newsletter-form] input[name="email"]';
const CHAT_MESSAGE = '[contenteditable="true"][aria-label="Message"]';
const STORE_SEARCH = 'input[name="k"]';
const SUGGESTIONS = '[role="listbox"][aria-label="Search suggestions"]';
const CONTACT_PHONE = 'input[name="contactBy"][value="Phone"]';

/** Posts one of the scenario's own page mutations, as the page's `mutate` does. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.status, `${harness.scenarioId} ${operation}`).toBe(200);
}

/** Opens `path` on the harness's Lab and waits for the content script there to announce itself. */
async function openPath(harness: ContentHarness, path: string): Promise<void> {
  await harness.page.goto(new URL(path, harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

/** job-board's home page with consent answered and the chat minimised, as a returning visitor finds it. */
async function openJobBoard(openHarness: (id: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openHarness("job-board");
  await mutate(harness, "consent", { choice: "accepted" });
  await mutate(harness, "minimise-chat");
  await openPath(harness, "/scenarios/job-board/");
  return harness;
}

/** company-website at `path` with consent, the newsletter offer and the chat greeting already answered. */
async function openCompanyWebsite(openHarness: (id: string) => Promise<ContentHarness>, path: string): Promise<ContentHarness> {
  const harness = await openHarness("company-website");
  await mutate(harness, "set-consent", { choice: "all" });
  await mutate(harness, "dismiss-newsletter");
  await mutate(harness, "dismiss-chat-greeting");
  await openPath(harness, path);
  return harness;
}

/** The quote drawer opened from the header and its first step filled, so step 2 (service, details, contact) is showing. */
async function openQuoteStepTwo(page: Page): Promise<Locator> {
  await page.locator('header button:text-is("Get a free quote")').click();
  const drawer = page.locator("[data-quote-drawer]");
  await drawer.locator('input[name="fullName"]').fill("Ada Lovelace");
  await drawer.locator('input[name="email"]').fill("ada@example.com");
  await drawer.locator('input[name="phone"]').fill("01632 960001");
  await drawer.locator('input[name="postcode"]').fill("BS1 4DJ");
  await drawer.locator('button:text-is("Continue")').click();
  await expect(drawer.getByRole("radiogroup", { name: "How should we get back to you?" })).toBeVisible();
  return drawer;
}

/** A selector for `locator`'s element by its generated id, escaped as the page's own scripts escape it. */
async function idSelector(locator: Locator): Promise<string> {
  return await locator.evaluate((element) => `#${CSS.escape(element.id)}`);
}

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
  const harness = await openJobBoard(openHarness);
  const seen = await watchKeyboard(page, WHAT);
  const reply = await harness.runAction({ commandId: "type-ab", actionType: "web.dom.type", selector: WHAT, text: "Ab" });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" }, message: expect.stringMatching(/^Text entered\. Typing pressed no other key/u) });
  expect(await seen()).toEqual([
    "keydown:A", "beforeinput:insertText", "input:insertText", "keyup:A",
    "keydown:b", "beforeinput:insertText", "input:insertText", "keyup:b",
    "change"
  ]);
  await expect(page.locator(WHAT)).toHaveValue("Ab");
});

test("type: replaces what the field already holds, and the read-back proves it", async ({ openHarness, page }) => {
  const harness = await openJobBoard(openHarness);
  await page.locator(WHERE).fill("draft");
  const reply = await harness.runAction({ commandId: "type-replace", actionType: "web.dom.type", selector: WHERE, text: "Bristol" });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: 'the field holds "Bristol"', actual: 'the field holds "Bristol"' }
  });
  await expect(page.locator(WHERE)).toHaveValue("Bristol");
});

test("type: a read-only field takes no text and reports output_not_observed", async ({ openHarness, page }) => {
  const harness = await openJobBoard(openHarness);
  await page.locator(WHERE).evaluate((element) => { (element as HTMLInputElement).readOnly = true; });
  const seen = await watchKeyboard(page, WHERE);
  const reply = await harness.runAction({ commandId: "type-readonly", actionType: "web.dom.type", selector: WHERE, text: "blocked" });
  expect(reply).toMatchObject({
    status: "failed",
    validation: { status: "failed", expected: 'the field holds "blocked"', actual: 'the field holds ""' },
    message: "The field did not keep the text.",
    failure: { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true }
  });
  await expect(page.locator(WHERE)).toHaveValue("");
  // The keys reach a read-only field, as they do for a real user; no edit follows them.
  expect((await seen()).filter((entry) => entry.startsWith("input") || entry.startsWith("beforeinput"))).toEqual([]);
});

test("type: a contenteditable host (social-network-feed's chat box) is edited through InputEvent rather than a value setter", async ({ openHarness, page }) => {
  const harness = await openHarness("social-network-feed");
  await mutate(harness, "consent", { choice: "all" });
  await mutate(harness, "notifications", { choice: "dismissed" });
  // The chat the site opens on its own after the prompt, left open, opens again on the next page.
  await mutate(harness, "chat", { state: "open" });
  await openPath(harness, "/scenarios/social-network-feed/");
  await expect(page.locator(CHAT_MESSAGE)).toBeVisible();

  const seen = await watchKeyboard(page, CHAT_MESSAGE);
  const reply = await harness.runAction({ commandId: "type-editable", actionType: "web.dom.type", selector: CHAT_MESSAGE, text: "Ada" });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: 'the field holds "Ada"' } });
  await expect(page.locator(CHAT_MESSAGE)).toHaveText("Ada");
  // An editable host has no value to commit, so it gets the edits without a trailing change.
  expect((await seen()).filter((entry) => entry.startsWith("input") || entry === "change"))
    .toEqual(["input:insertText", "input:insertText", "input:insertText"]);
});

test("clear: empties the field and proves it stayed empty", async ({ openHarness, page }) => {
  const harness = await openJobBoard(openHarness);
  await page.locator(WHAT).fill("draft");
  const reply = await harness.runAction({ commandId: "clear-what", actionType: "web.dom.clear", selector: WHAT });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: "the field is empty", actual: "the field is empty" },
    message: "Field cleared."
  });
  await expect(page.locator(WHAT)).toHaveValue("");
});

test("keypress: Tab moves focus along the tabbable order, from What to Where", async ({ openHarness, page }) => {
  const harness = await openJobBoard(openHarness);
  // The board's field ids rotate with the seed; the scenario's own function names the one Where gets.
  const whereId = rotatingId(getScenario("job-board")!.seed, "text-input-where", "l");
  const reply = await harness.runAction({ commandId: "tab", actionType: "web.dom.keypress", selector: WHAT, key: "Tab" });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: "focus moves to the next tabbable element", actual: `focus moved to #${whereId}` }
  });
  await expect(page.locator(WHERE)).toBeFocused();
});

test("keypress: modifiers reach the page, and a modified character types nothing", async ({ openHarness, page }) => {
  const harness = await openJobBoard(openHarness);
  await page.locator(WHAT).evaluate((element) => {
    const seen: string[] = [];
    (window as unknown as { __modifiers: string[] }).__modifiers = seen;
    element.addEventListener("keydown", (event) => {
      const key = event as KeyboardEvent;
      seen.push(`${key.key}:ctrl=${key.ctrlKey}:shift=${key.shiftKey}:alt=${key.altKey}:meta=${key.metaKey}:${key.code}:${key.keyCode}`);
    });
  });
  const reply = await harness.runAction({
    commandId: "shortcut", actionType: "web.dom.keypress", selector: WHAT, key: "a", modifiers: { ctrl: true, shift: true }
  });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  expect(await page.evaluate(() => (window as unknown as { __modifiers: string[] }).__modifiers))
    .toEqual(["a:ctrl=true:shift=true:alt=false:meta=false:KeyA:65"]);
  // Ctrl+A is a shortcut, not text: the character is not inserted.
  await expect(page.locator(WHAT)).toHaveValue("");
});

test("W02: Enter in the newsletter's email field submits the form and reports its Sign me up button as the submitter", async ({ openHarness, page }) => {
  const harness = await openCompanyWebsite(openHarness, "/scenarios/company-website/newsletter");
  const typed = await harness.runAction({ commandId: "w02-type", actionType: "web.dom.type", selector: NEWSLETTER_EMAIL, text: "ada@example.com" });
  expect(typed).toMatchObject({ status: "succeeded", validation: { status: "passed" } });

  const pressed = await harness.runAction({ commandId: "w02-enter", actionType: "web.dom.keypress", selector: NEWSLETTER_EMAIL, key: "Enter" });
  expect(pressed).toMatchObject({
    status: "succeeded",
    message: "Key pressed.",
    validation: {
      status: "passed",
      expected: "Enter submits the form",
      actual: 'the form fired a submit event with the "Sign me up" button as the submitter'
    }
  });
  // The page's own submit handler posted the address and reloaded onto the list it now holds.
  await expect.poll(async () => (await harness.finalState()).state).toMatchObject({ newsletter: { subscribers: ["ada@example.com"] } });
  await expect(page.getByRole("region", { name: "Your subscriptions" })).toContainText("ada@example.com");
});

test("W03: typing opens and filters everything-store's suggestions per keystroke, and Escape closes them", async ({ openHarness, page }) => {
  const harness = await openHarness("everything-store");
  await mutate(harness, "consent", { choice: "accept" });
  await mutate(harness, "dismiss-nudge", { nudge: "notifications" });
  await mutate(harness, "dismiss-nudge", { nudge: "app-banner" });
  await openPath(harness, "/scenarios/everything-store/");
  // How many suggestions the page offered after each of its own input handlers ran.
  await page.locator(STORE_SEARCH).evaluate((element, listbox) => {
    const counts: number[] = [];
    (window as unknown as { __suggestionCounts: number[] }).__suggestionCounts = counts;
    element.addEventListener("input", () => {
      const list = document.querySelector(listbox);
      counts.push(list && !(list as HTMLElement).hidden ? list.querySelectorAll('[role="option"]').length : 0);
    });
  }, SUGGESTIONS);

  const typed = await harness.runAction({ commandId: "w03-type", actionType: "web.dom.type", selector: STORE_SEARCH, text: "elec" });
  expect(typed).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: 'the field holds "elec"' } });
  // One character opens nothing; "el" and "ele" match eight (the list's cap), and "elec" narrows to three.
  expect(await page.evaluate(() => (window as unknown as { __suggestionCounts: number[] }).__suggestionCounts)).toEqual([0, 8, 8, 3]);
  await expect(page.locator(SUGGESTIONS).getByRole("option")).toHaveText(["tidewell electric kettle", "electric kettle", "electric kettle glass"]);

  const escaped = await harness.runAction({ commandId: "w03-escape", actionType: "web.dom.keypress", selector: STORE_SEARCH, key: "Escape" });
  expect(escaped).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: "the page receives the Escape key", actual: "Escape was delivered; it has no default action on this target" }
  });
  await expect(page.locator(SUGGESTIONS)).toBeHidden();
  await expect(page.locator(STORE_SEARCH)).toHaveValue("elec");
  expect(page.url()).toBe(new URL("/scenarios/everything-store/", harness.lab.origin).href);
});

// The keyboard-forms combobox row, moved onto everything-store's header search
// armed with `keyboard-suggestions`: the redesign that draws the box as a
// combobox whose arrow keys move a highlight, and whose Enter on a highlighted
// suggestion puts it in the box and is cancelled by the page -- inside the
// search form, which must therefore not submit.
test("W03: arrow keys move everything-store's suggestion highlight, and an Enter the page cancels chooses without searching", async ({ openHarness, page }) => {
  const harness = await openHarness("everything-store");
  // Arming starts the account over, so the overlays are answered after it.
  await mutate(harness, "set-mode", { mode: "keyboard-suggestions" });
  await mutate(harness, "consent", { choice: "accept" });
  await mutate(harness, "dismiss-nudge", { nudge: "notifications" });
  await mutate(harness, "dismiss-nudge", { nudge: "app-banner" });
  await openPath(harness, "/scenarios/everything-store/");
  const home = page.url();
  const options = page.locator(SUGGESTIONS).getByRole("option");

  const typed = await harness.runAction({ commandId: "w03-type", actionType: "web.dom.type", selector: STORE_SEARCH, text: "elec" });
  expect(typed).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: 'the field holds "elec"' } });
  await expect(options).toHaveText(["tidewell electric kettle", "electric kettle", "electric kettle glass"]);
  await expect(page.locator(STORE_SEARCH)).toHaveAttribute("aria-expanded", "true");

  const first = await harness.runAction({ commandId: "w03-down-1", actionType: "web.dom.keypress", selector: STORE_SEARCH, key: "ArrowDown" });
  expect(first).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", actual: "the page handled ArrowDown and cancelled its default action" }
  });
  await expect(page.locator(STORE_SEARCH)).toHaveAttribute("aria-activedescendant", (await options.nth(0).getAttribute("id"))!);
  await harness.runAction({ commandId: "w03-down-2", actionType: "web.dom.keypress", selector: STORE_SEARCH, key: "ArrowDown" });
  await expect(page.locator(STORE_SEARCH)).toHaveAttribute("aria-activedescendant", (await options.nth(1).getAttribute("id"))!);

  const chosen = await harness.runAction({ commandId: "w03-enter", actionType: "web.dom.keypress", selector: STORE_SEARCH, key: "Enter" });
  expect(chosen).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", actual: "the page handled Enter and cancelled its default action" }
  });
  await expect(page.locator(STORE_SEARCH)).toHaveValue("electric kettle");
  await expect(page.locator(SUGGESTIONS)).toBeHidden();
  // The box is inside the search form: an Enter the page cancels must not submit it.
  expect(page.url()).toBe(home);
  expect((await harness.finalState()).state).toMatchObject({ guard: { searchLoads: [] } });
});

test("W03: Enter on company-website's faux service select is handled by the page, which opens its list", async ({ openHarness, page }) => {
  const harness = await openCompanyWebsite(openHarness, "/scenarios/company-website/");
  const drawer = await openQuoteStepTwo(page);
  const select = drawer.getByText("Choose a service", { exact: true });
  const reply = await harness.runAction({ commandId: "w03-faux-select", actionType: "web.dom.keypress", selector: await idSelector(select), key: "Enter" });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: "the page receives the Enter key", actual: "the page handled Enter and cancelled its default action" }
  });
  await expect(drawer.locator("[data-value]").first()).toBeVisible();
  // Nothing was sent: the quote is three steps from submitting.
  expect((await harness.finalState()).state).toMatchObject({ quotes: [] });
});

test("keypress: a radio group's arrow keys are reported unsupported rather than faked", async ({ openHarness, page }) => {
  const harness = await openCompanyWebsite(openHarness, "/scenarios/company-website/");
  await openQuoteStepTwo(page);
  const reply = await harness.runAction({ commandId: "radio-arrow", actionType: "web.dom.keypress", selector: CONTACT_PHONE, key: "ArrowDown" });
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
  await expect(page.locator(CONTACT_PHONE)).toBeChecked();
});

test("type: a disabled field is rejected with a code, and not one key reaches it", async ({ openHarness, page }) => {
  const harness = await openJobBoard(openHarness);
  await page.locator(WHAT).evaluate((element) => { (element as HTMLInputElement).disabled = true; });
  const seen = await watchKeyboard(page, WHAT);
  const reply = await harness.runAction({ commandId: "type-disabled", actionType: "web.dom.type", selector: WHAT, text: "Ada" });
  expect(reply).toMatchObject({
    status: "failed",
    message: "Action rejected: the element is disabled",
    validation: { status: "failed", expected: "a target that can be typed into", actual: "the element is disabled" },
    failure: {
      category: "unexpected_state", code: "web.target.not_actionable", retryable: false, stage: "execution",
      expected: "a target that can be typed into", actual: "disabled: the element is disabled"
    }
  });
  // The refusal is real, and it is a refusal rather than the `output_not_observed`
  // an ungated verb would report after typing into a field that took nothing.
  expect(await seen()).toEqual([]);
  await expect(page.locator(WHAT)).toHaveValue("");
});

test("clear: a disabled field is rejected, and keeps the value it held", async ({ openHarness, page }) => {
  const harness = await openJobBoard(openHarness);
  await page.locator(WHERE).fill("draft");
  await page.locator(WHERE).evaluate((element) => { (element as HTMLInputElement).disabled = true; });
  const reply = await harness.runAction({ commandId: "clear-disabled", actionType: "web.dom.clear", selector: WHERE });
  expect(reply).toMatchObject({
    status: "failed",
    message: "Action rejected: the element is disabled",
    validation: { status: "failed", expected: "a target that can be cleared", actual: "the element is disabled" },
    failure: {
      category: "unexpected_state", code: "web.target.not_actionable", retryable: false, stage: "execution",
      expected: "a target that can be cleared", actual: "disabled: the element is disabled"
    }
  });
  await expect(page.locator(WHERE)).toHaveValue("draft");
});

test("keypress: a disabled target is rejected, so Enter cannot submit a form the keyboard never reached", async ({ openHarness, page }) => {
  const harness = await openJobBoard(openHarness);
  const home = page.url();
  await page.locator(WHAT).fill("Rust engineer");
  await page.locator(WHAT).evaluate((element) => { (element as HTMLInputElement).disabled = true; });
  const seen = await watchKeyboard(page, WHAT);
  const reply = await harness.runAction({ commandId: "enter-disabled", actionType: "web.dom.keypress", selector: WHAT, key: "Enter" });
  expect(reply).toMatchObject({
    status: "failed",
    message: "Action rejected: the element is disabled",
    validation: { status: "failed", expected: "a target that can receive the key press", actual: "the element is disabled" },
    failure: {
      category: "unexpected_state", code: "web.target.not_actionable", retryable: false, stage: "execution",
      expected: "a target that can receive the key press", actual: "disabled: the element is disabled"
    }
  });
  expect(await seen()).toEqual([]);
  // No results page was served: the search form never submitted.
  expect(page.url()).toBe(home);
  expect((await harness.finalState()).state).toMatchObject({ resultsViews: 0 });
});

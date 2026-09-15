// Every action type the content script executes, once, on the basic-form
// fixture: the reply the background worker receives and what changed on the
// page.
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

import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";

const NAME = '[data-testid="name"]';
const PLAN = '[data-testid="plan"]';
const NOTES = '[data-testid="notes"]';
const SUBMIT = '[data-testid="submit"]';
const RESULT = '[data-testid="result"]';

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

/** Inserts `<p data-testid="late">Late arrival</p>` after a fixed delay, so a wait started now has to observe it arrive. */
async function insertLateParagraph(page: Page): Promise<void> {
  await page.evaluate(() => {
    setTimeout(() => {
      const paragraph = document.createElement("p");
      paragraph.dataset.testid = "late";
      paragraph.textContent = "Late arrival";
      document.querySelector("main")?.append(paragraph);
    }, 150);
  });
}

test("captureSnapshot request: answers with the page and its interactive elements", async ({ openHarness }) => {
  const harness = await openHarness("basic-form");
  const snapshot = await harness.capture();
  expect(snapshot).toMatchObject({ url: harness.url, title: "Basic form" });
  expect(snapshot.interactiveElements.map((element) => element.selector)).toEqual(expect.arrayContaining([NAME, PLAN, NOTES, SUBMIT]));
});

test("capture_snapshot: succeeds with the snapshot and changes nothing", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction({ commandId: "capture", actionType: "web.dom.capture_snapshot" });
  expect(reply).toMatchObject({
    commandId: "capture",
    actionType: "web.dom.capture_snapshot",
    status: "succeeded",
    validation: { status: "none", reason: "evidence-only" },
    message: "Snapshot captured.",
    url: harness.url,
    title: "Basic form"
  });
  expect(reply.snapshot?.interactiveElements.map((element) => element.selector)).toEqual(expect.arrayContaining([NAME, PLAN, NOTES, SUBMIT]));
  await expect(page.locator(RESULT)).toHaveText("Not submitted");
});

test("type: enters the text per character and validates that the field kept it", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const seen = await watchEvents(page, NAME, ["input", "change"]);
  const reply = await harness.runAction({ commandId: "type", actionType: "web.dom.type", selector: NAME, text: "Ada" });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: 'the field holds "Ada"', actual: 'the field holds "Ada"' },
    message: "Text entered.",
    element: { selector: NAME }
  });
  await expect(page.locator(NAME)).toHaveValue("Ada");
  // One input per character since w2-keyboard-input, so a widget that filters per keystroke sees each one.
  expect(await seen()).toEqual(["input:untrusted", "input:untrusted", "input:untrusted", "change:untrusted"]);
});

test("clear: empties the field", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.locator(NOTES).fill("draft");
  const reply = await harness.runAction({ commandId: "clear", actionType: "web.dom.clear", selector: NOTES });
  expect(reply).toMatchObject({ status: "succeeded", message: "Field cleared.", element: { selector: NOTES } });
  await expect(page.locator(NOTES)).toHaveValue("");
});

test("select: chooses the option and reports it on the element", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction({ commandId: "select", actionType: "web.dom.select", selector: PLAN, value: "team" });
  expect(reply).toMatchObject({ status: "succeeded", message: "Option selected.", element: { selector: PLAN, selectedValue: "team" } });
  await expect(page.locator(PLAN)).toHaveValue("team");
});

test("select: a value with no option changes nothing and reports output_not_observed", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction({ commandId: "select-missing", actionType: "web.dom.select", selector: PLAN, value: "platinum" });
  expect(reply).toMatchObject({
    status: "failed",
    message: 'No option matched value "platinum".',
    failure: { category: "output_not_observed" }
  });
  // The select keeps the option it started on, rather than being blanked.
  await expect(page.locator(PLAN)).toHaveValue("starter");
});

test("click: submits the filled form, which the fixture records", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await harness.runAction({ commandId: "fill-name", actionType: "web.dom.type", selector: NAME, text: "Ada" });
  await harness.runAction({ commandId: "fill-plan", actionType: "web.dom.select", selector: PLAN, value: "team" });
  const reply = await harness.runAction({ commandId: "click", actionType: "web.dom.click", selector: SUBMIT });
  expect(reply).toMatchObject({ status: "succeeded", message: "Element clicked.", element: { selector: SUBMIT } });
  await expect(page.locator(RESULT)).toHaveText("Submitted");
  expect((await harness.finalState()).state).toEqual({ submitted: true, submissionCount: 1, values: { name: "Ada", plan: "team", notes: "" } });
});

test("scroll: moves the window to the requested offset", async ({ openHarness, page }) => {
  await page.setViewportSize({ width: 800, height: 200 });
  const harness = await openHarness("basic-form");
  expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeGreaterThanOrEqual(60);
  const reply = await harness.runAction({ commandId: "scroll", actionType: "web.dom.scroll", options: { x: 0, y: 60 } });
  expect(reply).toMatchObject({ status: "succeeded", message: "Page scrolled.", snapshot: { viewport: { scrollX: 0, scrollY: 60 } } });
  expect(await page.evaluate(() => window.scrollY)).toBe(60);
});

test("keypress: an untrusted Enter performs the default action a trusted one would, so the form submits", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.locator(NAME).fill("Ada");
  const seen = await watchEvents(page, NAME, ["keydown", "keyup"]);
  const reply = await harness.runAction({ commandId: "keypress", actionType: "web.dom.keypress", selector: NAME, key: "Enter" });
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: 'Enter submits the form [data-testid="basic-form"]' },
    message: "Key pressed.",
    element: { selector: NAME }
  });
  // The events are still untrusted; w2-keyboard-input emulates the default action the browser withholds.
  expect(await seen()).toEqual(["keydown:Enter:untrusted", "keyup:Enter:untrusted"]);
  await expect(page.locator(RESULT)).toHaveText("Submitted");
  expect((await harness.finalState()).state).toMatchObject({ submitted: true });
});

test("wait_for_selector: succeeds when a matching element appears", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const pending = harness.runAction({ commandId: "wait-selector", actionType: "web.dom.wait_for_selector", selector: '[data-testid="late"]', timeoutMs: 5_000 });
  await insertLateParagraph(page);
  expect(await pending).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", actual: "the element was found" },
    message: "Selector found.",
    element: { selector: '[data-testid="late"]' }
  });
});

test("wait_for_selector: a timeout reports timed_out with Core's timeout category", async ({ openHarness }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction({ commandId: "wait-never", actionType: "web.dom.wait_for_selector", selector: '[data-testid="never"]', timeoutMs: 100 });
  expect(reply).toMatchObject({
    status: "timed_out",
    message: 'Timed out waiting for selector: [data-testid="never"]',
    validation: { status: "failed", actual: "no element matched before the timeout" },
    failure: { category: "timeout", code: "web.action.timeout", retryable: true }
  });
});

test("wait_for_text: succeeds when the text appears", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const pending = harness.runAction({ commandId: "wait-text", actionType: "web.dom.wait_for_text", text: "Late arrival", timeoutMs: 5_000 });
  await insertLateParagraph(page);
  const reply = await pending;
  expect(reply).toMatchObject({ status: "succeeded", message: "Text found." });
  expect(reply.element).toBeUndefined();
});

test("extract: text by default, one attribute, or a field's value", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  expect(await harness.runAction({ commandId: "extract-text", actionType: "web.dom.extract", selector: RESULT }))
    .toMatchObject({
      status: "succeeded",
      validation: { status: "none", reason: "evidence-only" },
      message: "Value extracted.",
      extracted: "Not submitted",
      element: { selector: RESULT }
    });
  expect(await harness.runAction({ commandId: "extract-attribute", actionType: "web.dom.extract", selector: RESULT, options: { mode: "attribute", attribute: "aria-live" } }))
    .toMatchObject({ status: "succeeded", extracted: "polite" });
  await page.locator(NAME).fill("Ada");
  expect(await harness.runAction({ commandId: "extract-value", actionType: "web.dom.extract", selector: NAME }))
    .toMatchObject({ status: "succeeded", extracted: "Ada" });
});

/** The sensitive-input fixture's own pre-filled secrets: the password, the card, and the multi-token billing card. */
const FIXTURE_SECRETS = ["SYNTHETIC_PASSWORD_DO_NOT_USE", "4111111111111111", "4222222222222220"];
const SENSITIVE_FORM = '[data-testid="sensitive-form"]';
/** Written into sensitive controls by `addContentBearingControls`; no reply may carry either. */
const INJECTED_SECRETS = ["SYNTHETIC_RECOVERY_NOTE", "SYNTHETIC_ANSWER_LABEL", "SYNTHETIC_ANSWER_VALUE"];

/** Every way `web.dom.extract` reads: text or a live value by default, one attribute, and inner HTML. */
const EXTRACT_MODES = [undefined, { mode: "attribute", attribute: "value" }, { mode: "html" }] as const;

/** Adds a sensitive textarea and a sensitive select, whose secrets are contents rather than values, and an ordinary select beside them. */
async function addContentBearingControls(page: Page): Promise<void> {
  await page.evaluate((formSelector) => {
    const form = document.querySelector(formSelector);
    if (!form) throw new Error(`${formSelector} is missing`);
    form.insertAdjacentHTML(
      "beforeend",
      ' <label>Recovery note <textarea data-testid="recovery-note" data-sensitive="true">SYNTHETIC_RECOVERY_NOTE</textarea></label>' +
        '<label>Security answer <select data-testid="security-answer" data-sensitive="true"><option value="SYNTHETIC_ANSWER_VALUE">SYNTHETIC_ANSWER_LABEL</option></select></label>' +
        '<label>Contact time <select data-testid="contact-time"><option value="mornings">Mornings</option></select></label>'
    );
  }, SENSITIVE_FORM);
}

test("extract: a sensitive control is refused in every mode", async ({ openHarness }) => {
  const harness = await openHarness("sensitive-input");
  for (const selector of ['[data-testid="password"]', '[data-testid="payment"]', '[data-testid="billing"]']) {
    for (const options of EXTRACT_MODES) {
      const label = `${selector} read ${options ? JSON.stringify(options) : "by default"}`;
      const reply = await harness.runAction({ commandId: "extract-sensitive", actionType: "web.dom.extract", selector, ...(options ? { options } : {}) });
      expect(reply, label).toMatchObject({
        status: "failed",
        failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" }
      });
      expect(reply, label).not.toHaveProperty("extracted");
      const wire = JSON.stringify(reply);
      for (const secret of FIXTURE_SECRETS) expect(wire, label).not.toContain(secret);
    }
  }
  // The rule is targeted: the fixture's ordinary email field is still read.
  expect(await harness.runAction({ commandId: "extract-username", actionType: "web.dom.extract", selector: 'input[name="username"]' }))
    .toMatchObject({ status: "succeeded", extracted: "synthetic-user@example.test" });
});

test("extract: a text read of a container skips the contents of sensitive controls inside it", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  await addContentBearingControls(page);
  const reply = await harness.runAction({ commandId: "extract-form-text", actionType: "web.dom.extract", selector: SENSITIVE_FORM });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "none", reason: "evidence-only" } });
  // Every label and the ordinary select's option are read; the sensitive
  // textarea's text and the sensitive select's option label are not.
  expect(reply.extracted).toBe("Email Password Test card Billing card Submit synthetic values Recovery note Security answer Contact time Mornings");
  const wire = JSON.stringify(reply);
  for (const secret of FIXTURE_SECRETS) expect(wire).not.toContain(secret);
  // The injected contents are scanned in the read, not the whole reply: the
  // reply's page snapshot still quotes a sensitive textarea's text and a
  // sensitive select's option labels through the descriptor's `text`,
  // `visibleText` and `accessibleName` -- a defect outside extraction,
  // reported by x0-page.
  for (const secret of INJECTED_SECRETS) expect(JSON.stringify(reply.extracted)).not.toContain(secret);
});

test("extract: an HTML read of a container removes sensitive descendants' value attributes and contents", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  await addContentBearingControls(page);
  const reply = await harness.runAction({ commandId: "extract-form-html", actionType: "web.dom.extract", selector: SENSITIVE_FORM, options: { mode: "html" } });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "none", reason: "evidence-only" } });
  const html = String(reply.extracted);
  // The sensitive controls are still in the markup, emptied of what they hold.
  expect(html).toContain('<input name="password" data-testid="password" type="password">');
  expect(html).toContain('<input name="payment" data-testid="payment" autocomplete="cc-number" inputmode="numeric">');
  expect(html).toContain('<input name="billing" data-testid="billing" autocomplete="billing cc-number" inputmode="numeric">');
  expect(html).toContain('<textarea data-testid="recovery-note" data-sensitive="true"></textarea>');
  expect(html).toContain('<select data-testid="security-answer" data-sensitive="true"></select>');
  // Ordinary controls keep their values and contents.
  expect(html).toContain('value="synthetic-user@example.test"');
  expect(html).toContain('<option value="mornings">Mornings</option>');
  const wire = JSON.stringify(reply);
  for (const secret of FIXTURE_SECRETS) expect(wire).not.toContain(secret);
  // The injected contents are scanned in the read, not the whole reply: the
  // reply's page snapshot still quotes a sensitive textarea's text and a
  // sensitive select's option labels through the descriptor's `text`,
  // `visibleText` and `accessibleName` -- a defect outside extraction,
  // reported by x0-page.
  for (const secret of INJECTED_SECRETS) expect(JSON.stringify(reply.extracted)).not.toContain(secret);
});

test("navigate: not a content-script action; the content script rejects it", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction({ commandId: "navigate", actionType: "web.browser.navigate", url: "http://127.0.0.1/" });
  expect(reply).toMatchObject({ status: "failed", message: "Unsupported action type: web.browser.navigate" });
  expect(page.url()).toBe(harness.url);
});

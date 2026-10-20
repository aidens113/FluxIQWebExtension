// `web.dom.check` and `web.dom.assert` against real pages: the reply the
// background worker receives, and what the fixture's own server recorded.
//
// The two verbs are here together because they are the pair that makes a
// replayed form step trustworthy -- one sets a state instead of toggling it,
// the other states what must then be true -- and because their failures must be
// told apart. A check that could not run is ACTION_REJECTED
// (`web.action.rejected`, `blocked_by_capability_or_policy`); an assertion that
// does not hold is STATE_MISMATCH (`web.validation.state_mismatch`,
// `unexpected_state`). Neither is `output_not_observed`, which belongs to an
// action that ran without its effect appearing.
//
// STATE_MISMATCH is `unexpected_state`, not the `expected_state_missing` these
// rows used to assert: a failed authored assertion means the page is in a state
// other than the asserted one, which is what `unexpected_state` names, while
// `expected_state_missing` is Core's transition-comparison category and has no
// web code. It is not retryable either -- nothing in the assert verb touches
// the page, and the wait that gives the page its chance to change has already
// run inside the assertion, so a retry can only repeat the same answer.
//
// A failed assertion is not always STATE_MISMATCH, though. The evaluation polls
// until the claim holds or its window closes, so a claim whose subject never
// appeared -- `exists` on a selector nothing ever matched -- was never judged
// against the page at all; it ran out of time waiting for it. That is TIMEOUT
// (`web.action.timeout`, `timeout`), status `timed_out`, which is what the
// vocabulary assigns to a wait that expires. A claim whose subject was there to
// read and disagreed stays STATE_MISMATCH. `absent` is the asymmetric kind: it
// holds when nothing matches, so it can only fail by seeing the element, and it
// is therefore never a timeout.
//
// Every row that passes a short `timeoutMs` also asserts how long the action
// took, and that is not decoration. Before the outcome carried timing these
// rows asserted a verdict the verb reaches on its first attempt as well as its
// last, so each of them would have passed unchanged with the polling loop
// deleted outright -- the wait was unproven in both directions. `spent()` is
// what makes them notice.
//
// ACTION_REJECTED is one code for every refusal rather than one per reason, so
// the reason is what the record has to carry: its `actual` reads
// `"<reason>: <what was observed>"`, and the rows below assert it there.
//
// The pages are company-website's: its quote drawer holds the checkboxes and
// radios a person ticks, and sending the quote is an oracle no page assertion
// can fake -- the site's server stores the request only with the boxes the
// page's own script read at send time, so the check rows pass only if the
// state the verb set is the state the page acted on. The consent wall's
// "Strictly necessary" is a checkbox the site itself ships disabled; the
// settled home page carries the assertion rows.

import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

const MARKETING = 'input[name="marketing"]';
const PRIVACY = 'input[name="privacy"]';
const CONTACT_TEXT = 'input[name="contactBy"][value="Text message"]';
const FULL_NAME = 'input[name="fullName"]';
const QUOTE_BUTTON = "header [data-open-quote]";
/** The quote drawer's dialog: in the markup from the start, under a hidden root until "Get a free quote" opens it. */
const DRAWER = '[data-quote-drawer] section[role="dialog"]';
const DRAWER_BACK = "[data-quote-drawer] section > div:last-child > button:nth-of-type(1)";
const DRAWER_NEXT = "[data-quote-drawer] section > div:last-child > button:nth-of-type(2)";
/** The drawer's "Your job" step: a `hidden` fieldset until Continue passes the first step. */
const STEP_TWO = "[data-quote-drawer] form > fieldset:nth-of-type(2)";
const HEADING = "main h1";
const HEADING_TEXT = "Warm homes since 1987";
const MAIN_NAV = 'nav[aria-label="Main"]';
/** The consent wall's own disabled box: "Strictly necessary", shown once Customise is pressed. */
const STRICTLY_NECESSARY = 'input[type="checkbox"][disabled]';
const CONSENT_WALL = '[data-testid="cookie-consent"]';

/** A quote's reference, which only the confirmation page after a sent quote shows. */
const NEVER = '[data-testid="quote-reference"]';

type QuoteState = { consent: string; quotes: Array<{ contactBy: string; marketing: boolean }> };

/**
 * The recovery account an assertion that timed out carries
 * (`src/content/action-runtime/recovery/account.ts`, since 36daa680). The
 * assertion's window is `assert.timeoutMs`, not the command's `timeoutMs`, so
 * the command names no budget of its own and the loop walks the whole blip
 * ladder in `budget.ts` -- 250 ms then 500 ms -- before the third timeout ends
 * it: three attempts, 750 ms waited, well inside the 5 s defence budget.
 */
const NEVER_RECOVERED = "; the execution did not recover within its 3 attempts after absorbing timeout, timeout, timeout, waiting 750 ms";

/**
 * How long the content script actually spent on the action. A claim that does
 * not hold is retried until its window closes, so a row asserting this spent
 * its `timeoutMs` is asserting the polling loop ran -- which the verdict alone
 * cannot say, since a single immediate read reaches the same verdict.
 */
function spent(reply: { startedAt: number; finishedAt: number }): number {
  return reply.finishedAt - reply.startedAt;
}

async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

async function reload(harness: ContentHarness): Promise<void> {
  await harness.page.goto(harness.url);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

const siteState = async (harness: ContentHarness): Promise<QuoteState> => (await harness.finalState()).state as unknown as QuoteState;

/** company-website with its consent wall, chat greeting and newsletter offer already answered. */
async function settledHome(harness: ContentHarness): Promise<void> {
  await apply(harness, "set-consent", { choice: "essential" });
  await apply(harness, "dismiss-chat-greeting");
  await apply(harness, "dismiss-newsletter");
  await reload(harness);
}

/** The quote drawer open on its first step. */
async function openDrawer(harness: ContentHarness): Promise<void> {
  await settledHome(harness);
  await harness.page.locator(QUOTE_BUTTON).click();
  await expect(harness.page.locator(FULL_NAME)).toBeVisible();
}

/** Step 1 filled in and continued past: the drawer shows "Your job", with the contact radios. */
async function toStepTwo(page: Page): Promise<void> {
  await page.fill(FULL_NAME, "Ada Synthetic");
  await page.fill('input[name="email"]', "ada.synthetic@example.test");
  await page.fill('input[name="phone"]', "07700 900123");
  await page.fill('input[name="postcode"]', "KL6 2RN");
  await page.locator(DRAWER_NEXT).click();
  await expect(page.locator(CONTACT_TEXT)).toBeVisible();
}

/** A service chosen and continued past: the drawer shows "Almost done", with the two boxes. */
async function toStepThree(page: Page): Promise<void> {
  await page.getByText("Choose a service", { exact: true }).click();
  await page.locator('[data-value="Boiler service"]').click();
  await page.locator(DRAWER_NEXT).click();
  await expect(page.locator(PRIVACY)).toBeVisible();
}

/** Sends the quote as a person does, human check included, and waits for the site to confirm it. */
async function sendQuote(page: Page): Promise<void> {
  await page.locator('[data-testid="quote-submit"]').click();
  await page.getByText("Confirm you are human").click({ timeout: 8_000 });
  await expect(page).toHaveURL(/\/quote\/received\?ref=/u);
}

test("check: sets the checkbox, and the site stores the request the page sent with it", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  await openDrawer(harness);
  await toStepTwo(page);
  await toStepThree(page);
  const reply = await harness.runAction({ commandId: "check-on", actionType: "web.dom.check", selector: PRIVACY, checked: true });
  expect(reply).toMatchObject({
    status: "succeeded",
    message: "Check state set.",
    validation: { status: "passed", expected: "the control is checked", actual: "the checkbox is checked" }
  });
  expect(reply.element).toBeDefined();
  expect(reply.failure).toBeUndefined();
  await expect(page.locator(PRIVACY)).toBeChecked();
  // The server refuses a request without the privacy box, so a stored quote is
  // the page's own script having read the box the verb set.
  await sendQuote(page);
  expect((await siteState(harness)).quotes).toHaveLength(1);
});

test("check: unchecks when asked, and repeating the request is a validated no-op rather than a toggle", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  await openDrawer(harness);
  await toStepTwo(page);
  await toStepThree(page);
  // The marketing box arrives ticked.
  await expect(page.locator(MARKETING)).toBeChecked();

  const off = await harness.runAction({ commandId: "check-off", actionType: "web.dom.check", selector: MARKETING, checked: false });
  expect(off).toMatchObject({ status: "succeeded", message: "Check state set.", validation: { status: "passed", actual: "the checkbox is unchecked" } });

  // The row that a click could not pass: asking again for a state the control already holds.
  const again = await harness.runAction({ commandId: "check-off-again", actionType: "web.dom.check", selector: MARKETING, checked: false });
  expect(again).toMatchObject({ status: "succeeded", message: "Check state already set.", validation: { status: "passed", actual: "the checkbox is unchecked" } });
  await expect(page.locator(MARKETING)).not.toBeChecked();

  await page.locator(PRIVACY).check();
  await sendQuote(page);
  expect((await siteState(harness)).quotes).toMatchObject([{ marketing: false }]);
});

test("check: sets a radio and leaves it set when the same request is replayed", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  await openDrawer(harness);
  await toStepTwo(page);
  const reply = await harness.runAction({ commandId: "radio", actionType: "web.dom.check", selector: CONTACT_TEXT, checked: true });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: "the radio is checked" } });

  const replay = await harness.runAction({ commandId: "radio-again", actionType: "web.dom.check", selector: CONTACT_TEXT, checked: true });
  expect(replay).toMatchObject({ status: "succeeded", message: "Check state already set.", validation: { status: "passed" } });
  await expect(page.locator(CONTACT_TEXT)).toBeChecked();

  await toStepThree(page);
  await page.locator(PRIVACY).check();
  await sendQuote(page);
  expect((await siteState(harness)).quotes).toMatchObject([{ contactBy: "Text message" }]);
});

test("check: unchecking a radio and checking a non-checkable target are both ACTION_REJECTED", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  await openDrawer(harness);
  await toStepTwo(page);
  await harness.runAction({ commandId: "radio-on", actionType: "web.dom.check", selector: CONTACT_TEXT, checked: true });

  const uncheck = await harness.runAction({ commandId: "radio-off", actionType: "web.dom.check", selector: CONTACT_TEXT, checked: false });
  expect(uncheck).toMatchObject({
    status: "failed",
    validation: { status: "failed", expected: "the control is unchecked", actual: "a radio cannot be unchecked; check another radio in its group instead" },
    failure: {
      category: "blocked_by_capability_or_policy", code: "web.action.rejected", retryable: false, stage: "execution",
      expected: "the control is unchecked",
      actual: "not_checkable: a radio cannot be unchecked; check another radio in its group instead"
    }
  });
  // Refused, not half-applied: the group still holds the selection.
  await expect(page.locator(CONTACT_TEXT)).toBeChecked();

  // Back to step 1, where the name field is shown.
  await page.locator(DRAWER_BACK).click();
  await expect(page.locator(FULL_NAME)).toBeVisible();
  const textField = await harness.runAction({ commandId: "check-text-field", actionType: "web.dom.check", selector: FULL_NAME, checked: true });
  expect(textField).toMatchObject({
    status: "failed",
    validation: { status: "failed", actual: "<input[type=text]> is not a checkbox or a radio" },
    failure: {
      category: "blocked_by_capability_or_policy", code: "web.action.rejected", retryable: false,
      expected: "the control is checked",
      actual: "not_checkable: <input[type=text]> is not a checkbox or a radio"
    }
  });
});

// The refusal comes from the actionability gate, which runs before the verb
// touches the control -- the same gate click, type and select are held to --
// so the reason is the gate's wording rather than the checkable-state
// capability's. The verb's own `disabled` refusal is still behind it, for a
// control the gate passes and the platform refuses (a disabled `<fieldset>`
// around a control the gate reads as enabled).
test("check: a disabled control is rejected with the disabled reason and is left untouched", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  await apply(harness, "dismiss-chat-greeting");
  await reload(harness);
  await page.locator('button[data-choice="customise"]').click();
  await expect(page.locator(STRICTLY_NECESSARY)).toBeVisible();
  await expect(page.locator(STRICTLY_NECESSARY)).toBeChecked();

  const reply = await harness.runAction({ commandId: "check-disabled", actionType: "web.dom.check", selector: STRICTLY_NECESSARY, checked: false });
  expect(reply).toMatchObject({
    status: "failed",
    validation: { status: "failed", actual: "the element is disabled" },
    failure: {
      category: "unexpected_state", code: "web.target.not_actionable", retryable: false,
      expected: "the control is unchecked", actual: "disabled: the element is disabled"
    }
  });
  await expect(page.locator(STRICTLY_NECESSARY)).toBeChecked();
  expect((await siteState(harness)).consent).toBe("pending");
});

test("assert: exists and absent judge what the page holds now", async ({ openHarness }) => {
  const harness = await openHarness("company-website");
  await settledHome(harness);
  expect(await harness.runAction({ commandId: "exists", actionType: "web.dom.assert", selector: MAIN_NAV, assert: { kind: "exists" } }))
    .toMatchObject({ status: "succeeded", message: "Assertion held: exists.", validation: { status: "passed", actual: "it exists" } });

  expect(await harness.runAction({ commandId: "absent", actionType: "web.dom.assert", selector: NEVER, assert: { kind: "absent" } }))
    .toMatchObject({ status: "succeeded", message: "Assertion held: absent.", validation: { status: "passed" } });

  // Nothing ever matched, so the claim was never judged against the page: it
  // spent its whole window waiting for an element that did not come, which is
  // TIMEOUT and not a state the page was in. Reported as STATE_MISMATCH before
  // the outcome carried its timing.
  const missing = await harness.runAction({ commandId: "exists-missing", actionType: "web.dom.assert", selector: NEVER, assert: { kind: "exists", timeoutMs: 200 } });
  expect(missing).toMatchObject({
    status: "timed_out",
    message: "Assertion did not hold within 200 ms: exists.",
    validation: { status: "failed", actual: `nothing matched "${NEVER}"${NEVER_RECOVERED}` },
    failure: {
      category: "timeout", code: "web.action.timeout", retryable: true, stage: "execution",
      expected: `an element matching "${NEVER}" exists`, actual: `nothing matched "${NEVER}"${NEVER_RECOVERED}`
    }
  });
  expect(spent(missing)).toBeGreaterThanOrEqual(200);
});

test("assert: a kind is not what decides a timeout -- the same claim mismatches when there is something to read", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  await settledHome(harness);
  // `visible` on a selector nothing matches has no element to look at, so it
  // waits in vain: TIMEOUT, exactly as `exists` does.
  const nothing = await harness.runAction({ commandId: "visible-nothing", actionType: "web.dom.assert", selector: NEVER, assert: { kind: "visible", timeoutMs: 200 } });
  expect(nothing).toMatchObject({
    status: "timed_out",
    validation: { status: "failed", actual: `nothing matched "${NEVER}"${NEVER_RECOVERED}` },
    failure: { category: "timeout", code: "web.action.timeout", retryable: true, stage: "execution" }
  });
  expect(spent(nothing)).toBeGreaterThanOrEqual(200);

  // The same kind against an element that is there but hidden -- the quote
  // drawer, in the markup and closed -- is judged, so it is a state the page
  // is in. The pair is the whole rule: what separates the two records is
  // whether the page could be read, not which kind was asked.
  const hidden = await harness.runAction({ commandId: "visible-present", actionType: "web.dom.assert", selector: DRAWER, assert: { kind: "visible", timeoutMs: 200 } });
  expect(hidden).toMatchObject({
    status: "failed",
    failure: { category: "unexpected_state", code: "web.validation.state_mismatch", retryable: false, stage: "verification" }
  });
  await expect(page.locator(DRAWER)).toHaveCount(1);
});

test("assert: absent is not the mirror of exists -- an element that never goes is a mismatch, not a timeout", async ({ openHarness }) => {
  const harness = await openHarness("company-website");
  await settledHome(harness);
  // `absent` holds when nothing matches, so it cannot fail by waiting in vain.
  // Its only failure is seeing the element it was told would go, which is a
  // definite observation of the page and therefore STATE_MISMATCH -- however
  // long it waited to make it.
  const stays = await harness.runAction({ commandId: "absent-stays", actionType: "web.dom.assert", selector: MAIN_NAV, assert: { kind: "absent", timeoutMs: 200 } });
  expect(stays).toMatchObject({
    status: "failed",
    message: "Assertion did not hold: absent.",
    validation: { status: "failed", expected: `no element matches "${MAIN_NAV}"`, actual: `"${MAIN_NAV}" is still present` },
    failure: {
      category: "unexpected_state", code: "web.validation.state_mismatch", retryable: false, stage: "verification",
      actual: `"${MAIN_NAV}" is still present`
    }
  });
  // It did wait, all the same: the verdict is a judgement, not a shortcut.
  expect(spent(stays)).toBeGreaterThanOrEqual(200);
});

test("assert: a text claim that does not hold is STATE_MISMATCH carrying both sides", async ({ openHarness }) => {
  const harness = await openHarness("company-website");
  await settledHome(harness);
  expect(await harness.runAction({ commandId: "text-ok", actionType: "web.dom.assert", selector: HEADING, assert: { kind: "text", expected: HEADING_TEXT } }))
    .toMatchObject({ status: "succeeded", validation: { status: "passed" } });

  const wrong = await harness.runAction({ commandId: "text-wrong", actionType: "web.dom.assert", selector: HEADING, assert: { kind: "text", expected: "Warm homes since 1990", timeoutMs: 200 } });
  expect(wrong).toMatchObject({
    status: "failed",
    message: "Assertion did not hold: text.",
    validation: {
      status: "failed",
      expected: `"${HEADING}" contains "Warm homes since 1990"`,
      actual: `"${HEADING}" reads "${HEADING_TEXT}"`
    },
    failure: {
      category: "unexpected_state", code: "web.validation.state_mismatch", retryable: false, stage: "verification",
      expected: `"${HEADING}" contains "Warm homes since 1990"`,
      actual: `"${HEADING}" reads "${HEADING_TEXT}"`
    }
  });
  // The claim is the user's, so it is never reported as the action's own unobserved output.
  expect(wrong.failure?.category).not.toBe("output_not_observed");
  // The element was there to read, so the verdict is a mismatch -- but the verb
  // still gave the page its whole window to change its mind.
  expect(spent(wrong)).toBeGreaterThanOrEqual(200);
});

test("assert: visible fails for a hidden element and holds once the page shows it", async ({ openHarness, page }) => {
  // The drawer's second step is its own `hidden` fieldset while the first is
  // shown; the site's Continue shows it once the first step is filled in.
  const harness = await openHarness("company-website");
  await openDrawer(harness);
  await page.fill(FULL_NAME, "Ada Synthetic");
  await page.fill('input[name="email"]', "ada.synthetic@example.test");
  await page.fill('input[name="phone"]', "07700 900123");
  await page.fill('input[name="postcode"]', "KL6 2RN");
  const hidden = await harness.runAction({ commandId: "visible-hidden", actionType: "web.dom.assert", selector: STEP_TWO, assert: { kind: "visible", timeoutMs: 200 } });
  expect(hidden).toMatchObject({
    status: "failed",
    validation: { status: "failed", actual: "it is present but not visible" },
    failure: {
      category: "unexpected_state", code: "web.validation.state_mismatch", retryable: false, stage: "verification",
      actual: "it is present but not visible"
    }
  });
  expect(spent(hidden)).toBeGreaterThanOrEqual(200);

  // Shown late by the site's own Continue, so the retry loop -- not a single
  // immediate read -- is what makes it pass.
  await page.evaluate((selector) => {
    setTimeout(() => { (document.querySelector(selector) as HTMLElement).click(); }, 150);
  }, DRAWER_NEXT);
  expect(await harness.runAction({ commandId: "visible-shown", actionType: "web.dom.assert", selector: STEP_TWO, assert: { kind: "visible", timeoutMs: 5_000 } }))
    .toMatchObject({ status: "succeeded", validation: { status: "passed", actual: "it is visible" } });
});

test("assert: enabled tells the disabled button from the live one", async ({ openHarness }) => {
  const harness = await openHarness("company-website");
  await openDrawer(harness);
  expect(await harness.runAction({ commandId: "enabled-live", actionType: "web.dom.assert", selector: DRAWER_NEXT, assert: { kind: "enabled" } }))
    .toMatchObject({ status: "succeeded", validation: { status: "passed", actual: "it is enabled" } });

  // Back is disabled while the drawer is on its first step.
  const disabled = await harness.runAction({ commandId: "enabled-disabled", actionType: "web.dom.assert", selector: DRAWER_BACK, assert: { kind: "enabled", timeoutMs: 200 } });
  expect(disabled).toMatchObject({
    status: "failed",
    validation: { status: "failed", actual: "it is present but disabled" },
    failure: {
      category: "unexpected_state", code: "web.validation.state_mismatch", retryable: false, stage: "verification",
      actual: "it is present but disabled"
    }
  });
  expect(spent(disabled)).toBeGreaterThanOrEqual(200);
});

test("assert: url holds for the page it is on and fails for another", async ({ openHarness }) => {
  const harness = await openHarness("company-website");
  await settledHome(harness);
  expect(await harness.runAction({ commandId: "url-ok", actionType: "web.dom.assert", assert: { kind: "url", expected: "/scenarios/company-website/" } }))
    .toMatchObject({ status: "succeeded", validation: { status: "passed", actual: `the page URL is ${harness.url}` } });

  // A document always has an address to compare, so a URL claim is always
  // judged and its failure is always a mismatch -- never a timeout, however
  // long it waited for a navigation that did not come.
  const elsewhere = await harness.runAction({ commandId: "url-wrong", actionType: "web.dom.assert", assert: { kind: "url", expected: "https://example.invalid/elsewhere", timeoutMs: 200 } });
  expect(elsewhere).toMatchObject({
    status: "failed",
    validation: { status: "failed", expected: "the page URL is https://example.invalid/elsewhere" },
    failure: {
      category: "unexpected_state", code: "web.validation.state_mismatch", retryable: false, stage: "verification",
      expected: "the page URL is https://example.invalid/elsewhere"
    }
  });
  expect(spent(elsewhere)).toBeGreaterThanOrEqual(200);
});

test("assert: absent waits for an element to detach rather than judging it once", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  await apply(harness, "dismiss-chat-greeting");
  await reload(harness);
  // The consent wall removes itself once answered; it is answered 150 ms into the wait.
  await page.evaluate((wall) => {
    setTimeout(() => { (document.querySelector(wall)?.shadowRoot?.querySelector('button[data-choice="essential"]') as HTMLElement).click(); }, 150);
  }, CONSENT_WALL);
  expect(await harness.runAction({ commandId: "absent-late", actionType: "web.dom.assert", selector: CONSENT_WALL, assert: { kind: "absent", timeoutMs: 5_000 } }))
    .toMatchObject({ status: "succeeded", message: "Assertion held: absent.", validation: { status: "passed" } });
  await expect(page.locator(CONSENT_WALL)).toHaveCount(0);
  expect((await siteState(harness)).consent).toBe("essential");
});

test("assert: a command with no assert parameters fails honestly instead of asserting nothing", async ({ openHarness }) => {
  const harness = await openHarness("company-website");
  await settledHome(harness);
  const reply = await harness.runAction({ commandId: "assert-empty", actionType: "web.dom.assert", selector: MAIN_NAV });
  expect(reply).toMatchObject({ status: "failed", message: "web.dom.assert requires assert parameters naming the kind of claim." });
});

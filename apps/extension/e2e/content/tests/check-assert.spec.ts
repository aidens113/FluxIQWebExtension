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
// keyboard-forms drives every control through its server, so `finalState()` is
// an oracle no page assertion can fake: the checkbox and radio rows below pass
// only if the fixture's own `change` handlers really fired.

import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";

const EMAIL_UPDATES = '[data-testid="email-updates"]';
const EMAIL_STATUS = '[data-testid="email-updates-status"]';
const CONTACT_SMS = '[data-testid="contact-sms"]';
const CONTACT_STATUS = '[data-testid="contact-method-status"]';
const DISPLAY_NAME = '[data-testid="display-name"]';
const SETTINGS_FORM = '[data-testid="settings-form"]';
const LISTBOX = '[data-testid="country-listbox"]';
const DISABLED_TARGET = '[data-testid="disabled-target"]';
const DETACH_TARGET = '[data-testid="detach-target"]';

const NEVER = '[data-testid="never"]';

/** Sets `disabled` on a live control, so the rejection path is proven without a fixture that ships one disabled. */
async function disable(page: Page, selector: string): Promise<void> {
  await page.locator(selector).evaluate((element) => { (element as HTMLInputElement).disabled = true; });
}

/**
 * How long the content script actually spent on the action. A claim that does
 * not hold is retried until its window closes, so a row asserting this spent
 * its `timeoutMs` is asserting the polling loop ran -- which the verdict alone
 * cannot say, since a single immediate read reaches the same verdict.
 */
function spent(reply: { startedAt: number; finishedAt: number }): number {
  return reply.finishedAt - reply.startedAt;
}

test("check: sets the checkbox, and the fixture's own change handler records it", async ({ openHarness, page }) => {
  const harness = await openHarness("keyboard-forms");
  const reply = await harness.runAction({ commandId: "check-on", actionType: "web.dom.check", selector: EMAIL_UPDATES, checked: true });
  expect(reply).toMatchObject({
    status: "succeeded",
    message: "Check state set.",
    validation: { status: "passed", expected: "the control is checked", actual: "the checkbox is checked" },
    element: { selector: EMAIL_UPDATES }
  });
  expect(reply.failure).toBeUndefined();
  await expect(page.locator(EMAIL_STATUS)).toHaveText("Email updates: on");
  expect((await harness.finalState()).state).toMatchObject({ preferences: { emailUpdates: true } });
});

test("check: unchecks when asked, and repeating the request is a validated no-op rather than a toggle", async ({ openHarness, page }) => {
  const harness = await openHarness("keyboard-forms");
  await harness.runAction({ commandId: "check-on", actionType: "web.dom.check", selector: EMAIL_UPDATES, checked: true });
  await expect(page.locator(EMAIL_STATUS)).toHaveText("Email updates: on");

  const off = await harness.runAction({ commandId: "check-off", actionType: "web.dom.check", selector: EMAIL_UPDATES, checked: false });
  expect(off).toMatchObject({ status: "succeeded", message: "Check state set.", validation: { status: "passed", actual: "the checkbox is unchecked" } });
  await expect(page.locator(EMAIL_STATUS)).toHaveText("Email updates: off");

  // The row that a click could not pass: asking again for a state the control already holds.
  const again = await harness.runAction({ commandId: "check-off-again", actionType: "web.dom.check", selector: EMAIL_UPDATES, checked: false });
  expect(again).toMatchObject({ status: "succeeded", message: "Check state already set.", validation: { status: "passed", actual: "the checkbox is unchecked" } });
  await expect(page.locator(EMAIL_UPDATES)).not.toBeChecked();
  expect((await harness.finalState()).state).toMatchObject({ preferences: { emailUpdates: false } });
});

test("check: sets a radio and leaves it set when the same request is replayed", async ({ openHarness, page }) => {
  const harness = await openHarness("keyboard-forms");
  const reply = await harness.runAction({ commandId: "radio", actionType: "web.dom.check", selector: CONTACT_SMS, checked: true });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: "the radio is checked" } });
  await expect(page.locator(CONTACT_STATUS)).toHaveText("Contact method: Text message");

  const replay = await harness.runAction({ commandId: "radio-again", actionType: "web.dom.check", selector: CONTACT_SMS, checked: true });
  expect(replay).toMatchObject({ status: "succeeded", message: "Check state already set.", validation: { status: "passed" } });
  await expect(page.locator(CONTACT_SMS)).toBeChecked();
  expect((await harness.finalState()).state).toMatchObject({ preferences: { contactMethod: "sms" } });
});

test("check: unchecking a radio and checking a non-checkable target are both ACTION_REJECTED", async ({ openHarness, page }) => {
  const harness = await openHarness("keyboard-forms");
  await harness.runAction({ commandId: "radio-on", actionType: "web.dom.check", selector: CONTACT_SMS, checked: true });

  const uncheck = await harness.runAction({ commandId: "radio-off", actionType: "web.dom.check", selector: CONTACT_SMS, checked: false });
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
  await expect(page.locator(CONTACT_SMS)).toBeChecked();

  const textField = await harness.runAction({ commandId: "check-text-field", actionType: "web.dom.check", selector: DISPLAY_NAME, checked: true });
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

test("check: a disabled control is rejected with the disabled reason and is left untouched", async ({ openHarness, page }) => {
  const harness = await openHarness("keyboard-forms");
  await disable(page, EMAIL_UPDATES);
  const reply = await harness.runAction({ commandId: "check-disabled", actionType: "web.dom.check", selector: EMAIL_UPDATES, checked: true });
  expect(reply).toMatchObject({
    status: "failed",
    validation: { status: "failed", actual: "the checkbox is disabled" },
    failure: {
      category: "blocked_by_capability_or_policy", code: "web.action.rejected", retryable: false,
      expected: "the control is checked", actual: "disabled: the checkbox is disabled"
    }
  });
  await expect(page.locator(EMAIL_UPDATES)).not.toBeChecked();
  await expect(page.locator(EMAIL_STATUS)).toHaveText("Email updates: off");
});

test("assert: exists and absent judge what the page holds now", async ({ openHarness }) => {
  const harness = await openHarness("keyboard-forms");
  expect(await harness.runAction({ commandId: "exists", actionType: "web.dom.assert", selector: SETTINGS_FORM, assert: { kind: "exists" } }))
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
    validation: { status: "failed", actual: `nothing matched "${NEVER}"` },
    failure: {
      category: "timeout", code: "web.action.timeout", retryable: true, stage: "execution",
      expected: `an element matching "${NEVER}" exists`, actual: `nothing matched "${NEVER}"`
    }
  });
  expect(spent(missing)).toBeGreaterThanOrEqual(200);
});

test("assert: a kind is not what decides a timeout -- the same claim mismatches when there is something to read", async ({ openHarness, page }) => {
  const harness = await openHarness("keyboard-forms");
  // `visible` on a selector nothing matches has no element to look at, so it
  // waits in vain: TIMEOUT, exactly as `exists` does.
  const nothing = await harness.runAction({ commandId: "visible-nothing", actionType: "web.dom.assert", selector: NEVER, assert: { kind: "visible", timeoutMs: 200 } });
  expect(nothing).toMatchObject({
    status: "timed_out",
    validation: { status: "failed", actual: `nothing matched "${NEVER}"` },
    failure: { category: "timeout", code: "web.action.timeout", retryable: true, stage: "execution" }
  });
  expect(spent(nothing)).toBeGreaterThanOrEqual(200);

  // The same kind against an element that is there but hidden is judged, so it
  // is a state the page is in. The pair is the whole rule: what separates the
  // two records is whether the page could be read, not which kind was asked.
  const hidden = await harness.runAction({ commandId: "visible-present", actionType: "web.dom.assert", selector: LISTBOX, assert: { kind: "visible", timeoutMs: 200 } });
  expect(hidden).toMatchObject({
    status: "failed",
    failure: { category: "unexpected_state", code: "web.validation.state_mismatch", retryable: false, stage: "verification" }
  });
  await expect(page.locator(LISTBOX)).toHaveCount(1);
});

test("assert: absent is not the mirror of exists -- an element that never goes is a mismatch, not a timeout", async ({ openHarness }) => {
  const harness = await openHarness("keyboard-forms");
  // `absent` holds when nothing matches, so it cannot fail by waiting in vain.
  // Its only failure is seeing the element it was told would go, which is a
  // definite observation of the page and therefore STATE_MISMATCH -- however
  // long it waited to make it.
  const stays = await harness.runAction({ commandId: "absent-stays", actionType: "web.dom.assert", selector: SETTINGS_FORM, assert: { kind: "absent", timeoutMs: 200 } });
  expect(stays).toMatchObject({
    status: "failed",
    message: "Assertion did not hold: absent.",
    validation: { status: "failed", expected: `no element matches "${SETTINGS_FORM}"`, actual: `"${SETTINGS_FORM}" is still present` },
    failure: {
      category: "unexpected_state", code: "web.validation.state_mismatch", retryable: false, stage: "verification",
      actual: `"${SETTINGS_FORM}" is still present`
    }
  });
  // It did wait, all the same: the verdict is a judgement, not a shortcut.
  expect(spent(stays)).toBeGreaterThanOrEqual(200);
});

test("assert: a text claim that does not hold is STATE_MISMATCH carrying both sides", async ({ openHarness }) => {
  const harness = await openHarness("keyboard-forms");
  expect(await harness.runAction({ commandId: "text-ok", actionType: "web.dom.assert", selector: EMAIL_STATUS, assert: { kind: "text", expected: "Email updates: off" } }))
    .toMatchObject({ status: "succeeded", validation: { status: "passed" } });

  const wrong = await harness.runAction({ commandId: "text-wrong", actionType: "web.dom.assert", selector: EMAIL_STATUS, assert: { kind: "text", expected: "Email updates: on", timeoutMs: 200 } });
  expect(wrong).toMatchObject({
    status: "failed",
    message: "Assertion did not hold: text.",
    validation: {
      status: "failed",
      expected: '"[data-testid="email-updates-status"]" contains "Email updates: on"',
      actual: '"[data-testid="email-updates-status"]" reads "Email updates: off"'
    },
    failure: {
      category: "unexpected_state", code: "web.validation.state_mismatch", retryable: false, stage: "verification",
      expected: '"[data-testid="email-updates-status"]" contains "Email updates: on"',
      actual: '"[data-testid="email-updates-status"]" reads "Email updates: off"'
    }
  });
  // The claim is the user's, so it is never reported as the action's own unobserved output.
  expect(wrong.failure?.category).not.toBe("output_not_observed");
  // The element was there to read, so the verdict is a mismatch -- but the verb
  // still gave the page its whole window to change its mind.
  expect(spent(wrong)).toBeGreaterThanOrEqual(200);
});

test("assert: visible fails for a hidden element and holds once the page shows it", async ({ openHarness, page }) => {
  const harness = await openHarness("keyboard-forms");
  const hidden = await harness.runAction({ commandId: "visible-hidden", actionType: "web.dom.assert", selector: LISTBOX, assert: { kind: "visible", timeoutMs: 200 } });
  expect(hidden).toMatchObject({
    status: "failed",
    validation: { status: "failed", actual: "it is present but not visible" },
    failure: {
      category: "unexpected_state", code: "web.validation.state_mismatch", retryable: false, stage: "verification",
      actual: "it is present but not visible"
    }
  });
  expect(spent(hidden)).toBeGreaterThanOrEqual(200);

  // Shown late, so the retry loop -- not a single immediate read -- is what makes it pass.
  await page.evaluate((selector) => {
    setTimeout(() => { (document.querySelector(selector) as HTMLElement).hidden = false; }, 150);
  }, LISTBOX);
  expect(await harness.runAction({ commandId: "visible-shown", actionType: "web.dom.assert", selector: LISTBOX, assert: { kind: "visible", timeoutMs: 5_000 } }))
    .toMatchObject({ status: "succeeded", validation: { status: "passed", actual: "it is visible" } });
});

test("assert: enabled tells the disabled button from the live one", async ({ openHarness }) => {
  const harness = await openHarness("failure-surfaces");
  expect(await harness.runAction({ commandId: "enabled-live", actionType: "web.dom.assert", selector: DETACH_TARGET, assert: { kind: "enabled" } }))
    .toMatchObject({ status: "succeeded", validation: { status: "passed", actual: "it is enabled" } });

  const disabled = await harness.runAction({ commandId: "enabled-disabled", actionType: "web.dom.assert", selector: DISABLED_TARGET, assert: { kind: "enabled", timeoutMs: 200 } });
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
  const harness = await openHarness("failure-surfaces");
  expect(await harness.runAction({ commandId: "url-ok", actionType: "web.dom.assert", assert: { kind: "url", expected: "/scenarios/failure-surfaces/" } }))
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
  const harness = await openHarness("failure-surfaces");
  await page.evaluate((selector) => {
    setTimeout(() => { (document.querySelector(selector) as HTMLElement).click(); }, 150);
  }, DETACH_TARGET);
  expect(await harness.runAction({ commandId: "absent-late", actionType: "web.dom.assert", selector: DETACH_TARGET, assert: { kind: "absent", timeoutMs: 5_000 } }))
    .toMatchObject({ status: "succeeded", message: "Assertion held: absent.", validation: { status: "passed" } });
  await expect(page.locator(DETACH_TARGET)).toHaveCount(0);
});

test("assert: a command with no assert parameters fails honestly instead of asserting nothing", async ({ openHarness }) => {
  const harness = await openHarness("keyboard-forms");
  const reply = await harness.runAction({ commandId: "assert-empty", actionType: "web.dom.assert", selector: SETTINGS_FORM });
  expect(reply).toMatchObject({ status: "failed", message: "web.dom.assert requires assert parameters naming the kind of claim." });
});

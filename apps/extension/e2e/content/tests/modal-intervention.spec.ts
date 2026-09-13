// A modal dialog standing over the page is not the page refusing the action.
// It is the page waiting for a person, and `web.intervention.required` is the
// code that says so.
//
// Until this rule existed, `web.intervention.required` had exactly one producer
// in the whole tree -- the domain adapter's "no single paired client" rejection
// -- and nothing in the browser path could produce it at all. A run met by an
// unrecorded cookie wall or upsell interstitial reported `web.action.rejected`,
// whose Core category is `blocked_by_capability_or_policy`: "a capability,
// policy, or authorization gate refused the action". That tells an orchestrator
// the recorded step is wrong and no retry can help, when the truth is that one
// dismissal by a person unblocks the whole run. The plan's own corpus says the
// same thing from the other side -- W14 (`modal-flows/interstitial/armed`)
// requires `user_intervention_required`, and no producer existed that could
// have satisfied it.
//
// The rule needs both halves, and the three rows below are one per half plus
// the case that has neither:
//
//   1. The invite dialog, opened by the page itself. `shell.inert = true` is
//      what a correct modal does, so `actionability.ts` refuses the target as
//      `hidden` -- not `covered`. That is the shape the real pattern produces
//      and the one a rule written only for backdrops would miss.
//   2. The W14 interstitial, armed and met on the second Add section. This is
//      the corpus row, end to end, and it also proves the run stops with one
//      section added rather than clicking through the offer.
//   3. The consent banner, which covers the primary action and is *not* a
//      modal. It stays `web.action.rejected`, which is right -- and it is the
//      row that keeps the rule from degenerating into "any refusal on a page
//      that has a dialog in its markup". `modal-flows` keeps the invite dialog
//      in the DOM behind `hidden` at all times, so row 3 also proves that a
//      dialog the browser is not painting does not count.
//
// Scope: this is the content script's own decision against a live DOM. What
// Core then does with the category is the Flow lane's, and the Lab's W14 row is
// the end-to-end proof.

import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

const ADD_SECTION = "[data-testid=\"add-section\"]";
const PUBLISH = "[data-testid=\"publish-draft\"]";
const OPEN_INVITE = "[data-testid=\"open-invite\"]";
const INVITE_DIALOG = "[data-testid=\"invite-dialog\"]";
const INTERSTITIAL = "[data-testid=\"interstitial\"]";

/** The record every row reads, narrowed to what it asserts on. */
const INTERVENTION = {
  category: "user_intervention_required",
  code: "web.intervention.required",
  retryable: false,
  stage: "execution"
};

/**
 * Applies one Scenario Lab operation and reloads, which is how a variant that
 * the page script bakes in at render time is armed. `arm-interstitial` only
 * moves server state; the offer's `<template>` reaches the page on the next
 * render.
 */
async function armAndReload(harness: ContentHarness, operation: string): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/modal-flows/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: "{}"
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
  await harness.page.goto(harness.url);
  await expect
    .poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady"))
    .toBe(true);
}

test("a target behind an open modal is an intervention, not a rejection", async ({ openHarness, page }) => {
  const harness = await openHarness("modal-flows");
  // Opened by the page, as a person would: the dialog is shown and the shell
  // behind it is marked inert, which is the whole of the ARIA modal contract.
  await page.locator(OPEN_INVITE).click();
  await expect(page.locator(INVITE_DIALOG)).toBeVisible();

  const reply = await harness.runAction({ commandId: "click-behind-modal", actionType: "web.dom.click", selector: ADD_SECTION });

  expect(reply).toMatchObject({ status: "failed", failure: INTERVENTION });
  // The refusal itself is unchanged and still says which property stopped it;
  // only the code moved, and the record carries both.
  expect(reply.validation).toMatchObject({ status: "failed", expected: "a target that can be clicked", actual: "the element is inert" });
  expect(reply.failure?.actual).toBe(
    "hidden: the element is inert; a modal dialog is open over the page, so a person has to answer it before the run can continue"
  );
  // The refusal is real: the run did not click through the dialog.
  expect((await harness.finalState()).state).toMatchObject({ sectionCount: 0 });
});

test("W14: the armed interstitial stops the second Add section as an intervention", async ({ openHarness, page }) => {
  const harness = await openHarness("modal-flows");
  await armAndReload(harness, "arm-interstitial");

  const first = await harness.runAction({ commandId: "add-first", actionType: "web.dom.click", selector: ADD_SECTION });
  expect(first.status, first.message).toBe("succeeded");
  await expect(page.locator(INTERSTITIAL)).toBeVisible();

  const second = await harness.runAction({ commandId: "add-second", actionType: "web.dom.click", selector: ADD_SECTION });

  expect(second).toMatchObject({ status: "failed", failure: INTERVENTION });
  // The corpus row's own expectation: one section added, the offer still up.
  expect((await harness.finalState()).state).toMatchObject({ sectionCount: 1, interstitial: "open" });
  await expect(page.locator(INTERSTITIAL)).toBeVisible();
});

test("an overlay that is not modal stays a rejection, and a dialog the page is not painting does not count", async ({ openHarness }) => {
  const harness = await openHarness("modal-flows");

  // The consent banner is fixed over the action bar and owns the primary
  // action, but it declares no modality and makes nothing inert. Meanwhile the
  // invite dialog is in the markup with `aria-modal="true"` and `hidden`.
  const reply = await harness.runAction({ commandId: "click-under-banner", actionType: "web.dom.click", selector: PUBLISH });

  expect(reply).toMatchObject({
    status: "failed",
    failure: { category: "blocked_by_capability_or_policy", code: "web.action.rejected", retryable: false, stage: "execution" }
  });
  expect(reply.failure?.actual).toMatch(/^covered: /u);
  expect(reply.message).toMatch(/^Action rejected: /u);
  expect((await harness.finalState()).state).toMatchObject({ publishCount: 0 });
});

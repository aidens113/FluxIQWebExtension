// The three verbs that used to act on a target without asking whether it could
// be acted on: `web.dom.check`, `web.dom.upload` and `web.dom.scroll`.
//
// A gate that a verb does not call cannot refuse anything, and the failure that
// leaves behind is the worst kind: the page is covered by a consent dialog, the
// control behind it is set anyway, the result says `succeeded`, and the run
// carries on against a page that never changed. These rows are that situation
// on the fixtures that ship it -- bigbox-retail opens every page under a scrim
// with a modal consent dialog over it, which is where the campaign's runs met
// it -- and the answers the three verbs give now.
//
// The gate is not the same instrument for all three, and the rows say which
// part of it each verb is held to:
//
// - **check** operates a control a person operates, so the whole gate applies:
//   covered, hidden, disabled. A checkbox behind a scrim is refused, and
//   because a modal dialog is what covers it, the refusal is reported as
//   BLOCKED_BY_DIALOG rather than as a capability refusal.
// - **upload** puts files into an input through a `DataTransfer` and never
//   presses it, and the standard way to ship a file input on the web is to
//   hide it behind a styled label -- job-board and everything-store both do --
//   so "no visible box" is not evidence that the upload would not work. What
//   is evidence is `disabled`: a disabled input takes the files and submits
//   none of them.
// - **scroll** moves the page to the target; nothing covering the target stops
//   it from arriving, and refusing would take away the move that reveals a
//   covered control in the first place. So the gate is read for *evidence*
//   there: the scroll still happens, and its validation says what is on top.

import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";

/** A facet in bigbox-retail's results sidebar: an ordinary checkbox whose change filters the page. */
const PICKUP_FACET = 'input[type="checkbox"][value="fulfillment_method:Pickup"]';
const SEARCH_PATH = "/scenarios/bigbox-retail/search?q=paper+towels";
const UPLOAD_INPUT = '[data-testid="upload-file"]';

/** One small file, so the upload rows carry no content worth reading. */
const FILE = { name: "supporting.txt", mimeType: "text/plain", contentBase64: Buffer.from("supporting evidence\n").toString("base64") };

/** The validation's `actual`, or a failure naming the reason there was none. */
function actualOf(result: BrowserActionResult): string {
  if (result.validation.status === "none") throw new Error(`The reply reported no validation: ${result.validation.reason}`);
  return result.validation.actual;
}

test("check: a checkbox behind the consent dialog's scrim is refused, and the page is left alone", async ({ openHarness, page }) => {
  const harness = await openHarness("bigbox-retail");
  await page.goto(new URL(SEARCH_PATH, harness.url).href);
  await expect(page.locator(PICKUP_FACET)).toHaveCount(1);
  // The premise: the store's consent dialog is up, and its scrim is what a
  // press aimed at the sidebar would land on.
  await expect(page.locator('[role="dialog"][aria-modal="true"]')).toBeVisible();
  const before = page.url();

  const reply = await harness.runAction({
    commandId: "check:covered",
    actionType: "web.dom.check",
    selector: PICKUP_FACET,
    checked: true
  });

  expect(reply, reply.message).toMatchObject({
    status: "failed",
    failure: { code: "web.action.blocked_by_dialog", category: "unexpected_state" }
  });
  expect(actualOf(reply)).toContain("covers the target");
  // Nothing was set, so the page never filtered: the fixture navigates on the
  // facet's own `change` event, which is the oracle for "the check happened".
  await expect(page.locator(PICKUP_FACET)).not.toBeChecked();
  expect(page.url()).toBe(before);
});

test("check: the same checkbox is set once the dialog is answered", async ({ openHarness, page }) => {
  const harness = await openHarness("bigbox-retail");
  await page.goto(new URL(SEARCH_PATH, harness.url).href);
  await page.getByRole("button", { name: "Accept all" }).click();
  await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(0);

  const reply = await harness.runAction({
    commandId: "check:clear",
    actionType: "web.dom.check",
    selector: PICKUP_FACET,
    checked: true
  });
  expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: "the checkbox is checked" } });
  await expect(page).toHaveURL(/facet=fulfillment_method%3APickup/u);
});

test("upload: a file input the page keeps out of sight still takes the file", async ({ openHarness, page }) => {
  const harness = await openHarness("file-transfer");
  // How the web ships a file input: hidden, with a styled control in front of
  // it. Refusing this would refuse nearly every real upload.
  await page.locator(UPLOAD_INPUT).evaluate((element) => { (element as HTMLElement).style.display = "none"; });

  const reply = await harness.runAction({
    commandId: "upload:hidden",
    actionType: "web.dom.upload",
    selector: UPLOAD_INPUT,
    upload: { files: [FILE] }
  });
  expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: "1 file, named as requested" } });
});

test("upload: a disabled file input is refused instead of taking files nothing would send", async ({ openHarness, page }) => {
  const harness = await openHarness("file-transfer");
  await page.locator(UPLOAD_INPUT).evaluate((element) => { (element as HTMLInputElement).disabled = true; });

  const reply = await harness.runAction({
    commandId: "upload:disabled",
    actionType: "web.dom.upload",
    selector: UPLOAD_INPUT,
    upload: { files: [FILE] }
  });
  expect(reply, reply.message).toMatchObject({
    status: "failed",
    failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" }
  });
  expect(actualOf(reply)).toContain("disabled");
  expect(await page.locator(UPLOAD_INPUT).evaluate((element) => (element as HTMLInputElement).files?.length ?? 0)).toBe(0);
});

test("upload: a file input in an inert subtree is refused, because the page has stopped listening", async ({ openHarness, page }) => {
  const harness = await openHarness("file-transfer");
  // What a modal prompt does to the page behind it: everything-store's
  // notifications prompt makes the whole page inert while it is up.
  await page.locator('[data-testid="upload-form"]').evaluate((element) => { (element as HTMLElement).setAttribute("inert", ""); });

  const reply = await harness.runAction({
    commandId: "upload:inert",
    actionType: "web.dom.upload",
    selector: UPLOAD_INPUT,
    upload: { files: [FILE] }
  });
  expect(reply, reply.message).toMatchObject({ status: "failed", failure: { code: "web.action.rejected" } });
  expect(actualOf(reply)).toContain("inert");
});

test("scroll: a covered target is still scrolled to, and the result says what is on top of it", async ({ openHarness, page }) => {
  const harness = await openHarness("bigbox-retail");
  await page.goto(new URL(SEARCH_PATH, harness.url).href);
  await expect(page.locator(PICKUP_FACET)).toHaveCount(1);

  const reply = await harness.runAction({
    commandId: "scroll:covered",
    actionType: "web.dom.scroll",
    selector: PICKUP_FACET,
    scroll: { mode: "toElement" }
  });
  expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  expect(actualOf(reply), "the scroll reports the cover it found rather than refusing").toContain("covers the target");
});

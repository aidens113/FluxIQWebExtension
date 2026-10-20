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
//   BLOCKED_BY_DIALOG rather than as a capability refusal. That refusal is
//   no longer where the command ends: since 2026-09-28 (260a4e17) every verb
//   absorbs it, answers the dialog through its own way out, and runs again
//   (`action-runtime/recovery/fault.ts`), so the row proves the box was set
//   only after the dialog was answered, never through the scrim.
//
//   bigbox's facets navigate on their own `change`, and the check verb reads
//   its control back 50 ms after the press (4d7a1447, 2026-10-06), so the
//   page usually unloads before the content script answers. In the extension
//   the background then judges the requested state on the new document
//   (`runtime/click-landing.ts`, t407, written for these very facets); this
//   harness has no background, so the check rows do the same judgement here.
// - **upload** puts files into an input through a `DataTransfer` and never
//   presses it, and the standard way to ship a file input on the web is to
//   hide it behind a styled control -- job-board's application form and
//   everything-store's image search both do, and the upload rows run on the
//   first --
//   so "no visible box" is not evidence that the upload would not work. What
//   is evidence is `disabled`: a disabled input takes the files and submits
//   none of them.
// - **scroll** moves the page to the target; nothing covering the target stops
//   it from arriving, and refusing would take away the move that reveals a
//   covered control in the first place. So the gate is read for *evidence*
//   there: the scroll still happens, and its validation says what is on top.

import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** A facet in bigbox-retail's results sidebar: an ordinary checkbox whose change filters the page. */
const PICKUP_FACET = 'input[type="checkbox"][value="fulfillment_method:Pickup"]';
const SEARCH_PATH = "/scenarios/bigbox-retail/search?q=paper+towels";
/** Talentloom's application form on job-board, opened as its frame's document (the harness talks to the top frame only). */
const APPLICATION_PATH = "/scenarios/job-board/embed/job_app?for=quillmark&token=QM-4471";
/** Its CV input: shipped hidden, behind an "Attach" button that calls `click()` on it. */
const UPLOAD_INPUT = 'input[type="file"][name="resume"]';

/** One small file, so the upload rows carry no content worth reading. */
const FILE = { name: "supporting.txt", mimeType: "text/plain", contentBase64: Buffer.from("supporting evidence\n").toString("base64") };

/** Opens job-board's application form at the top of the harness page and waits for the content script there. */
async function openApplicationForm(harness: ContentHarness): Promise<void> {
  await harness.page.goto(new URL(APPLICATION_PATH, harness.lab.frameOrigin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await expect(harness.page.locator(UPLOAD_INPUT)).toHaveCount(1);
}

/** The validation's `actual`, or a failure naming the reason there was none. */
function actualOf(result: BrowserActionResult): string {
  if (result.validation.status === "none") throw new Error(`The reply reported no validation: ${result.validation.reason}`);
  return result.validation.actual;
}

/** What the facet's own navigation leaves in the address once the box was really ticked. */
const PICKUP_FILTERED = /facet=fulfillment_method%3APickup/u;

/**
 * Sends a check whose `change` navigates the page: the reply, when the content
 * script answered before the page unloaded, or `"lost"` when the page went
 * first -- the harness's form of the "message port closed" the background
 * reads as a reply lost to navigation (`runtime/navigating-page.ts`).
 */
async function runNavigatingCheck(harness: ContentHarness, commandId: string): Promise<BrowserActionResult | "lost"> {
  try {
    return await harness.runAction({ commandId, actionType: "web.dom.check", selector: PICKUP_FACET, checked: true });
  } catch (error) {
    if (/Execution context was destroyed|navigat/u.test(String(error))) return "lost";
    throw error;
  }
}

/**
 * Judges the check as the background judges one whose reply was lost
 * (`runtime/click-landing.ts`, t407): the facet's navigation landed, and the
 * new document shows the requested state. A reply that did arrive must say
 * the same; anything the recovery absorbed on the way is appended to its
 * `actual` after a semicolon.
 */
async function expectPickupFilterSet(harness: ContentHarness, reply: BrowserActionResult | "lost"): Promise<void> {
  if (reply !== "lost") expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: expect.stringMatching(/^the checkbox is checked(?:;|$)/u) } });
  await expect(harness.page).toHaveURL(PICKUP_FILTERED);
  await expect(harness.page.locator(PICKUP_FACET)).toBeChecked();
}

test("check: a checkbox behind the consent dialog's scrim is not set through it; the dialog is answered first", async ({ openHarness, page }) => {
  const harness = await openHarness("bigbox-retail");
  await page.goto(new URL(SEARCH_PATH, harness.url).href);
  await expect(page.locator(PICKUP_FACET)).toHaveCount(1);
  // The premise: the store's consent dialog is up, and its scrim is what a
  // press aimed at the sidebar would land on.
  await expect(page.locator('[role="dialog"][aria-modal="true"]')).toBeVisible();
  expect((await harness.finalState()).state).toMatchObject({ consent: "pending" });

  const reply = await runNavigatingCheck(harness, "check:covered");

  // The gate refused the first attempt as BLOCKED_BY_DIALOG, and the defence
  // answered the dialog by its way out -- "Reject all", never "Accept all" --
  // before the second attempt set the box. Had the box been set through the
  // scrim, the consent would still be pending: the facet's navigation would
  // have left before anything answered it.
  await expectPickupFilterSet(harness, reply);
  // When the reply outran the navigation, it says so itself.
  if (reply !== "lost") expect(actualOf(reply)).toContain("after absorbing blocking_dialog, closing 1 dialog");
  expect((await harness.finalState()).state).toMatchObject({ consent: "rejected" });
  await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(0);
});

test("check: the same checkbox is set once the dialog is answered", async ({ openHarness, page }) => {
  const harness = await openHarness("bigbox-retail");
  await page.goto(new URL(SEARCH_PATH, harness.url).href);
  await page.getByRole("button", { name: "Accept all" }).click();
  await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(0);
  await expect.poll(async () => (await harness.finalState()).state).toMatchObject({ consent: "accepted" });

  await expectPickupFilterSet(harness, await runNavigatingCheck(harness, "check:clear"));
});

test("upload: a file input the page keeps out of sight still takes the file", async ({ openHarness, page }) => {
  const harness = await openHarness("job-board");
  await openApplicationForm(harness);
  // How the web ships a file input, and how Talentloom ships its CV input:
  // hidden, with a styled control in front of it. Refusing this would refuse
  // nearly every real upload.
  await expect(page.locator(UPLOAD_INPUT)).toBeHidden();

  const reply = await harness.runAction({
    commandId: "upload:hidden",
    actionType: "web.dom.upload",
    selector: UPLOAD_INPUT,
    upload: { files: [FILE] }
  });
  expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: "1 file, named as requested" } });
});

test("upload: a disabled file input is refused instead of taking files nothing would send", async ({ openHarness, page }) => {
  const harness = await openHarness("job-board");
  await openApplicationForm(harness);
  // The form ships its input enabled; disabling it is the one change a page makes when it stops taking files.
  await page.locator(UPLOAD_INPUT).evaluate((element) => { (element as HTMLInputElement).disabled = true; });

  const reply = await harness.runAction({
    commandId: "upload:disabled",
    actionType: "web.dom.upload",
    selector: UPLOAD_INPUT,
    upload: { files: [FILE] }
  });
  expect(reply, reply.message).toMatchObject({
    status: "failed",
    failure: { code: "web.target.not_actionable", category: "unexpected_state" }
  });
  expect(actualOf(reply)).toContain("disabled");
  expect(await page.locator(UPLOAD_INPUT).evaluate((element) => (element as HTMLInputElement).files?.length ?? 0)).toBe(0);
});

test("upload: a file input in an inert subtree is refused, because the page has stopped listening", async ({ openHarness, page }) => {
  const harness = await openHarness("job-board");
  await openApplicationForm(harness);
  // What a modal prompt does to the page behind it: everything-store's
  // notifications prompt makes the whole page inert while it is up. Made inert
  // here by hand, because a real prompt would be closed by the defence first.
  await page.locator("form").evaluate((element) => { (element as HTMLElement).setAttribute("inert", ""); });

  const reply = await harness.runAction({
    commandId: "upload:inert",
    actionType: "web.dom.upload",
    selector: UPLOAD_INPUT,
    upload: { files: [FILE] }
  });
  // An inert control is one the gate calls `hidden`: not shown, Core's `target_not_found` (t193-1002m).
  expect(reply, reply.message).toMatchObject({ status: "failed", failure: { code: "web.target.not_shown", category: "target_not_found" } });
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

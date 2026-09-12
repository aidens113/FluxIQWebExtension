// `web.dom.upload` and `web.dom.dialog` against live pages: a real file input
// on the file-transfer fixture (corpus row W17) and the native `confirm()` that
// guards Delete draft on modal-flows.
//
// The dialog tests are only meaningful because Playwright's own default is to
// DISMISS every native dialog it sees. So an accepted confirm cannot come from
// the test runner: if the page-world override were missing, `confirm()` would
// open a real dialog, Playwright would dismiss it, and the draft would survive.
// A deleted draft proves the override answered the call itself.

import { expect, test } from "../index.js";

const UPLOAD_INPUT = '[data-testid="upload-file"]';
const UPLOAD_SUBMIT = '[data-testid="upload-submit"]';
const UPLOAD_RESULT = '[data-testid="upload-result"]';
const DELETE_DRAFT = '[data-testid="delete-draft"]';
const DRAFT_STATUS = '[data-testid="draft-status"]';

const UPLOAD_NAME = "expense-receipts.csv";
const UPLOAD_CONTENT = "category,amount\ntravel,42\nmeals,18\n";
const UPLOAD_BYTES = Buffer.byteLength(UPLOAD_CONTENT, "utf8");
const UPLOAD_FILE = { name: UPLOAD_NAME, mimeType: "text/csv", contentBase64: Buffer.from(UPLOAD_CONTENT, "utf8").toString("base64") };

/** The text the modal-flows fixture passes to `window.confirm()` for Delete draft. */
const DELETE_PROMPT = "Delete this draft? This cannot be undone.";

test("upload: puts the file on the input and validates the names it ended up holding", async ({ openHarness, page }) => {
  const harness = await openHarness("file-transfer");
  const reply = await harness.runAction({
    commandId: "upload", actionType: "web.dom.upload", selector: UPLOAD_INPUT, upload: { files: [UPLOAD_FILE] }
  });
  expect(reply).toMatchObject({
    status: "succeeded",
    message: "Files uploaded.",
    validation: { status: "passed", expected: UPLOAD_NAME, actual: UPLOAD_NAME }
  });
  // The result describes the element it acted on. How that descriptor spells
  // the selector is describe-element.ts's business -- it prefers an id, so this
  // input comes back as "#upload-file" -- and pinning the spelling here would
  // couple an upload spec to element identification.
  expect(reply.element).toBeDefined();
  // The page really holds the file: name, size and type, not just a reply.
  expect(await page.locator(UPLOAD_INPUT).evaluate((element) => {
    const file = (element as HTMLInputElement).files?.[0];
    return file ? { name: file.name, size: file.size, type: file.type } : null;
  })).toEqual({ name: UPLOAD_NAME, size: UPLOAD_BYTES, type: "text/csv" });
});

test("upload: W17 -- the fixture echoes the uploaded file once the form is submitted", async ({ openHarness, page }) => {
  const harness = await openHarness("file-transfer");
  await harness.runAction({
    commandId: "upload-w17", actionType: "web.dom.upload", selector: UPLOAD_INPUT, upload: { files: [UPLOAD_FILE] }
  });
  await page.locator(UPLOAD_SUBMIT).click();
  await expect(page.locator(UPLOAD_RESULT)).toHaveText(`Uploaded ${UPLOAD_NAME}`);
  expect((await harness.finalState()).state).toMatchObject({
    uploadCount: 1,
    lastUpload: { name: UPLOAD_NAME, size: UPLOAD_BYTES }
  });
});

test("upload: a target that cannot hold files is rejected, not reported as a success", async ({ openHarness }) => {
  const harness = await openHarness("file-transfer");
  const reply = await harness.runAction({
    commandId: "upload-wrong-target", actionType: "web.dom.upload", selector: UPLOAD_SUBMIT, upload: { files: [UPLOAD_FILE] }
  });
  expect(reply).toMatchObject({
    status: "failed",
    validation: { status: "failed", expected: UPLOAD_NAME, actual: "the target is a button, not a file input" },
    failure: { category: "blocked_by_capability_or_policy", code: "web.action.upload_rejected", retryable: false }
  });
});

test("dialog: an armed dismiss answers the native confirm, and the arming is consumed by it", async ({ openHarness, page }) => {
  const harness = await openHarness("modal-flows");
  const armed = await harness.runAction({
    commandId: "arm-dismiss", actionType: "web.dom.dialog", dialog: { response: "dismiss" }
  });
  expect(armed).toMatchObject({
    status: "succeeded",
    message: "Dialog response armed.",
    validation: { status: "passed", expected: "the next dialog is dismissed" }
  });

  await page.locator(DELETE_DRAFT).click();
  await expect(page.locator(DRAFT_STATUS)).toHaveText("Draft active");

  // One arming answers one dialog: this second confirm is unarmed, falls
  // through to the real one, and Playwright's default dismisses it.
  await page.locator(DELETE_DRAFT).click();
  await expect(page.locator(DRAFT_STATUS)).toHaveText("Draft active");
  expect((await harness.finalState()).state).toMatchObject({
    draft: "active",
    deletePrompts: { accepted: 0, dismissed: 2 }
  });
});

test("dialog: an armed accept deletes the draft and is reported as evidence afterwards", async ({ openHarness, page }) => {
  const harness = await openHarness("modal-flows");
  await harness.runAction({ commandId: "arm-accept", actionType: "web.dom.dialog", dialog: { response: "accept" } });
  await page.locator(DELETE_DRAFT).click();
  await expect(page.locator(DRAFT_STATUS)).toHaveText("Draft deleted");
  expect((await harness.finalState()).state).toMatchObject({
    draft: "deleted",
    deletePrompts: { accepted: 1, dismissed: 0 }
  });

  // The next dialog action carries the dialog the override actually handled.
  const next = await harness.runAction({ commandId: "arm-again", actionType: "web.dom.dialog", dialog: { response: "dismiss" } });
  expect(next.extracted).toMatchObject({ kind: "confirm", message: DELETE_PROMPT, response: "accept" });
});

test("dialog: a command with no dialog request is refused rather than arming nothing", async ({ openHarness }) => {
  const harness = await openHarness("modal-flows");
  const reply = await harness.runAction({ commandId: "arm-empty", actionType: "web.dom.dialog" });
  expect(reply).toMatchObject({
    status: "failed",
    validation: { status: "failed", expected: "a dialog response to arm", actual: "the command carried no dialog request" },
    failure: { category: "blocked_by_capability_or_policy", code: "web.action.dialog_no_response", retryable: false }
  });
});

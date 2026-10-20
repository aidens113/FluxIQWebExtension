// `web.dom.upload` and `web.dom.dialog` against live pages.
//
// Uploads use the realistic file input that exists: job-board's Talentloom
// application form, where the CV input is hidden behind an "Attach" button
// (corpus row W17). The form is embedded on the employer's careers page from
// a second origin; the content harness talks to the top frame only, so these
// rows open the form's own document, as the frame loads it, at the top.
//
// The native-dialog rows split two ways. Arming refused for an empty command,
// and a `prompt()` the page's world asks, need nothing from the page: they run
// over job-board's form too. The two `confirm()` rows need a page whose own
// control calls `confirm()` and records the answer. They run on
// company-website's "Offers & reminders" page armed with
// `confirm-unsubscribe`, where "Unsubscribe" asks the browser's confirmation
// before an address leaves the list and the site counts each answer in
// `newsletter.unsubscribePrompts`.
//
// The dialog tests are only meaningful because Playwright's own default is to
// DISMISS every native dialog it sees. So an accepted confirm cannot come from
// the test runner: if the page-world override were missing, `confirm()` would
// open a real dialog, Playwright would dismiss it, and the address would stay.
// An address taken off the list proves the override answered the call itself.

import { UNSUBSCRIBE_CONFIRM_TEXT } from "../../../../scenario-lab/src/scenarios/company-website/index.js";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

/** Talentloom's application form for Quillmark's Senior Rust Engineer (QM-4471), as the careers page frames it. */
const APPLICATION_PATH = "/scenarios/job-board/embed/job_app?for=quillmark&token=QM-4471";
const UPLOAD_INPUT = 'input[type="file"][name="resume"]';
/** The form's own echo of the chosen file, written by its `change` handler. */
const UPLOAD_ECHO = ".tl-filename";
const ATTACH_BUTTON = ".tl-attach";

/** The subscribed address's "Unsubscribe" on company-website's newsletter page. */
const UNSUBSCRIBE = "[data-unsubscribe]";
const NEWSLETTER_EMAIL = "ada.synthetic@example.test";

const UPLOAD_NAME = "ada-synthetic-cv.txt";
const UPLOAD_CONTENT = "Ada Synthetic\nSenior Rust Engineer\nLedger services, Kubernetes.\n";
const UPLOAD_BYTES = Buffer.byteLength(UPLOAD_CONTENT, "utf8");
const UPLOAD_FILE = { name: UPLOAD_NAME, mimeType: "text/plain", contentBase64: Buffer.from(UPLOAD_CONTENT, "utf8").toString("base64") };

type JobBoardState = { applications: Array<{ answers: { resume: string } }> };
type NewsletterState = { newsletter: { subscribers: string[]; unsubscribePrompts: { accepted: number; dismissed: number } } };

/** Opens Talentloom's application form as its frame's document and waits for the content script there. */
async function openApplicationForm(harness: ContentHarness): Promise<string> {
  const url = new URL(APPLICATION_PATH, harness.lab.frameOrigin).href;
  await harness.page.goto(url);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await expect(harness.page.locator(UPLOAD_INPUT)).toHaveCount(1);
  return url;
}

test("upload: puts the file on the input and validates the names it ended up holding", async ({ openHarness, page }) => {
  const harness = await openHarness("job-board");
  await openApplicationForm(harness);
  const reply = await harness.runAction({
    commandId: "upload", actionType: "web.dom.upload", selector: UPLOAD_INPUT, upload: { files: [UPLOAD_FILE] }
  });
  expect(reply).toMatchObject({
    status: "succeeded",
    message: "Files uploaded.",
    validation: { status: "passed", expected: "1 file, named as requested", actual: "1 file, named as requested" }
  });
  // A chosen file's name is the user's data: the post-condition compares names but quotes none.
  expect(JSON.stringify({ message: reply.message, validation: reply.validation })).not.toContain(UPLOAD_NAME);
  // The result describes the element it acted on. How that descriptor spells
  // the selector is describe-element.ts's business, and pinning the spelling
  // here would couple an upload spec to element identification.
  expect(reply.element).toBeDefined();
  // The page really holds the file: name, size and type, not just a reply.
  expect(await page.locator(UPLOAD_INPUT).evaluate((element) => {
    const file = (element as HTMLInputElement).files?.[0];
    return file ? { name: file.name, size: file.size, type: file.type } : null;
  })).toEqual({ name: UPLOAD_NAME, size: UPLOAD_BYTES, type: "text/plain" });
});

test("upload: W17 -- the form echoes the attached CV and the ATS stores it once the application is sent", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("job-board");
  await openApplicationForm(harness);
  const reply = await harness.runAction({
    commandId: "upload-w17", actionType: "web.dom.upload", selector: UPLOAD_INPUT, upload: { files: [UPLOAD_FILE] }
  });
  expect(reply.status, reply.message).toBe("succeeded");
  // The form's own change handler fired: it writes the chosen file's name beside "Attach".
  await expect(page.locator(UPLOAD_ECHO)).toHaveText(UPLOAD_NAME);

  // The rest of the application, as a person fills it in.
  await page.fill('input[name="first_name"]', "Ada");
  await page.fill('input[name="last_name"]', "Synthetic");
  await page.fill('input[name="email"]', "ada.synthetic@example.test");
  await page.fill('input[name="location_text"]', "Bristol");
  await page.locator(".tl-option", { hasText: "Bristol, England, United Kingdom" }).click();
  await page.locator(".tl-opt", { hasText: "Yes" }).click();
  await page.selectOption('select[name="sponsorship"]', "no");
  await page.selectOption('select[name="notice"]', { index: 1 });
  await page.fill('input[name="salary_expectation"]', "90000");
  await page.selectOption('select[name="source"]', { index: 1 });
  await page.locator('input[name="privacy"]').check();
  await page.locator(".tl-submit").click();
  // Talentloom Shield: three seconds of "Please wait", then "I'm a person".
  await page.getByRole("button", { name: "I'm a person" }).click({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/embed\/confirmation\?app=/u);

  const state = (await harness.finalState()).state as unknown as JobBoardState;
  expect(state.applications).toHaveLength(1);
  expect(state.applications[0]!.answers.resume).toBe(`file:${UPLOAD_NAME}`);
});

test("upload: a target that cannot hold files is rejected, not reported as a success", async ({ openHarness }) => {
  const harness = await openHarness("job-board");
  await openApplicationForm(harness);
  const reply = await harness.runAction({
    commandId: "upload-wrong-target", actionType: "web.dom.upload", selector: ATTACH_BUTTON, upload: { files: [UPLOAD_FILE] }
  });
  expect(reply).toMatchObject({
    status: "failed",
    validation: { status: "failed", expected: "1 file, named as requested", actual: "the target is a button, not a file input" },
    // One code for every refusal; the verb's own reason rides in `actual`.
    failure: {
      category: "blocked_by_capability_or_policy", code: "web.action.rejected", retryable: false,
      expected: "1 file, named as requested", actual: "upload_rejected: the target is a button, not a file input"
    }
  });
  expect(JSON.stringify({ message: reply.message, validation: reply.validation, failure: reply.failure })).not.toContain(UPLOAD_NAME);
});

test("upload: a refusal names a file by its position, never by its name", async ({ openHarness }) => {
  // Sent straight to the page, as the domain's schema would refuse this content
  // before dispatch; the page-side backstop must not quote the name either.
  const harness = await openHarness("job-board");
  await openApplicationForm(harness);
  const reply = await harness.runAction({
    commandId: "upload-bad-content", actionType: "web.dom.upload", selector: UPLOAD_INPUT,
    upload: { files: [{ ...UPLOAD_FILE, contentBase64: "%%%not-base64%%%" }] }
  });
  expect(reply).toMatchObject({ status: "failed", validation: { actual: "the content of file 1 is not valid base64" } });
  expect(JSON.stringify({ message: reply.message, validation: reply.validation, failure: reply.failure })).not.toContain(UPLOAD_NAME);
});

/** Posts one of company-website's own state operations, as its page script does. */
async function siteMutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${harness.scenarioId} answered ${response.status} to ${operation}.`);
}

/**
 * company-website's "Offers & reminders" page, armed with
 * `confirm-unsubscribe`, for a returning visitor who answered consent and the
 * chat greeting and is subscribed with one address. Arming starts a new
 * visitor, so it goes first.
 */
async function openUnsubscribeConfirm(harness: ContentHarness): Promise<void> {
  await siteMutate(harness, "set-mode", { mode: "confirm-unsubscribe" });
  await siteMutate(harness, "set-consent", { choice: "essential" });
  await siteMutate(harness, "dismiss-chat-greeting");
  await siteMutate(harness, "subscribe-newsletter", { email: NEWSLETTER_EMAIL });
  await harness.page.goto(new URL(`/scenarios/${harness.scenarioId}/newsletter`, harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await expect(harness.page.locator(UNSUBSCRIBE)).toHaveCount(1);
}

const newsletterOf = async (harness: ContentHarness) => ((await harness.finalState()).state as unknown as NewsletterState).newsletter;

test("dialog: an armed dismiss answers the native confirm, and the arming is consumed by it", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  await openUnsubscribeConfirm(harness);
  const armed = await harness.runAction({
    commandId: "arm-dismiss", actionType: "web.dom.dialog", dialog: { response: "dismiss" }
  });
  expect(armed).toMatchObject({
    status: "succeeded",
    message: "Dialog response armed.",
    validation: { status: "passed", expected: "the next dialog is dismissed" }
  });

  await page.locator(UNSUBSCRIBE).click();
  await expect.poll(async () => (await newsletterOf(harness)).unsubscribePrompts).toEqual({ accepted: 0, dismissed: 1 });
  await expect(page.locator(UNSUBSCRIBE)).toHaveCount(1);

  // One arming answers one dialog: this second confirm is unarmed, falls
  // through to the real one, and Playwright's default dismisses it.
  await page.locator(UNSUBSCRIBE).click();
  await expect.poll(async () => (await newsletterOf(harness)).unsubscribePrompts).toEqual({ accepted: 0, dismissed: 2 });
  await expect(page.locator(UNSUBSCRIBE)).toHaveCount(1);
  expect((await newsletterOf(harness)).subscribers).toEqual([NEWSLETTER_EMAIL]);
});

test("dialog: an armed accept unsubscribes the address and is reported as evidence afterwards", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  await openUnsubscribeConfirm(harness);
  await harness.runAction({ commandId: "arm-accept", actionType: "web.dom.dialog", dialog: { response: "accept" } });
  await page.locator(UNSUBSCRIBE).click();
  // The page takes the row off where it stands, without a reload, so the override's record of the answer survives.
  await expect(page.getByRole("status")).toContainText("Unsubscribed.");
  await expect(page.locator(UNSUBSCRIBE)).toHaveCount(0);
  await expect.poll(async () => newsletterOf(harness)).toMatchObject({ subscribers: [], unsubscribePrompts: { accepted: 1, dismissed: 0 } });

  // The next dialog action carries the dialog the override actually handled,
  // on `dialog`: `extracted` holds only what a read took off the page.
  const next = await harness.runAction({ commandId: "arm-again", actionType: "web.dom.dialog", dialog: { response: "dismiss" } });
  expect(next.dialog).toMatchObject({ kind: "confirm", message: UNSUBSCRIBE_CONFIRM_TEXT, response: "accept" });
  expect(next).not.toHaveProperty("extracted");
});

test("dialog: a prompt's answer is reported by its length, never its content", async ({ openHarness, page }) => {
  // The answer is user data, as a typed value is: the text a Flow supplied, or
  // what a person typed. The prompt's message is the page's own text.
  const message = "Name this report";
  const answer = "SYNTHETIC_PROMPT_ANSWER";
  const harness = await openHarness("job-board");
  await openApplicationForm(harness);
  const armed = await harness.runAction({
    commandId: "arm-prompt", actionType: "web.dom.dialog", dialog: { response: "accept", promptText: answer }
  });
  expect(armed).toMatchObject({ status: "succeeded", validation: { expected: "the next dialog is accepted with the supplied text" } });

  // No realistic page has a prompt of its own, so the page's world asks one. The
  // override answers it with the armed text; were the override missing,
  // Playwright would dismiss the real prompt and this would be null.
  expect(await page.evaluate((text) => window.prompt(text), message)).toBe(answer);

  const next = await harness.runAction({ commandId: "arm-after-prompt", actionType: "web.dom.dialog", dialog: { response: "dismiss" } });
  expect(next.dialog).toEqual({
    kind: "prompt", message, response: "accept", promptText: `a withheld value of ${answer.length} characters`, at: expect.any(Number)
  });
  expect(next).not.toHaveProperty("extracted");
  // Nowhere in either reply, their page snapshots included.
  for (const reply of [armed, next]) expect(JSON.stringify(reply)).not.toContain(answer);
});

test("dialog: a command with no dialog request is refused rather than arming nothing", async ({ openHarness }) => {
  const harness = await openHarness("job-board");
  await openApplicationForm(harness);
  const reply = await harness.runAction({ commandId: "arm-empty", actionType: "web.dom.dialog" });
  expect(reply).toMatchObject({
    status: "failed",
    validation: { status: "failed", expected: "a dialog response to arm", actual: "the command carried no dialog request" },
    failure: {
      category: "blocked_by_capability_or_policy", code: "web.action.rejected", retryable: false,
      expected: "a dialog response to arm", actual: "dialog_no_response: the command carried no dialog request"
    }
  });
});

// A press on a photo grid's thumbnail, where the cell draws its own hover
// overlay over the picture inside the same link (t756).
//
// Live (`run-mvdi88yz-e444d594`, photo-social `august-over-1300`, trials 0138,
// 0148 and 0260): every press of "open the post" on the studio's profile grid
// was refused as `web.target.not_actionable` -- "the point 441,360 landed on
// ul.<cellOverlay>, which covers the target" -- after four attempts. The
// target was the cell's `<img>`, found by its alt text; the `<ul>` is the
// cell's like and comment counts, an `inset: 0` layer drawn transparent until
// hovered, a sibling of the picture inside the cell's `<a>`. A person's click
// on the picture lands on that layer and opens the post, because the layer is
// part of the link the picture is in: the press reaches the same control.
//
// The rows below press the thumbnail the run pressed, then load the grid's
// later screens the way a visitor does -- a scroll, a second scroll that trips
// the grid's rate limit and its "Try again", the session check's "Continue as"
// -- and open and read the one August post the task wants, all through the
// content runtime's own verbs. The last row starts where a trial starts, with
// the consent prompt unanswered (trial 0134 stopped behind it): before the fix
// the defence declined it and then spent its three retries on the overlay. No
// model is called.

import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const PROFILE = "/scenarios/photo-social/harbourlight.studio/";
/** The thumbnail the live trials pressed: the grid's first cell. */
const FIRST_THUMBNAIL = 'main a[role="link"][href*="/p/"] > img[alt^="Photo by Harbourlight Studio on September 20, 2026."]';
/** The post the task's answer is: a photo of 21 August 2026, on the grid's third screen. */
const AUGUST_THUMBNAIL = 'main a[role="link"][href*="/p/"] > img[alt^="Photo by Harbourlight Studio on August 21, 2026."]';
const CELLS = 'main a[role="link"][href*="/p/"]';
const POST_DIALOG = '[role="dialog"][aria-modal="true"]';
/** The one control the grid puts under itself while it waits: the rate limit's "Try again", or the session check's "Continue as". */
const UNDER_GRID_CONTROL = `main div:has(> ${CELLS.slice("main ".length)}) + * [role="button"]`;

/** Sends one of the scenario's own page mutations, as its page script would. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${harness.scenarioId} answered ${response.status} to ${operation}.`);
}

/** The studio's profile with the consent, notification and dock prompts answered, and the content script ready. */
async function openProfile(openHarness: (id: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openHarness("photo-social");
  await mutate(harness, "consent", { choice: "essential" });
  await mutate(harness, "notifications", {});
  await mutate(harness, "dock", { minimized: true });
  await harness.page.goto(new URL(PROFILE, harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await expect(harness.page.locator(CELLS)).toHaveCount(12);
  return harness;
}

function press(harness: ContentHarness, commandId: string, selector: string): Promise<BrowserActionResult> {
  return harness.runAction({ commandId, actionType: "web.dom.click", selector });
}

test("click: a grid thumbnail under its cell's own hover overlay is pressed through it and opens the post", async ({ openHarness, page }) => {
  const harness = await openProfile(openHarness);
  // The premise: the overlay, not the picture, is what a press at the picture's centre lands on.
  const landsOn = await page.locator(FIRST_THUMBNAIL).evaluate((image) => {
    const box = image.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return { overlay: hit?.tagName === "UL" || hit?.closest("ul") !== null, sameLink: hit?.closest("a") === image.closest("a") };
  });
  expect(landsOn).toEqual({ overlay: true, sameLink: true });

  const reply = await press(harness, "open-first-post", FIRST_THUMBNAIL);

  expect(reply, reply.message).toMatchObject({ status: "succeeded" });
  await expect(page.locator(POST_DIALOG)).toBeVisible();
  await expect(page).toHaveURL(/\/scenarios\/photo-social\/p\/[^/]+\/$/u);
});

test("click: the grid's later screens load as a visitor loads them, and the August post on screen three opens and reads 1,349", async ({ openHarness, page }) => {
  test.setTimeout(60_000);
  const harness = await openProfile(openHarness);
  // Screens two and three: the bottom of the grid scrolled into reach until 36 cells stand, answering on the way the
  // grid's rate limit by its own "Try again" and the session check by "Continue as", each pressed by the runtime.
  await page.mouse.move(640, 360);
  for (let round = 0; round < 8 && (await page.locator(CELLS).count()) < 36; round += 1) {
    const before = await page.locator(CELLS).count();
    await page.mouse.wheel(0, 6000);
    const grew = page.locator(CELLS).nth(before);
    const tryAgain = page.getByRole("button", { name: "Try again", exact: true });
    const proceed = page.getByRole("button", { name: /^Continue as / });
    await expect(grew.or(tryAgain).or(proceed).first()).toBeAttached({ timeout: 8000 });
    if (await tryAgain.isVisible()) {
      const reply = await press(harness, `rate-limit-try-again-${round}`, UNDER_GRID_CONTROL);
      expect(reply, reply.message).toMatchObject({ status: "succeeded" });
    } else if (await proceed.isVisible()) {
      const reply = await press(harness, `session-continue-${round}`, UNDER_GRID_CONTROL);
      expect(reply, reply.message).toMatchObject({ status: "succeeded" });
    }
    await page.waitForTimeout(1600);
  }
  await expect(page.locator(CELLS)).toHaveCount(36, { timeout: 5000 });

  const open = await press(harness, "open-august-post", AUGUST_THUMBNAIL);
  expect(open, open.message).toMatchObject({ status: "succeeded" });
  await expect(page.locator(`${POST_DIALOG} article section a[href$="/liked_by/"] > span`)).toBeVisible();

  const date = await harness.runAction({ commandId: "read-date", actionType: "web.dom.extract", selector: `${POST_DIALOG} article section:has(> a[href$="/liked_by/"]) + div a > time` });
  const likes = await harness.runAction({ commandId: "read-likes", actionType: "web.dom.extract", selector: `${POST_DIALOG} article section a[href$="/liked_by/"] > span` });
  expect({ date: date.extracted, likes: likes.extracted }).toEqual({ date: "August 21", likes: "1,349" });
});

test("click: from the site's start, the consent prompt over the profile is declined first, and the thumbnail press then opens the post", async ({ openHarness, page }) => {
  // The trials start from the site's start (`start: reset` in trial 0134): consent unanswered, the dock open.
  const harness = await openHarness("photo-social");
  await page.goto(new URL(PROFILE, harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await expect(page.locator(CELLS)).toHaveCount(12);
  await expect(page.getByTestId("cookie-policy-manage-dialog-decline-button")).toBeVisible();
  // As long as a trial's navigation and grid read take before the press.
  await page.waitForTimeout(4000);

  const reply = await press(harness, "open-first-post-from-start", FIRST_THUMBNAIL);

  expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: expect.stringContaining("after absorbing blocking_dialog, closing 1 dialog") } });
  // Declined, never allowed: the dialog's way out is the decline.
  expect((await harness.finalState()).state).toMatchObject({ consent: "essential" });
  await expect(page.locator(POST_DIALOG)).toBeVisible();
});

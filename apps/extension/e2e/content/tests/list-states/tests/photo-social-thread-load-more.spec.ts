// A post's comment thread that loads in batches behind a "Load more comments"
// control named only by its drawing, read the way a Flow reads it: the list's
// way on detected, Next page pressed until the list ends, then one read.
//
// Live run `run-mvebbeom-a60886e1` (photo-social priya-tags, 2026-10-18) built
// this thread's read for eight revisions and never ended its loop on the list's
// end. Its command receipts show three defects, and reproducing them on this
// page found two more; each is held here (t755):
//
// - **Detection named no way on.** The control is a `div role=button` whose
//   only name is its `<svg aria-label>`, and detection read a control's label
//   from its own `aria-label` or text, so the thread was detected with
//   `pagination: "none"` and its read carried no fact that it went on.
// - **Next page ended a list whose control was showing.** Revision 8 looped a
//   click and `web.dom.next_page` on the detected list. With no way carried, the
//   step looked for a pager's Next, found none, scrolled, and answered `ended`
//   on `scrolled_to_end` with Load more on screen: the loop left after one pass
//   and the read saw 25 of 41 comments.
// - **A click on the gone control pressed a comment.** Revisions 2-7 looped a
//   bare click on Load more. Once the thread had loaded whole the control was
//   gone, and the click's recorded selector (`ul > li:nth-of-type(38) > div`)
//   named a comment's body: the click landed there, pressed it twice and
//   reported success, so the loop could never see the control had gone, and
//   only the repeat guard stopped it.
// - **A detected thread left its replies out.** A run was the items one
//   container holds side by side, so replies, drawn as comments are but inside
//   their comment's own list, were in no run with the comments: the thread
//   detected with replies open still read the comments alone.
// - **Next page pressed a comment.** The load-more way detection wrote names
//   the control by position (`ul > li:nth-of-type(14) > div`), and the control
//   moves down a slot with every batch, so the second press landed on a
//   comment's body; and the thread swallows the first press its Load more
//   gets, which failed the move `list_unchanged` where a person presses again.
//
// The rows are the thread's own, from `breadth/priya-tags/expected.ts`: with
// every batch loaded and no reply opened a read whose comment contains the tag
// keeps three; with the replies under Priya's entry opened, all five, in order.
// The match condition is the request's own and right in both: what was missing
// was the list, never the condition.
//
// The fourth row is a guard, not a reproduction: a click recorded on current
// source names the control by its drawing's label, and the veto refuses the
// comment its stale position names. The run's own recording, from source
// before that naming landed (e3d6f7e6, 2026-10-19), carried no name and was
// acted on unvetoed.

import type { WebAutomationExtractListRequest, WebAutomationStructureDetection } from "@fluxiq-web-extension/domain/client";
import { priyaTagsExpected } from "../../../../../../scenario-lab/src/scenarios/photo-social/breadth/priya-tags/index.js";
import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import { TARGET_NOT_FOUND, describe, recordedElement, trackClicks } from "../../identity-fixtures.js";

/** The studio's Autumn Kiln Giveaway post. */
const GIVEAWAY = "/scenarios/photo-social/p/D96ahbWGjtY/";
/** The thread's "Load more comments": a button drawn by its labelled graphic. */
const LOAD_MORE = 'main article [role="button"]:has(> svg[aria-label="Load more comments"])';
/** A comment's author link in the post's own thread. */
const AUTHOR = "main article ul > li h3 a";
/** Priya's own entry, under which two of the tags are replies. */
const PRIYA_ENTRY = "18926112691673843";
/** Comments in the thread once every batch is in: forty, and the pinned one before them. */
const WHOLE_THREAD = 41;

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;
type Row = Record<string, string>;

const EXPECTED = (priyaTagsExpected.extracted?.[0]?.records ?? []) as Row[];

/** One site operation, sent as the site's own scripts send it. */
async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

/** The giveaway with consent and the notification prompt already answered, and the content script in it. */
async function openGiveaway(harness: ContentHarness): Promise<void> {
  await apply(harness, "consent", { choice: "essential" });
  await apply(harness, "notifications");
  await harness.page.goto(new URL(GIVEAWAY, harness.lab.origin).href, { waitUntil: "load" });
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  // The site's message dock, collapsed as the task's recording collapses it, so nothing covers the thread.
  const collapse = harness.page.locator(`fl-dock [part="collapse-button"]`);
  await collapse.waitFor({ timeout: 9_000 });
  await collapse.click();
  await expect(harness.page.locator(LOAD_MORE)).toBeVisible();
}

async function detect(harness: ContentHarness, selector: string): Promise<Detected> {
  const reply = await harness.runAction({ commandId: `detect-${Date.now()}`, actionType: "web.dom.capture_snapshot", detectStructure: { selector } });
  const structure = reply.structure as WebAutomationStructureDetection;
  expect(structure.ok, `a structure was detected: ${JSON.stringify(structure)}`).toBe(true);
  if (!structure.ok) throw new Error("No structure detected.");
  return structure;
}

async function nextPage(harness: ContentHarness, nextPageRequest: NonNullable<Parameters<ContentHarness["runAction"]>[0]["nextPage"]>, step: number): Promise<BrowserActionResult> {
  return await harness.runAction({ commandId: `next-page-${step}`, actionType: "web.dom.next_page", timeoutMs: 30_000, nextPage: nextPageRequest });
}

/** Next page until the list ends, at most `most` presses; the answers in order. */
async function pageToEnd(harness: ContentHarness, nextPageRequest: Parameters<typeof nextPage>[1], most = 8): Promise<BrowserActionResult[]> {
  const answers: BrowserActionResult[] = [];
  for (let step = 1; step <= most; step += 1) {
    const answer = await nextPage(harness, nextPageRequest, step);
    answers.push(answer);
    if (answer.nextPage?.outcome !== "moved") break;
  }
  return answers;
}

/** The thread read with the three columns the task asks for, keeping what tags @priya.nair. */
async function readTags(harness: ContentHarness, item: string): Promise<Row[]> {
  const request: WebAutomationExtractListRequest = {
    item,
    fields: {
      author: { kind: "text", selector: "h3 a" },
      comment: { kind: "text", selector: 'span[dir="auto"]' },
      date: { kind: "attribute", selector: "time", attribute: "datetime" }
    },
    where: [{ field: "comment", contains: "@priya.nair" }]
  };
  const reply = await harness.runAction({ commandId: `read-${Date.now()}`, actionType: "web.dom.extract_list", extractList: request });
  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
  const records = (Array.isArray(reply.extracted) ? reply.extracted : []) as unknown[];
  return records.map((record) => Object.fromEntries(Object.entries(record as Record<string, unknown>).filter(([key]) => key in EXPECTED[0]!).map(([key, value]) => [key, String(value)])));
}

const threadSize = (harness: ContentHarness) => harness.page.locator("main article > div ul > li:has(> div h3 a)").count();

test.describe("photo-social giveaway thread", () => {
  test.setTimeout(120_000);

  test("the thread's Load more, named only by its drawing, is detected as the way the comment list goes on", async ({ openHarness, page }) => {
    const harness = await openHarness("photo-social");
    await openGiveaway(harness);
    const structure = await detect(harness, AUTHOR);
    expect(structure.proposal.pagination, "the list continues through its load-more control").toMatchObject({ mode: "loadMore" });
    const pagination = structure.proposal.pagination;
    if (pagination?.mode !== "loadMore") throw new Error("no load-more way");
    expect(await page.locator(pagination.control).count()).toBe(1);
    expect(await page.locator(pagination.control).evaluate((element, wanted) => element === document.querySelector(wanted), LOAD_MORE)).toBe(true);
  });

  test("Next page on a list that carried no way presses the thread's Load more until it is gone, then answers ended", async ({ openHarness }) => {
    const harness = await openHarness("photo-social");
    await openGiveaway(harness);
    const { item } = (await detect(harness, AUTHOR)).proposal;
    // Revision 8's request: the list's item alone, as a handle detected with no way resolves to.
    const answers = await pageToEnd(harness, { item });
    const last = answers[answers.length - 1]!;
    expect(answers.slice(0, -1).every((answer) => answer.nextPage?.outcome === "moved"), JSON.stringify(answers.map((answer) => answer.nextPage))).toBe(true);
    // Gone, the control leaves nothing to find, so the list is scrolled once and ends there.
    expect(last).toMatchObject({ status: "succeeded", route: "ended", nextPage: { outcome: "ended", stop: "scrolled_to_end" } });
    expect(await threadSize(harness)).toBe(WHOLE_THREAD);
    // Every batch in, no reply opened: the condition keeps the three top-level tags.
    expect(await readTags(harness, item)).toEqual(EXPECTED.slice(2));
  });

  test("with the replies under Priya's entry opened, the thread detected again keeps all five tags in thread order", async ({ openHarness, page }) => {
    const harness = await openHarness("photo-social");
    await openGiveaway(harness);
    const structure = await detect(harness, AUTHOR);
    const pagination = structure.proposal.pagination;
    const answers = await pageToEnd(harness, pagination?.mode === "loadMore" ? { item: structure.proposal.item, pagination: { mode: "loadMore", control: pagination.control } } : { item: structure.proposal.item });
    expect(answers[answers.length - 1]).toMatchObject({ route: "ended" });
    const entry = page.locator(`main article ul > li:has(> div a[href$="/c/${PRIYA_ENTRY}/"])`);
    await entry.locator(':scope > [role="button"]').click();
    await expect(entry.locator('ul > li a[href*="/c/"]').first()).toBeVisible();
    // Detected with the replies open, the thread is one list: each comment, then its open replies.
    const opened = await detect(harness, AUTHOR);
    const replies = await entry.locator("ul > li").count();
    expect(replies).toBeGreaterThan(0);
    expect(await page.locator(opened.proposal.item).count()).toBe(WHOLE_THREAD + replies);
    expect(await readTags(harness, opened.proposal.item)).toEqual(EXPECTED);
  });

  test("a click on Load more after the thread has loaded whole is not found, and presses no comment", async ({ openHarness, page }) => {
    const harness = await openHarness("photo-social");
    await openGiveaway(harness);
    // The control as a recording saves it, at the place it held when the build
    // explored: after the hydrating press and two batches, in the 38th slot.
    await page.locator(LOAD_MORE).click();
    for (const count of [25, 37]) {
      await page.locator(LOAD_MORE).click();
      await expect.poll(() => threadSize(harness), { timeout: 8_000 }).toBe(count);
    }
    const recorded = await describe(harness, LOAD_MORE);
    expect(recorded.selector).toMatch(/li:nth-of-type\(38\)/u);
    await page.locator(LOAD_MORE).click();
    await expect.poll(() => threadSize(harness), { timeout: 8_000 }).toBe(WHOLE_THREAD);
    await expect(page.locator(LOAD_MORE)).toHaveCount(0);
    const clicks = await trackClicks(page);

    const reply = await harness.runAction({ commandId: "click-gone-load-more", actionType: "web.dom.click", ...(recorded.selector ? { selector: recorded.selector } : {}), options: recordedElement(recorded) });

    expect(reply, JSON.stringify({ status: reply.status, message: reply.message, validation: reply.validation, resolution: reply.resolution })).toMatchObject({ status: "failed", failure: TARGET_NOT_FOUND });
    expect(await clicks()).toEqual([]);
  });
});

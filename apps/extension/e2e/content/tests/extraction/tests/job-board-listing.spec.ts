// The job board's results page, read the way the live run
// `run-mulwm2dc-0bd95f22` read it, and the two defects that run found.
//
// - **A title that is a link.** Every card's title is `h2 > a`. Until
//   2026-09-28 a link offered only its URL as a column, so the only column that
//   held the title held its address, and the Flow stored twelve URLs as titles.
//   A link now offers its words and its URL as two columns, the URL's labelled
//   with the same path and "url".
// - **A Next the page will not let be pressed.** The run reached the results by
//   their URL, past the consent wall, which stays open, and while it is open the
//   board cancels every click outside it (`board/client-script.ts`). The read
//   pressed Next, waited ten seconds and ended on page one saying nothing. It
//   now goes where the link says, and a read that stops says why in
//   `paginationStop`.
// - **A Next that leads back to its own page**, which the board's does from
//   page two on (`board/results-page.ts`): the read follows the pager's
//   following page instead.
//
// A Next that loads a new document takes the page's script with it, and the
// harness talks to that script, so the rows that follow a link prove where the
// page went rather than what the read returned; the worker carrying the read
// into the next document is `src/runtime/tests/extract-list-continuation.test.ts`.

import type { WebAutomationExtractField, WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const RESULTS = "/scenarios/job-board/jobs";
const TITLE_LINK = "article[data-jk] h2 a";

type ProposeReply = { ok: true; proposal: WebAutomationExtractionProposal } | { ok: false; refused: string };

async function propose(harness: ContentHarness, selector: string): Promise<WebAutomationExtractionProposal> {
  const delivery = await harness.deliver({ type: "extraction.propose", selector });
  expect(delivery.responded, `the content script answered extraction.propose for ${selector}`).toBe(true);
  const reply = delivery.response as ProposeReply;
  expect(reply.ok, `a proposal was made for ${selector}: ${JSON.stringify(reply)}`).toBe(true);
  if (!reply.ok) throw new Error(`No proposal for ${selector}.`);
  return reply.proposal;
}

/** Opens a results page with the consent wall still unanswered, as the run's second navigate did. */
async function openResults(harness: ContentHarness, query: string): Promise<void> {
  await harness.page.goto(new URL(`${RESULTS}${query}`, harness.url).href);
  await expect(harness.page.locator("article[data-jk]").first()).toBeAttached({ timeout: 10_000 });
  await expect(harness.page.locator("rf-consent"), "the consent wall is still open").toBeAttached();
}

/** Marks the pager's Next so a request can name it; the board's class names are hashes that change with the seed. */
async function markNext(harness: ContentHarness): Promise<string> {
  await harness.page.evaluate(() => {
    const next = Array.from(document.querySelectorAll("nav a")).find((link) => link.textContent?.trim() === "Next");
    if (!next) throw new Error("The results page shows no Next.");
    next.setAttribute("data-spec-next", "");
  });
  return "[data-spec-next]";
}

test("a card's title link proposes its words and its URL as two columns, and the words read as the titles", async ({ openHarness, page }) => {
  const harness = await openHarness("job-board");
  await openResults(harness, "");
  const proposal = await propose(harness, TITLE_LINK);

  const url = proposal.fields.find((field) => field.spec.kind === "link" && field.label.endsWith(" url") && field.spec.selector !== undefined && /\bh2\b/u.test(field.spec.selector));
  expect(url, `a URL column for the title link: ${proposal.fields.map((field) => `${field.label} (${field.spec.kind})`).join(", ")}`).toBeTruthy();
  if (!url) return;
  const title = proposal.fields.find((field) => field.spec.kind === "text" && field.spec.selector === url.spec.selector);
  expect(title, "a text column on the same link").toBeTruthy();
  if (!title) return;
  expect(title.label).toBe(url.label.slice(0, -" url".length));

  const reply = await harness.runAction({
    commandId: "extract-job-titles",
    actionType: "web.dom.extract_list",
    extractList: {
      item: proposal.item,
      fields: { [title.key]: title.spec as WebAutomationExtractField, [url.key]: url.spec as WebAutomationExtractField }
    }
  });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  const records = reply.extracted as Array<Record<string, string | null>>;
  const shown = (await page.locator(`${proposal.item} h2 a`).allInnerTexts()).map((text) => text.trim());
  expect(records.map((record) => record[title.key])).toEqual(shown);
  for (const record of records) {
    expect(String(record[title.key]), "a title is words, not an address").not.toMatch(/^https?:\/\//u);
    expect(String(record[url.key])).toMatch(/^https?:\/\//u);
  }
});

// A `next` selector that names nothing is where a read starts, not the last
// word: the pager around the list is asked for its own way forward
// (`detect-pagination.ts`, `nextControlOnPage`). So a selector that names
// nothing ends the read only where the pager offers no way forward either --
// the board's last page, which draws no Next and marks no page `aria-current`.
test("a read whose next control names nothing, on a page whose pager offers no way forward, stops on its first page and says so", async ({ openHarness, page }) => {
  const harness = await openHarness("job-board");
  // Past the last page the board shows its last page.
  await openResults(harness, "?page=999");
  await expect(page.locator("nav a", { hasText: /^Next$/u }), "the last page draws no Next").toHaveCount(0);
  await expect(page.locator("nav [aria-current]"), "and marks no current page to count on from").toHaveCount(0);
  const reply = await harness.runAction({
    commandId: "extract-no-next",
    actionType: "web.dom.extract_list",
    timeoutMs: 30_000,
    extractList: { item: "article[data-jk]", fields: { title: "h2 a" }, paginate: { next: "[data-no-such-next]", maxPages: 50 }, minItems: 0 }
  });
  expect(reply).toMatchObject({ status: "succeeded", extraction: { pagesRead: 1, truncated: false, paginationStop: "control_absent" } });
  expect(reply.validation).toMatchObject({ actual: expect.stringContaining("paging stopped on the first page because the pagination control named nothing there") });
});

test("a read whose next control names nothing, on a page with a pager, follows the board's own Next", async ({ openHarness, page }) => {
  const harness = await openHarness("job-board");
  await openResults(harness, "");
  // The reply never comes back: following Next loads page two, and the script
  // that would answer goes with page one.
  void harness.deliver({
    type: "executeAction",
    topFrameOnly: true,
    extraction: { token: "job-board-pager-next" },
    action: {
      commandId: "extract-by-the-pager",
      actionType: "web.dom.extract_list",
      timeoutMs: 60_000,
      extractList: { item: "article[data-jk]", fields: { title: "h2 a" }, paginate: { next: "[data-no-such-next]", maxPages: 50 }, minItems: 0 }
    }
  }).catch(() => undefined);
  await page.waitForURL((address) => address.searchParams.get("page") === "2", { timeout: 20_000 });
});

test("a read that reached its page bound says the list went on", async ({ openHarness }) => {
  const harness = await openHarness("job-board");
  await openResults(harness, "");
  const next = await markNext(harness);
  const reply = await harness.runAction({
    commandId: "extract-one-page",
    actionType: "web.dom.extract_list",
    timeoutMs: 30_000,
    extractList: { item: "article[data-jk]", fields: { title: "h2 a" }, paginate: { next, maxPages: 1 }, minItems: 0 }
  });
  expect(reply).toMatchObject({ status: "succeeded", extraction: { pagesRead: 1, truncated: true, paginationStop: "page_limit" } });
  expect(reply.validation).toMatchObject({ actual: expect.stringContaining("paging stopped because extractList.paginate.maxPages = 1 was reached while the list went on; the read is incomplete") });
});

test("with the consent wall cancelling its click, Next is followed by its own address", async ({ openHarness, page }) => {
  const harness = await openHarness("job-board");
  await openResults(harness, "");
  const next = await markNext(harness);
  // The reply never comes back: following the link loads page two, and the
  // script that would answer goes with page one.
  void harness.deliver({
    type: "executeAction",
    topFrameOnly: true,
    extraction: { token: "job-board-next" },
    action: {
      commandId: "extract-past-the-wall",
      actionType: "web.dom.extract_list",
      timeoutMs: 60_000,
      extractList: { item: "article[data-jk]", fields: { title: "h2 a" }, paginate: { next, maxPages: 50 }, minItems: 0 }
    }
  }).catch(() => undefined);
  await page.waitForURL((address) => address.searchParams.get("page") === "2", { timeout: 20_000 });
  // Going where the link says answered nothing on the page's behalf.
  await expect(page.locator("rf-consent")).toBeAttached({ timeout: 10_000 });
});

test("on page two, where Next leads back to page two, the read goes on to page three", async ({ openHarness, page }) => {
  const harness = await openHarness("job-board");
  await openResults(harness, "?page=2");
  const next = await markNext(harness);
  const leadsHere = await page.evaluate((selector) => new URL((document.querySelector(selector) as HTMLAnchorElement).href).searchParams.get("page"), next);
  expect(leadsHere, "the board's own bug: page two's Next points at page two").toBe("2");
  void harness.deliver({
    type: "executeAction",
    topFrameOnly: true,
    extraction: { token: "job-board-self-link" },
    action: {
      commandId: "extract-past-the-self-link",
      actionType: "web.dom.extract_list",
      timeoutMs: 60_000,
      extractList: { item: "article[data-jk]", fields: { title: "h2 a" }, paginate: { next, maxPages: 50 }, minItems: 0 }
    }
  }).catch(() => undefined);
  await page.waitForURL((address) => address.searchParams.get("page") === "3", { timeout: 20_000 });
});

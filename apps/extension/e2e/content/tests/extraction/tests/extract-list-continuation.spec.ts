// `web.dom.extract_list` reading pages that do not arrive at once, and reading
// on from a checkpoint in a document another one handed over, on the
// professional network's people search.
//
// What these rows are really proving:
// - a page drawn behind skeleton cards, or behind a security check that clears
//   itself, is waited for rather than read as empty: a numbered read used to end
//   on page 1 because the skeleton had neither records nor page controls;
// - a page that truly holds no record the read wants is read as empty once it
//   shows its controls, and the read goes on past it;
// - a record the next page repeats at its top -- a search whose index moved
//   between requests -- is read once, in the modes that move between pages;
// - with a continuation token, the read so far is handed over before each
//   control is followed, and with a resume, a document goes on from it.
//
// The search clears its results to skeleton cards -- pager included -- on every
// page change and fetches the page 0.7 s later; asking for more than three pages
// inside three seconds is answered with a security check that retries itself
// after five; and page 3 opens with page 2's last result again.
//
// A Next that loads a new document cannot be shown here: the harness talks to
// the page's own script, which that load destroys. The worker's half is
// covered by `src/runtime/tests/extract-list-continuation.test.ts`, and the
// whole chain by the Lab's bigbox `pickup-towels` recording lane.

import { peopleRecords, ROTTERDAM_ENGINEERS } from "../../../../../../scenario-lab/src/scenarios/professional-network/index.js";
import { peopleMatches, peopleResultsPage, peopleSearchHref } from "../../../../../../scenario-lab/src/scenarios/professional-network/search/index.js";
import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const CHECKPOINT_MESSAGE = "fluxiq.extraction.checkpoint";

/** A person the search found; promoted profiles carry `data-ad-slot`, and the product advert is not a member. */
const CARD = 'li[data-urn^="urn:gl:member:"]:not([data-ad-slot])';
const NAME = 'a[href*="/in/"] span[aria-hidden="true"]';
/** The pager's numbered buttons. */
const PAGES = 'section[aria-label="Search results"] li > button';
/** The pager's Next, the button after the numbered list; the result list itself carries `role="list"`. */
const NEXT = 'section[aria-label="Search results"] ul:not([role]) + button';

/** Everyone the search finds, by name, once each, in the order it first shows them. */
const NAMES = peopleMatches(ROTTERDAM_ENGINEERS).map((member) => ({ name: member.name }));

/** The organic people results page `page` shows, the repeat at the top of page 3 included. */
function organicOn(page: number) {
  return peopleResultsPage({ ...ROTTERDAM_ENGINEERS, page }).entries.flatMap((entry) => (entry.kind === "organic" ? [entry.member] : []));
}

/** Opens the search on `page` and waits for its results to replace the skeleton. */
async function openSearch(harness: ContentHarness, page = 1): Promise<void> {
  await harness.page.goto(new URL(peopleSearchHref({ ...ROTTERDAM_ENGINEERS, page }), harness.url).href);
  await expect(harness.page.locator(CARD).first()).toBeAttached({ timeout: 10_000 });
}

test.describe("on professional-network", () => {
  test.setTimeout(90_000);

  // The people search itself: every page change clears the results to
  // skeleton cards -- pager included -- and fetches; asking for three pages
  // inside three seconds is answered with a security check that clears after
  // five; and page 3 opens with page 2's last result again. The read has to
  // reach all three pages and keep each person once.
  test("numbered: the people search is read across all three pages, each person once", async ({ openHarness, page }) => {
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    // Two more searches inside the site's three-second window, as an impatient
    // reload makes them: the read's request for page 2 is then answered with
    // the security check, which the page retries by itself five seconds later.
    const fragment = new URL(peopleSearchHref(ROTTERDAM_ENGINEERS).replace("/people/?", "/people/fragment?"), harness.url).href;
    await page.evaluate(async (address) => { for (let index = 0; index < 2; index += 1) await fetch(address); }, fragment);
    const reply = await harness.runAction({
      commandId: "extract-people-search",
      actionType: "web.dom.extract_list",
      timeoutMs: 50_000,
      extractList: {
        item: CARD,
        fields: {
          name: NAME,
          headline: ":scope > div:nth-child(2) > div:nth-child(2)",
          location: ":scope > div:nth-child(2) > div:nth-child(3)"
        },
        paginate: { mode: "numbered", pages: PAGES, maxPages: 5 }
      }
    });
    const expected = peopleRecords(ROTTERDAM_ENGINEERS);
    expect(reply).toMatchObject({ status: "succeeded", extraction: { recordCount: expected.length, pagesRead: 3, truncated: false } });
    expect(reply.extracted).toEqual(expected);
    // The site's own count: the read met the check and waited it out.
    const { challenges } = (await harness.finalState()).state as { challenges: number };
    expect(challenges).toBeGreaterThanOrEqual(1);
    // Every page visited once, ending on the last (decision D5).
    expect(new URL(page.url()).searchParams.get("page")).toBe("3");
    await expect(page.locator(`${PAGES}[aria-current="true"]`)).toHaveText("3");
  });

  test("next: a page holding no record the read wants is read as empty once its controls show", async ({ openHarness }) => {
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    // The read wants four people from page 1 and the two page 3 ends on, and
    // nobody page 2 shows: page 2 is drawn behind its skeleton, holds none of
    // them, and the read goes on past it on its pager.
    const wanted = [...organicOn(1).slice(0, 4), ...organicOn(3).slice(-2)];
    const item = wanted.map((member) => `li[data-urn="${member.urn}"]`).join(", ");
    const reply = await harness.runAction({
      commandId: "extract-next-filtered",
      actionType: "web.dom.extract_list",
      timeoutMs: 50_000,
      extractList: { item, fields: { name: NAME }, paginate: { next: NEXT, maxPages: 5 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      extraction: { recordCount: wanted.length, pagesRead: 3, truncated: false }
    });
    expect(reply.extracted).toEqual(wanted.map((member) => ({ name: member.name })));
  });

  test("with a continuation token, the read so far is handed over before each control is followed", async ({ openHarness }) => {
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    const delivery = await harness.deliver({
      type: "executeAction",
      topFrameOnly: true,
      extraction: { token: "t-1" },
      action: {
        commandId: "extract-checkpointed",
        actionType: "web.dom.extract_list",
        timeoutMs: 50_000,
        extractList: { item: CARD, fields: { name: NAME }, paginate: { mode: "numbered", pages: PAGES, maxPages: 5 } }
      }
    });
    expect(delivery.responded).toBe(true);
    expect(delivery.response).toMatchObject({ status: "succeeded", extraction: { recordCount: NAMES.length, pagesRead: 3 } });
    const checkpoints = (await harness.messages())
      .filter((message) => message.type === CHECKPOINT_MESSAGE)
      .map((message) => message as unknown as { token: string; checkpoint: { records: unknown[]; pagesRead: number; scrolls: number; missingFields: string[] } });
    // One before each of the two controls followed, holding exactly what had been read.
    expect(checkpoints.map(({ token, checkpoint }) => ({ token, records: checkpoint.records.length, pagesRead: checkpoint.pagesRead }))).toEqual([
      { token: "t-1", records: 10, pagesRead: 1 },
      { token: "t-1", records: 20, pagesRead: 2 }
    ]);
    expect(checkpoints[1]?.checkpoint.records).toEqual(NAMES.slice(0, 20));
  });

  test("with a resume, a document goes on from the checkpoint another one handed over", async ({ openHarness }) => {
    const harness = await openHarness("professional-network");
    // This document is showing page 3, as the page a followed control loaded would.
    await openSearch(harness, 3);
    const delivery = await harness.deliver({
      type: "executeAction",
      topFrameOnly: true,
      extraction: { token: "t-2", resume: { records: NAMES.slice(0, 20), pagesRead: 2, scrolls: 0, missingFields: [] } },
      action: {
        commandId: "extract-resumed",
        actionType: "web.dom.extract_list",
        timeoutMs: 50_000,
        extractList: { item: CARD, fields: { name: NAME }, paginate: { mode: "numbered", pages: PAGES, maxPages: 5 } }
      }
    });
    const reply = delivery.response as BrowserActionResult;
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: `${NAMES.length} records from 3 pages; every declared field present` },
      extraction: { recordCount: NAMES.length, pagesRead: 3, truncated: false }
    });
    // Page 3 opens with page 2's last person, which the checkpoint already holds.
    expect(organicOn(3)[0]?.name).toBe(NAMES[19]?.name);
    expect(reply.extracted).toEqual(NAMES);
  });

  test("a resume that is not a checkpoint is refused rather than read from the start", async ({ openHarness }) => {
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    const delivery = await harness.deliver({
      type: "executeAction",
      topFrameOnly: true,
      extraction: { token: "t-3", resume: { records: "all of them", pagesRead: 1, scrolls: 0, missingFields: [] } },
      action: {
        commandId: "extract-bad-resume",
        actionType: "web.dom.extract_list",
        extractList: { item: CARD, fields: { name: NAME }, paginate: { mode: "numbered", pages: PAGES, maxPages: 5 } }
      }
    });
    expect(delivery.response).toMatchObject({ status: "failed", message: "The extraction continuation the worker sent is not one this page can go on from." });
  });
});

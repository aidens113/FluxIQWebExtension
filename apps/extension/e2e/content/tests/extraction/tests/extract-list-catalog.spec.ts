// `web.dom.extract_list` against the professional network's people search: a
// client-rendered list whose every page change clears the results to skeleton
// cards, pager included, and fetches the next page into the same document.
//
// What these rows are really proving:
// - the records are the page's own text and raw attributes, not a shape the
//   extractor invented;
// - following Next reads each new page rather than the stale one it replaced;
// - `maxPages` and `maxItems` stopping early is reported as `truncated`, while
//   the list simply ending is not;
// - a read that returns gives its own account on `extraction` beside the
//   records: the counts, the truncation flag, and the declared field keys;
// - a structured field spec reads by kind -- text, an attribute, or a link
//   resolved against the page -- and an optional field the page cannot read is
//   `null` rather than a field the record lacks;
// - a column no record yields is stated rather than failed, because a field the
//   author did not write `required: true` on is not required (2026-09-26), while
//   one that says so still fails with `output_not_observed`;
// - fewer records than `minItems` fails the validation with
//   `output_not_observed`, so an empty list cannot pass as a clean read;
// - the command's `timeoutMs` bounds the whole read, and running out of it
//   reports `timed_out` with what was read.
//
// Expected records come from the scenario's own search (`peopleResultsPage`,
// `peopleMatches`), so the page and the expectation cannot drift. The numbered
// walk over the same search is `extract-list-continuation.spec.ts` ("numbered:
// the people search is read across all three pages, each person once"); the
// table read and the redrawn-text read are `extract-list-table.spec.ts`.

import { ROTTERDAM_ENGINEERS } from "../../../../../../scenario-lab/src/scenarios/professional-network/index.js";
import type { Member } from "../../../../../../scenario-lab/src/scenarios/professional-network/index.js";
import { peopleMatches, peopleResultsPage, peopleSearchHref } from "../../../../../../scenario-lab/src/scenarios/professional-network/search/index.js";
import { profileHref } from "../../../../../../scenario-lab/src/scenarios/professional-network/shell/index.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** A person the search found; promoted profiles carry `data-ad-slot`, and the product advert is not a member. */
const CARD = 'li[data-urn^="urn:gl:member:"]:not([data-ad-slot])';
/** The name link: its text is two spans, the name hidden from assistive technology and "View X's profile" hidden from the eye. */
const LINK = 'a[href*="/in/"]';
/** The pager's Next, the button after the numbered list; the result list itself carries `role="list"`. */
const NEXT = 'section[aria-label="Search results"] ul:not([role]) + button';

/** Name, headline, and location as the card renders them, and the name link's raw root-relative href. */
const cardFields = {
  name: `${LINK} span[aria-hidden="true"]`,
  headline: ":scope > div:nth-child(2) > div:nth-child(2)",
  location: ":scope > div:nth-child(2) > div:nth-child(3)",
  url: `${LINK}@href`
};

type Person = { name: string; headline: string; location: string; url: string };

/** A member as a card shows them at `position` in the whole result list. */
function person(member: Member, position: number): Person {
  return { name: member.name, headline: member.headline, location: member.location, url: profileHref(member, { origin: "srp", position }) };
}

/** The organic people one results page shows, in page order. */
function pageOf(page: number): Person[] {
  return peopleResultsPage({ ...ROTTERDAM_ENGINEERS, page }).entries.flatMap((entry) => (entry.kind === "organic" ? [person(entry.member, entry.position)] : []));
}

/** Everyone the search finds, once each, in the order it first shows them. */
const EVERYONE = peopleMatches(ROTTERDAM_ENGINEERS).map((member, index) => person(member, index + 1));
const FIRST_PAGE = pageOf(1);
const SECOND_PAGE = pageOf(2);

/** Opens the search on its first page and waits for its first results to replace the skeleton. */
async function openSearch(harness: ContentHarness): Promise<void> {
  await harness.page.goto(new URL(peopleSearchHref(ROTTERDAM_ENGINEERS), harness.url).href);
  await expect(harness.page.locator(CARD).first()).toBeAttached({ timeout: 10_000 });
}

test("the scenario's own search spans three pages of ten, so these rows read a list that does not fit on one", () => {
  expect(FIRST_PAGE).toHaveLength(10);
  expect(SECOND_PAGE).toHaveLength(10);
  expect(EVERYONE.length).toBeGreaterThan(20);
  expect(EVERYONE.length).toBeLessThanOrEqual(30);
});

test.describe("on professional-network", () => {
  test.setTimeout(90_000);

  test("page one: every card's text and its link's raw href", async ({ openHarness }) => {
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    const reply = await harness.runAction({
      commandId: "extract-page-one",
      actionType: "web.dom.extract_list",
      extractList: { item: CARD, fields: cardFields }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      message: "List extracted.",
      validation: {
        status: "passed",
        expected: "at least 1 record, each carrying name, headline, location, url",
        actual: "10 records from 1 page; every declared field present"
      },
      extraction: { recordCount: 10, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["name", "headline", "location", "url"] }
    });
    expect(reply.extracted).toEqual(FIRST_PAGE);
  });

  test("every page: Next is followed to the end of the list, and each new page is read, not the stale one", async ({ openHarness, page }) => {
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    const reply = await harness.runAction({
      commandId: "extract-all-pages",
      actionType: "web.dom.extract_list",
      timeoutMs: 60_000,
      extractList: { item: CARD, fields: cardFields, paginate: { next: NEXT, maxPages: 5 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: `${EVERYONE.length} records from 3 pages; every declared field present` },
      // The pager says "Page 3 of 3", so the read ends there without pressing a
      // Next that would only fetch an empty page four; page 3's repeat of page
      // 2's last person is counted, not kept.
      extraction: { recordCount: EVERYONE.length, pagesRead: 3, truncated: false, missingFields: [], paginationStop: "no_following_page", earlierPageRepeats: 1 }
    });
    // Each person once, in the order the search first showed them, and no page read twice.
    expect(reply.extracted).toEqual(EVERYONE);
    expect(new URL(page.url()).searchParams.get("page")).toBe("3");
  });

  test("maxPages: stopping with a page left is reported as truncated", async ({ openHarness, page }) => {
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    const reply = await harness.runAction({
      commandId: "extract-two-pages",
      actionType: "web.dom.extract_list",
      timeoutMs: 60_000,
      extractList: { item: CARD, fields: cardFields, paginate: { next: NEXT, maxPages: 2 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "20 records from 2 pages, truncated; paging stopped because extractList.paginate.maxPages = 2 was reached while the list went on; the read is incomplete -- rerun with input: {extractList: {paginate: {maxPages: N}}} to read more; every declared field present" },
      extraction: { recordCount: 20, pagesRead: 2, truncated: true, missingFields: [] }
    });
    expect(reply.extracted).toEqual([...FIRST_PAGE, ...SECOND_PAGE]);
    // The read ended on the last page it read (decision D5): the search pushed page 2's address.
    expect(new URL(page.url()).searchParams.get("page")).toBe("2");
  });

  test("maxItems: the record list is bounded and reported as truncated", async ({ openHarness }) => {
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    const reply = await harness.runAction({
      commandId: "extract-three",
      actionType: "web.dom.extract_list",
      extractList: { item: CARD, fields: cardFields, maxItems: 3 }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "3 records from 1 page, truncated; every declared field present" }
    });
    expect(reply.extracted).toEqual(FIRST_PAGE.slice(0, 3));
  });

  test("a column no card has is stated, not failed: the ten rows come back with it blank", async ({ openHarness }) => {
    // Until 2026-09-26 the string grammar asserted `required` for every field, so
    // this read failed `output_not_observed` and the rows it had were stored as
    // nothing. A default that turns a wide answer into an empty one is the shape
    // this product does not take: the rows come back, the gap is named, and the
    // repair narrows it. A result card carries no email address; only a first
    // connection's Contact info dialog does.
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    const reply = await harness.runAction({
      commandId: "extract-missing-field",
      actionType: "web.dom.extract_list",
      extractList: { item: CARD, fields: { name: cardFields.name, email: 'a[href^="mailto:"]' } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      message: "List extracted.",
      validation: {
        status: "passed",
        expected: "at least 1 record, each carrying name, email",
        actual: expect.stringContaining("10 records short of a declared field, blank in email")
      },
      // No field was required, so none is missing; the gap rides on the counts.
      extraction: { recordCount: 10, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["name", "email"], itemsSeen: 10, emptyRecords: 0 }
    });
    // Every row is returned, with `null` in the cell the page had nothing for (D16).
    expect(reply.extracted).toEqual(FIRST_PAGE.map((record) => ({ name: record.name, email: null })));
  });

  /**
   * What a read whose item selector named nothing says first (`actions/extract-list.ts`,
   * `readSummary`): that the list never appeared, how long the read waited and for
   * how many items, what ended the wait -- a selector that names nothing pays the
   * whole render window (`extraction/page-render.ts`) -- and which repair it wants.
   * The wait's length is the page's own timing, so it is matched as a number.
   */
  const NEVER_APPEARED = "0 records from 1 page; the item selector named nothing on the page, so the list never appeared, after waiting \\d+ms for 1 item and stopping on the read's own render window running out -- change the selector rather than the fields or the conditions";

  /** A company result, which a people search never shows. */
  const NO_SUCH_ITEM = 'li[data-urn^="urn:gl:company:"]';

  test("an item selector matching nothing fails with output_not_observed", async ({ openHarness }) => {
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    const reply = await harness.runAction({
      commandId: "extract-no-items",
      actionType: "web.dom.extract_list",
      extractList: { item: NO_SUCH_ITEM, fields: cardFields }
    });
    expect(reply).toMatchObject({
      status: "failed",
      validation: {
        status: "failed",
        expected: "at least 1 record, each carrying name, headline, location, url",
        // The failure the read ends on is one the execution tried to absorb, so
        // the recovery account says it did not recover (`action-runtime/recovery/account.ts`).
        actual: expect.stringMatching(new RegExp(`^${NEVER_APPEARED}; fewer than the 1 required; the execution did not recover within its \\d+ attempts? after absorbing output_not_observed, waiting \\d+ ms$`, "u"))
      },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed" }
    });
    expect(reply.extracted).toEqual([]);
  });

  test("minItems: 0 lets an empty list succeed", async ({ openHarness }) => {
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    const reply = await harness.runAction({
      commandId: "extract-empty-allowed",
      actionType: "web.dom.extract_list",
      extractList: { item: NO_SUCH_ITEM, fields: cardFields, minItems: 0 }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: expect.stringMatching(new RegExp(`^${NEVER_APPEARED}; every declared field present$`, "u")) }
    });
    expect(reply.extracted).toEqual([]);
  });

  test("timeoutMs: a read that outlasts it reports timed_out with the pages it read", async ({ openHarness }) => {
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    // A page change holds the skeleton for 700 ms before it even fetches the
    // next page, so a short budget runs out while the read is waiting for page two.
    const reply = await harness.runAction({
      commandId: "extract-out-of-time",
      actionType: "web.dom.extract_list",
      timeoutMs: 300,
      extractList: { item: CARD, fields: cardFields, paginate: { next: NEXT, maxPages: 5 } }
    });
    expect(reply).toMatchObject({
      status: "timed_out",
      message: "Timed out extracting the list after 1 page.",
      validation: { status: "failed", actual: "10 records from 1 page; the time ran out before the list ended" },
      failure: { code: "web.action.timeout", category: "timeout" },
      extraction: { recordCount: 10, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["name", "headline", "location", "url"] }
    });
    expect(reply.extracted).toEqual(FIRST_PAGE);
    // Which page is showing is deliberately not asserted: a read that ran out
    // of time makes no promise about it (decision D5).
  });
});

test.describe("structured field specs, on professional-network", () => {
  test.setTimeout(90_000);

  test("each kind reads what it names, an optional miss is null, and an excluded field is no key at all", async ({ openHarness }) => {
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    const reply = await harness.runAction({
      commandId: "extract-field-specs",
      actionType: "web.dom.extract_list",
      extractList: {
        item: CARD,
        fields: {
          name: { kind: "text", selector: cardFields.name },
          href: { kind: "attribute", selector: LINK, attribute: "href" },
          url: { kind: "link", selector: LINK },
          email: { kind: "text", selector: 'a[href^="mailto:"]', required: false },
          headline: { kind: "text", selector: cardFields.headline, handling: "exclude" }
        }
      }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", expected: "at least 1 record, each carrying name, href, url, email" },
      extraction: { recordCount: 10, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["name", "href", "url", "email"] }
    });
    // `attribute` reads the raw href; `link` resolves the same href against the
    // page; the card has no email, and an optional field the page cannot read
    // is `null`; the excluded headline is not a key.
    expect(reply.extracted).toEqual(FIRST_PAGE.map(({ name, url }) => ({ name, href: url, url: new URL(url, harness.url).href, email: null })));
  });

  test("a required field the page cannot read still fails with output_not_observed", async ({ openHarness }) => {
    const harness = await openHarness("professional-network");
    await openSearch(harness);
    const reply = await harness.runAction({
      commandId: "extract-required-spec",
      actionType: "web.dom.extract_list",
      // `required: true` is written out: only an explicit one requires a field now,
      // and this row is what proves the capability still means what it says.
      extractList: { item: CARD, fields: { name: cardFields.name, email: { kind: "text", selector: 'a[href^="mailto:"]', required: true } } }
    });
    expect(reply).toMatchObject({
      status: "failed",
      validation: { status: "failed", actual: expect.stringContaining("required fields missing from some records: email") },
      failure: { category: "output_not_observed" },
      extraction: { missingFields: ["email"], fieldNames: ["name", "email"] }
    });
    expect(reply.extracted).toEqual(FIRST_PAGE.map(({ name }) => ({ name })));
  });
});

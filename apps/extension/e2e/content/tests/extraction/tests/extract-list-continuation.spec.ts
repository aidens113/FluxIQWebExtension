// `web.dom.extract_list` reading pages that do not arrive at once, and reading
// on from a checkpoint in a document another one handed over.
//
// What these rows are really proving:
// - a page drawn behind skeleton cards, or behind a check that clears itself,
//   is waited for rather than read as empty: a numbered read used to end on
//   page 1 because the skeleton had neither records nor page controls;
// - a page that truly holds no record the read wants is read as empty once it
//   shows its controls, and the read goes on past it;
// - a record the next page repeats at its top -- a search whose index moved
//   between requests -- is read once, in the modes that move between pages;
// - with a continuation token, the read so far is handed over before each
//   control is followed, and with a resume, a document goes on from it.
//
// A Next that loads a new document cannot be shown here: the harness talks to
// the page's own script, which that load destroys. The worker's half is
// covered by `src/runtime/tests/extract-list-continuation.test.ts`, and the
// whole chain by the Lab's bigbox `pickup-towels` recording lane.

import type { Page } from "@playwright/test";
import { peopleRecords, ROTTERDAM_ENGINEERS, ROTTERDAM_NL } from "../../../../../../scenario-lab/src/scenarios/professional-network/index.js";
import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";

const CHECKPOINT_MESSAGE = "fluxiq.extraction.checkpoint";

test.describe("on basic-form", () => {
  test("numbered: pages drawn behind a skeleton and a check are waited for, and a repeated record is read once", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    const list = await injectPagedList(page, { id: "people", mode: "numbered", pages: PEOPLE, skeletonMs: 300, checkOnPage: 3, checkMs: 1_200 });
    const reply = await harness.runAction({
      commandId: "extract-numbered-skeleton",
      actionType: "web.dom.extract_list",
      timeoutMs: 30_000,
      extractList: { item: list.item, fields: { name: ".name" }, paginate: { mode: "numbered", pages: list.pages, maxPages: 5 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "10 records from 3 pages; every declared field present" },
      extraction: { recordCount: 10, pagesRead: 3, truncated: false }
    });
    // Page 3 opens with page 2's last person again; it is read once.
    expect(reply.extracted).toEqual(people(10));
  });

  test("next: a page holding no record the read wants is read as empty once its controls show", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    const list = await injectPagedList(page, { id: "filtered", mode: "next", pages: PEOPLE, skeletonMs: 100, filteredPage: 2 });
    const reply = await harness.runAction({
      commandId: "extract-next-filtered",
      actionType: "web.dom.extract_list",
      timeoutMs: 30_000,
      extractList: { item: list.item, fields: { name: ".name" }, paginate: { next: list.next, maxPages: 5 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      extraction: { recordCount: 7, pagesRead: 3, truncated: false }
    });
    // Page 2's entries are all promotions the item selector leaves out, so
    // page 3's repeat of its last one is new to the read.
    expect(reply.extracted).toEqual([...people(4), { name: "Person 8" }, { name: "Person 9" }, { name: "Person 10" }]);
  });

  test("with a continuation token, the read so far is handed over before each control is followed", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    const list = await injectPagedList(page, { id: "checkpointed", mode: "numbered", pages: PEOPLE, skeletonMs: 100 });
    const delivery = await harness.deliver({
      type: "executeAction",
      topFrameOnly: true,
      extraction: { token: "t-1" },
      action: {
        commandId: "extract-checkpointed",
        actionType: "web.dom.extract_list",
        timeoutMs: 30_000,
        extractList: { item: list.item, fields: { name: ".name" }, paginate: { mode: "numbered", pages: list.pages, maxPages: 5 } }
      }
    });
    expect(delivery.responded).toBe(true);
    expect(delivery.response).toMatchObject({ status: "succeeded", extraction: { recordCount: 10, pagesRead: 3 } });
    const checkpoints = (await harness.messages())
      .filter((message) => message.type === CHECKPOINT_MESSAGE)
      .map((message) => message as unknown as { token: string; checkpoint: { records: unknown[]; pagesRead: number; scrolls: number; missingFields: string[] } });
    // One before each of the two controls followed, holding exactly what had been read.
    expect(checkpoints.map(({ token, checkpoint }) => ({ token, records: checkpoint.records.length, pagesRead: checkpoint.pagesRead }))).toEqual([
      { token: "t-1", records: 4, pagesRead: 1 },
      { token: "t-1", records: 8, pagesRead: 2 }
    ]);
    expect(checkpoints[1]?.checkpoint.records).toEqual(people(8));
  });

  test("with a resume, a document goes on from the checkpoint another one handed over", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    // This document is showing page 2, as the page a followed control loaded would.
    const list = await injectPagedList(page, { id: "resumed", mode: "numbered", pages: PEOPLE, skeletonMs: 100, startPage: 2, repeatOnPage: 2 });
    const delivery = await harness.deliver({
      type: "executeAction",
      topFrameOnly: true,
      extraction: { token: "t-2", resume: { records: people(4), pagesRead: 1, scrolls: 0, missingFields: [] } },
      action: {
        commandId: "extract-resumed",
        actionType: "web.dom.extract_list",
        timeoutMs: 30_000,
        extractList: { item: list.item, fields: { name: ".name" }, paginate: { mode: "numbered", pages: list.pages, maxPages: 5 } }
      }
    });
    const reply = delivery.response as BrowserActionResult;
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "10 records from 3 pages; every declared field present" },
      extraction: { recordCount: 10, pagesRead: 3, truncated: false }
    });
    // Page 2 opens with page 1's last person, which the checkpoint already holds.
    expect(reply.extracted).toEqual(people(10));
  });

  test("a resume that is not a checkpoint is refused rather than read from the start", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    const list = await injectPagedList(page, { id: "refused", mode: "numbered", pages: PEOPLE, skeletonMs: 100 });
    const delivery = await harness.deliver({
      type: "executeAction",
      topFrameOnly: true,
      extraction: { token: "t-3", resume: { records: "all of them", pagesRead: 1, scrolls: 0, missingFields: [] } },
      action: {
        commandId: "extract-bad-resume",
        actionType: "web.dom.extract_list",
        extractList: { item: list.item, fields: { name: ".name" }, paginate: { mode: "numbered", pages: list.pages, maxPages: 5 } }
      }
    });
    expect(delivery.response).toMatchObject({ status: "failed", message: "The extraction continuation the worker sent is not one this page can go on from." });
  });
});

test.describe("on professional-network", () => {
  // The people search itself: every page change clears the results to
  // skeleton cards -- pager included -- and fetches; asking for three pages
  // inside three seconds is answered with a security check that clears after
  // five; and page 3 opens with page 2's last result again. The read has to
  // reach all three pages and keep each person once.
  test("numbered: the people search is read across all three pages, each person once", async ({ openHarness, page }) => {
    const harness = await openHarness("professional-network");
    const query = `keywords=${encodeURIComponent(ROTTERDAM_ENGINEERS.keywords)}&network=${encodeURIComponent('["S"]')}&geoUrn=${encodeURIComponent(JSON.stringify([ROTTERDAM_NL]))}&origin=FACETED_SEARCH`;
    await page.goto(new URL(`/scenarios/professional-network/search/results/people/?${query}`, harness.url).href);
    await expect(page.locator('li[data-urn^="urn:gl:member:"]').first()).toBeAttached({ timeout: 10_000 });
    const reply = await harness.runAction({
      commandId: "extract-people-search",
      actionType: "web.dom.extract_list",
      timeoutMs: 50_000,
      extractList: {
        item: 'li[data-urn^="urn:gl:member:"]:not([data-ad-slot])',
        fields: {
          name: 'a[href*="/in/"] span[aria-hidden="true"]',
          headline: ":scope > div:nth-child(2) > div:nth-child(2)",
          location: ":scope > div:nth-child(2) > div:nth-child(3)"
        },
        paginate: { mode: "numbered", pages: 'section[aria-label="Search results"] li > button', maxPages: 5 }
      }
    });
    const expected = peopleRecords(ROTTERDAM_ENGINEERS);
    expect(reply).toMatchObject({ status: "succeeded", extraction: { recordCount: expected.length, pagesRead: 3, truncated: false } });
    expect(reply.extracted).toEqual(expected);
  });
});

/** Ten people over three pages of four; page 3 is two long. */
const PEOPLE: string[][] = [
  ["Person 1", "Person 2", "Person 3", "Person 4"],
  ["Person 5", "Person 6", "Person 7", "Person 8"],
  ["Person 9", "Person 10"]
];

function people(count: number): Array<{ name: string }> {
  return Array.from({ length: count }, (_, index) => ({ name: `Person ${index + 1}` }));
}

type PagedListOptions = {
  id: string;
  mode: "numbered" | "next";
  pages: string[][];
  /** How long a page change shows skeleton cards, with no entry and no pager, before the page is drawn. */
  skeletonMs: number;
  /** The page that shows a check, with no entry and no pager, before its skeleton. */
  checkOnPage?: number;
  checkMs?: number;
  /** A page whose entries are all promotions, which the item selector leaves out. */
  filteredPage?: number;
  /** The page the list starts on. */
  startPage?: number;
  /** A page that opens with the previous page's last entry again. Page 3 always does. */
  repeatOnPage?: number;
};

/**
 * A client-rendered list whose pages replace each other in place, as a
 * search's results do: a page change clears the section to skeleton cards --
 * no entry and no pager -- and draws the page after `skeletonMs`. Page 3, and
 * `repeatOnPage`, open with the last entry of the page before.
 */
async function injectPagedList(page: Page, options: PagedListOptions): Promise<{ item: string; pages: string; next: string }> {
  await page.evaluate((options) => {
    const section = document.createElement("section");
    section.dataset.testid = options.id;
    const draw = (number: number): void => {
      const own = options.pages[number - 1] ?? [];
      const repeat = number === 3 || number === options.repeatOnPage ? [options.pages[number - 2]?.at(-1) ?? ""] : [];
      const kind = number === options.filteredPage ? "promo" : "entry";
      const entries = [...repeat, ...own].map((name) => `<li class="${kind}"><span class="name">${name}</span></li>`).join("");
      const pager = options.mode === "numbered"
        ? `<ul class="pager">${options.pages.map((_, index) => `<li><button type="button"${index + 1 === number ? ' aria-current="true"' : ""}>${index + 1}</button></li>`).join("")}</ul>`
        : number < options.pages.length ? `<button type="button" class="next" data-page="${number + 1}">Next</button>` : "";
      section.innerHTML = `<ul>${entries}</ul>${pager}`;
    };
    const change = (number: number): void => {
      const skeleton = (): void => {
        section.innerHTML = '<div class="skeleton" aria-hidden="true"></div>';
        setTimeout(() => draw(number), options.skeletonMs);
      };
      if (number === options.checkOnPage) {
        section.innerHTML = "<div class=\"check\">Checking you are a person</div>";
        setTimeout(skeleton, options.checkMs ?? 0);
      } else {
        skeleton();
      }
    };
    section.addEventListener("click", (event) => {
      const button = (event.target as Element).closest("button");
      if (!button) return;
      const number = button.classList.contains("next") ? Number(button.dataset.page) : Number(button.textContent);
      if (number) change(number);
    });
    draw(options.startPage ?? 1);
    document.querySelector("main")?.append(section);
  }, options);
  return {
    item: `[data-testid="${options.id}"] li.entry`,
    pages: `[data-testid="${options.id}"] .pager button`,
    next: `[data-testid="${options.id}"] button.next`
  };
}

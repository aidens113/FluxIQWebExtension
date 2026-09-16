// `web.dom.extract_list` walking a list that does not fit on one page: the
// infinite feed it scrolls, the sign-in gate it finds nothing behind, and the
// feeds injected into basic-form that append rather than replace.
//
// What these rows are really proving:
// - every pagination mode -- `next`, `loadMore` and `scroll` -- reads each item
//   once, so a page that appends rather than replaces yields each item once;
// - a mode's own bound (`maxScrolls`, `maxPages`) stopping the read is reported
//   as `truncated`, while the list simply ending is not -- and a control that
//   ends up removed, `disabled` or `aria-disabled` is the list ending;
// - the page's own item cap stops an unbounded read and reports it truncated;
// - `timeoutMs` bounds the whole read, and running out mid-advance reports
//   `timed_out` with what was already read;
// - an empty list on a sign-in gate is `auth_required`, not an empty success.

import type { Page } from "@playwright/test";
import { expect, test } from "../../../index.js";
import { armVariant } from "./scenario-variant.js";

test.describe("on infinite-feed", () => {
  const POST = '[data-testid="feed-item"]';
  /** The fixture's own post id, so a post read twice would show up, and the post's title. */
  const postFields = { id: "@data-item-id", title: '[data-testid="feed-item-title"]' };

  const postIds = (extracted: unknown): string[] => (extracted as Array<Record<string, string>>).map((record) => record.id ?? "");

  test("scroll: the feed is read to its end, each post once", async ({ openHarness }) => {
    const harness = await openHarness("infinite-feed");
    const reply = await harness.runAction({
      commandId: "extract-feed",
      actionType: "web.dom.extract_list",
      extractList: { item: POST, fields: postFields, paginate: { mode: "scroll", maxScrolls: 20 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "60 records from 6 pages; every declared field present" },
      extraction: { recordCount: 60, pagesRead: 6, truncated: false, missingFields: [] }
    });
    expect(new Set(postIds(reply.extracted)).size).toBe(60);
    // The fixture's own count of what it served: the read stopped because the
    // feed ended, not because it stopped looking.
    expect((await harness.finalState()).state).toMatchObject({ loadedCount: 60, ended: true });
  });

  test("scroll: maxScrolls stops the read and reports it truncated", async ({ openHarness }) => {
    const harness = await openHarness("infinite-feed");
    const reply = await harness.runAction({
      commandId: "extract-feed-capped",
      actionType: "web.dom.extract_list",
      extractList: { item: POST, fields: postFields, paginate: { mode: "scroll", maxScrolls: 2 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "30 records from 3 pages, truncated; every declared field present" },
      extraction: { recordCount: 30, pagesRead: 3, truncated: true }
    });
    // Two scrolls loaded two further pages, and the read scrolled no more.
    expect((await harness.finalState()).state).toMatchObject({ loadedCount: 30, ended: false });
  });

  test("scroll: a feed that ends early is read to that end", async ({ openHarness, page }) => {
    const harness = await openHarness("infinite-feed");
    await armVariant(harness, "set-mode", { mode: "end-early" });
    const reply = await harness.runAction({
      commandId: "extract-feed-end-early",
      actionType: "web.dom.extract_list",
      extractList: { item: POST, fields: postFields, paginate: { mode: "scroll", maxScrolls: 20 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "25 records from 3 pages; every declared field present" },
      extraction: { recordCount: 25, truncated: false }
    });
    expect(new Set(postIds(reply.extracted)).size).toBe(25);
    await expect(page.locator('[data-testid="feed-end"]')).toBeVisible();
  });
});

test.describe("on auth-gate", () => {
  test("an empty list on a sign-in gate is auth_required", async ({ openHarness }) => {
    // The start page is the sign-in form, with a rendered password control, so
    // a list of account rows matches nothing because the session is gone.
    const harness = await openHarness("auth-gate");
    const reply = await harness.runAction({
      commandId: "extract-behind-gate",
      actionType: "web.dom.extract_list",
      extractList: { item: '[data-testid="account-row"]', fields: { holder: "" } }
    });
    expect(reply).toMatchObject({ status: "failed", failure: { category: "auth_required" } });
    expect(reply.extracted).toEqual([]);
  });
});

test.describe("on basic-form", () => {
  test("an appending Next reads each item once", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    const feed = await injectAppendingFeed(page);
    const reply = await harness.runAction({
      commandId: "extract-appending",
      actionType: "web.dom.extract_list",
      extractList: { item: feed.item, fields: { text: "" }, paginate: { next: feed.control, maxPages: 5 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "7 records from 3 pages; every declared field present" }
    });
    expect(reply.extracted).toEqual(feedItems(7));
  });

  test("loadMore: appended items are read once, and a vanished control ends the list", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    const feed = await injectAppendingFeed(page);
    const all = await harness.runAction({
      commandId: "extract-load-more",
      actionType: "web.dom.extract_list",
      extractList: { item: feed.item, fields: { text: "" }, paginate: { mode: "loadMore", control: feed.control, maxPages: 5 } }
    });
    expect(all).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "7 records from 3 pages; every declared field present" },
      extraction: { recordCount: 7, pagesRead: 3, truncated: false }
    });
    expect(all.extracted).toEqual(feedItems(7));

    const capped = await injectAppendingFeed(page, { id: "capped-feed" });
    const stopped = await harness.runAction({
      commandId: "extract-load-more-capped",
      actionType: "web.dom.extract_list",
      extractList: { item: capped.item, fields: { text: "" }, paginate: { mode: "loadMore", control: capped.control, maxPages: 2 } }
    });
    expect(stopped).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "5 records from 2 pages, truncated; every declared field present" },
      extraction: { recordCount: 5, pagesRead: 2, truncated: true }
    });
    expect(stopped.extracted).toEqual(feedItems(5));
    // The control is still there: stopping at maxPages is truncation, not the end.
    await expect(page.locator(capped.control)).toHaveCount(1);
  });

  test("loadMore: a control that ends up disabled ends the list rather than truncating it", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    for (const ends of ["disabled", "aria-disabled"] as const) {
      const feed = await injectAppendingFeed(page, { id: `${ends}-feed`, ends });
      const reply = await harness.runAction({
        commandId: `extract-load-more-${ends}`,
        actionType: "web.dom.extract_list",
        extractList: { item: feed.item, fields: { text: "" }, paginate: { mode: "loadMore", control: feed.control, maxPages: 3 } }
      });
      // Three pages read and the control no longer usable: the list ended on
      // the page the bound would also have stopped at, and ending wins.
      expect(reply, ends).toMatchObject({
        status: "succeeded",
        validation: { status: "passed", actual: "7 records from 3 pages; every declared field present" },
        extraction: { recordCount: 7, pagesRead: 3, truncated: false }
      });
      expect(reply.extracted, ends).toEqual(feedItems(7));
    }
  });

  test("loadMore: an advance that outlasts timeoutMs reports timed_out with the first page", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    const feed = await injectAppendingFeed(page, { id: "slow-feed", appendAfterMs: 150 });
    const reply = await harness.runAction({
      commandId: "extract-load-more-timeout",
      actionType: "web.dom.extract_list",
      timeoutMs: 100,
      extractList: { item: feed.item, fields: { text: "" }, paginate: { mode: "loadMore", control: feed.control, maxPages: 5 } }
    });
    expect(reply).toMatchObject({
      status: "timed_out",
      message: "Timed out extracting the list after 1 page.",
      failure: { code: "web.action.timeout", category: "timeout" },
      extraction: { recordCount: 3, pagesRead: 1, truncated: false }
    });
    expect(reply.extracted).toEqual(feedItems(3));
  });

  test("an unbounded read stops at the domain's cap", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await page.evaluate((count) => {
      const list = document.createElement("ol");
      list.dataset.testid = "bulk";
      for (let index = 1; index <= count; index += 1) {
        const item = document.createElement("li");
        item.textContent = `Bulk item ${index}`;
        list.append(item);
      }
      document.querySelector("main")?.append(list);
    }, 1_005);
    const reply = await harness.runAction({
      commandId: "extract-capped",
      actionType: "web.dom.extract_list",
      extractList: { item: '[data-testid="bulk"] li', fields: { text: "" } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "1000 records from 1 page, truncated; every declared field present" }
    });
    const records = reply.extracted as Array<Record<string, string>>;
    expect(records).toHaveLength(1_000);
    expect(records[999]).toEqual({ text: "Bulk item 1000" });
  });
});

/** How an injected feed stops offering more: the way its control goes away. */
type FeedOptions = {
  /** Test id of the feed; its control is `<id>-more`. Several feeds can share a page. */
  id?: string;
  ends?: "removed" | "disabled" | "aria-disabled";
  /** How long the control takes to append, so a read can be given less time than that. */
  appendAfterMs?: number;
};

/**
 * A feed of three items and a control that appends two more after a delay. Its
 * second press ends the feed, in the same tick as that append, so a read sees
 * pages of 3, 5 and 7 items and then no way forward. Returns the selectors,
 * because several feeds may sit on one page.
 */
async function injectAppendingFeed(page: Page, options: FeedOptions = {}): Promise<{ item: string; control: string }> {
  const { id = "feed", ends = "removed", appendAfterMs = 50 } = options;
  await page.evaluate(({ id, ends, appendAfterMs }) => {
    const feed = document.createElement("ul");
    feed.dataset.testid = id;
    let added = 0;
    const append = (count: number): void => {
      for (let index = 0; index < count; index += 1) {
        added += 1;
        const item = document.createElement("li");
        item.textContent = `Feed item ${added}`;
        feed.append(item);
      }
    };
    append(3);
    const more = document.createElement("button");
    more.type = "button";
    more.dataset.testid = `${id}-more`;
    more.textContent = "Load more";
    let clicks = 0;
    more.addEventListener("click", () => {
      // A control marked aria-disabled is still clickable; the page, like a
      // real one, ignores the press rather than loading again.
      if (more.getAttribute("aria-disabled") === "true") return;
      clicks += 1;
      const click = clicks;
      setTimeout(() => {
        append(2);
        if (click < 2) return;
        if (ends === "removed") more.remove();
        else if (ends === "disabled") more.disabled = true;
        else more.setAttribute("aria-disabled", "true");
      }, appendAfterMs);
    });
    document.querySelector("main")?.append(feed, more);
  }, { id, ends, appendAfterMs });
  return { item: `[data-testid="${id}"] li`, control: `[data-testid="${id}-more"]` };
}

/** The first `count` records an injected feed yields. */
function feedItems(count: number): Array<{ text: string }> {
  return Array.from({ length: count }, (_, index) => ({ text: `Feed item ${index + 1}` }));
}

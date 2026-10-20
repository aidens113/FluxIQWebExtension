// `web.dom.extract_list` walking a list that does not fit on one page: the
// social network's home feed it scrolls, the photo site's sign-in form it finds
// nothing behind, a store's product reviews that "See more reviews" appends to,
// the professional network's sent invitations behind a "Show more" whose first
// press fails and offers a Retry, and the company website's team grid, which
// loads three batches as its end scrolls into view and then offers "Show more
// people".
//
// What these rows are really proving:
// - every pagination mode -- `next`, `loadMore` and `scroll` -- reads each item
//   once, so a page that appends rather than replaces yields each item once;
// - a mode's own bound (`maxScrolls`, `maxPages`) stopping the read is reported
//   as `truncated`, while the list simply ending is not -- and a control that
//   ends up hidden is the list ending;
// - `timeoutMs` bounds the whole read, and running out mid-advance reports
//   `timed_out` with what was already read;
// - an empty list on a sign-in gate is `auth_required`, not an empty success.
//
// Moved out: a load-more control that ends `disabled` or `aria-disabled` (no
// realistic site has one) is `src/content/extraction/tests/list-reader-load-more-end.test.ts`,
// and the domain's thousand-record bound (no realistic page shows a thousand
// records) is `src/content/extraction/tests/list-reader-item-cap.test.ts`.

import { feedPlanFor } from "../../../../../../scenario-lab/src/scenarios/social-network-feed/content/index.js";
import { TEAM_AUTO_BATCHES, TEAM_BATCH_SIZE, teamCardsFor } from "../../../../../../scenario-lab/src/scenarios/company-website/data/index.js";
import { createNetworkState } from "../../../../../../scenario-lab/src/scenarios/professional-network/index.js";
import { INVITATION_PAGE_SIZE, pendingSent } from "../../../../../../scenario-lab/src/scenarios/professional-network/network/index.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** One site operation, as the page's own scripts send it. */
async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

/** Waits for the content script in the document now showing to announce itself. */
async function contentReady(harness: ContentHarness): Promise<void> {
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

test.describe("on social-network-feed", () => {
  test.setTimeout(120_000);

  /** A unit of the feed: posts, shared posts, adverts, carousels, and the suggested posts after "You're all caught up". */
  const UNIT = '[role="feed"] > [role="article"]';
  /** The unit's place in the whole feed, which the site numbers itself, so a unit read twice would show up. */
  const unitFields = { position: "@aria-posinset" };
  const END_NOTE = "No more posts to show right now.";

  /** The batches the feed serves for a rendering, one per load: the positions of their units, in order. */
  const batches = (mode: "baseline" | "quiet-feed"): string[][] =>
    feedPlanFor({ mode, created: [], trashed: [], hidden: [] }).batches.map((batch) => batch.map(({ position }) => String(position)));
  /** Every position the feed serves for a rendering, in order. */
  const positions = (mode: "baseline" | "quiet-feed"): string[] => batches(mode).flat();

  const positionsOf = (extracted: unknown): string[] => (extracted as Array<Record<string, string>>).map((record) => record.position ?? "");

  /** The home feed with the cookie answer, the notifications prompt, and the chat already dealt with, as for a returning member. */
  async function openFeed(harness: ContentHarness): Promise<void> {
    await apply(harness, "consent", { choice: "all" });
    await apply(harness, "notifications", { choice: "dismissed" });
    await apply(harness, "chat", { state: "closed" });
    await harness.page.reload();
    await contentReady(harness);
    await expect(harness.page.locator(UNIT).first()).toBeAttached({ timeout: 10_000 });
  }

  test("scroll: the feed is read to its end, each unit once", async ({ openHarness, page }) => {
    const harness = await openHarness("social-network-feed");
    await openFeed(harness);
    const everything = positions("baseline");
    const reply = await harness.runAction({
      commandId: "extract-feed",
      actionType: "web.dom.extract_list",
      timeoutMs: 90_000,
      extractList: { item: UNIT, fields: unitFields, paginate: { mode: "scroll", maxScrolls: 20 } }
    });
    // One page per batch the site serves, the first one included.
    const pages = batches("baseline").length;
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: `${everything.length} records from ${pages} pages; every declared field present` },
      extraction: { recordCount: everything.length, pagesRead: pages, truncated: false, missingFields: [], paginationStop: "scrolled_to_end" }
    });
    // Every unit the site serves, past "You're all caught up" and through the
    // suggested posts, in feed order and once each.
    expect(positionsOf(reply.extracted)).toEqual(everything);
    // The read stopped because the feed ended, not because it stopped looking.
    await expect(page.getByText(END_NOTE, { exact: true })).toBeAttached();
  });

  test("scroll: maxScrolls stops the read and reports it truncated", async ({ openHarness, page }) => {
    const harness = await openHarness("social-network-feed");
    await openFeed(harness);
    const everything = positions("baseline");
    const reply = await harness.runAction({
      commandId: "extract-feed-capped",
      actionType: "web.dom.extract_list",
      timeoutMs: 60_000,
      extractList: { item: UNIT, fields: unitFields, paginate: { mode: "scroll", maxScrolls: 2 } }
    });
    // The first batch and the two each scroll brought, and no more.
    const read = batches("baseline").slice(0, 3).flat();
    expect(read.length).toBeLessThan(everything.length);
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: `${read.length} records from 3 pages, truncated; paging stopped because extractList.paginate.maxScrolls = 2 was reached while the list went on; the read is incomplete -- rerun with input: {extractList: {paginate: {maxScrolls: N}}} to read more; every declared field present` },
      extraction: { recordCount: read.length, pagesRead: 3, truncated: true, paginationStop: "page_limit" }
    });
    expect(positionsOf(reply.extracted)).toEqual(read);
    await expect(page.getByText(END_NOTE, { exact: true })).toHaveCount(0);
  });

  test("scroll: a feed that ends early is read to that end", async ({ openHarness, page }) => {
    const harness = await openHarness("social-network-feed");
    // A quieter few days: the feed is caught up after fifteen units. Arming
    // the rendering starts a fresh account, so the overlays are answered after.
    await apply(harness, "set-mode", { mode: "quiet-feed" });
    await openFeed(harness);
    const quiet = positions("quiet-feed");
    expect(quiet.length).toBeLessThan(positions("baseline").length);
    const reply = await harness.runAction({
      commandId: "extract-feed-end-early",
      actionType: "web.dom.extract_list",
      timeoutMs: 90_000,
      extractList: { item: UNIT, fields: unitFields, paginate: { mode: "scroll", maxScrolls: 20 } }
    });
    const pages = batches("quiet-feed").length;
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: `${quiet.length} records from ${pages} pages; every declared field present` },
      extraction: { recordCount: quiet.length, pagesRead: pages, truncated: false, paginationStop: "scrolled_to_end" }
    });
    expect(positionsOf(reply.extracted)).toEqual(quiet);
    await expect(page.getByText(END_NOTE, { exact: true })).toBeAttached();
  });
});

test.describe("on photo-social", () => {
  test("an empty list on a sign-in gate is auth_required", async ({ openHarness, page }) => {
    // "Switch accounts" leads to the login form, with a rendered password
    // control, so a read of the profile grid's posts matches nothing because
    // the session is not there.
    const harness = await openHarness("photo-social");
    await page.goto(new URL("/scenarios/photo-social/accounts/login/", harness.lab.origin).href);
    await contentReady(harness);
    await expect(page.locator('input[type="password"]')).toBeVisible();
    const reply = await harness.runAction({
      commandId: "extract-behind-gate",
      actionType: "web.dom.extract_list",
      extractList: { item: 'a[href*="/p/"]', fields: { post: "@href" } }
    });
    expect(reply).toMatchObject({ status: "failed", failure: { category: "auth_required" } });
    expect(reply.extracted).toEqual([]);
  });
});

test.describe("on bigbox-retail", () => {
  test.setTimeout(90_000);

  /** A customer review; the reviews are the only articles on a product page. */
  const REVIEW = "section > div > article";
  /** "See more reviews", the button under the reviews. */
  const MORE_REVIEWS = "section:has(> div > article) > button";
  /**
   * The towels' six reviews, in the order the page adds them: three drawn after
   * the page loads, three more on "See more reviews", which the page then hides.
   * Copied from `bigbox-retail/client/product-script.ts`, which does not export them.
   */
  const REVIEW_HEADINGS = ["Does the job", "Good value", "Picked up same day", "A little thin", "Buy the bigger pack", "Wrapper tore"];

  test("an appending Next reads each review once", async ({ openHarness, page }) => {
    const harness = await openHarness("bigbox-retail");
    await apply(harness, "consent", { choice: "accept" });
    await apply(harness, "dismiss-promo");
    await apply(harness, "dismiss-chat-card");
    await page.goto(new URL("/scenarios/bigbox-retail/ip/valueridge-essentials-select-a-size-paper-towels/418830127", harness.lab.origin).href);
    await contentReady(harness);
    const reply = await harness.runAction({
      commandId: "extract-appending",
      actionType: "web.dom.extract_list",
      timeoutMs: 60_000,
      extractList: { item: REVIEW, fields: { heading: "strong" }, paginate: { next: MORE_REVIEWS, maxPages: 5 } }
    });
    // The second page appends three reviews under the first three: each is read once.
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" }, extraction: { recordCount: 6, pagesRead: 2, truncated: false } });
    expect(reply.extracted).toEqual(REVIEW_HEADINGS.map((heading) => ({ heading })));
    // Why the read stopped is deliberately not asserted. The page hides the
    // button once every review is shown; a `next` read still presses the hidden
    // control and ends ten seconds later on `list_unchanged` ("the page ignored
    // its pagination control"), where `loadMore` treats a hidden control as the
    // list ending (`page-advance/load-more.ts`). Reported as an open defect in
    // `reports/t730-b4-extraction-lists.md`.
    await expect(page.locator(MORE_REVIEWS)).toBeHidden();
  });
});

test.describe("on professional-network", () => {
  test.setTimeout(120_000);

  /** A sent invitation: a connection request, a page invitation, or a newsletter invitation. */
  const ROW = "li[data-entity-urn]";
  /** "Show more", the button after the invitation list. */
  const MORE = "ul:has(> li[data-entity-urn]) + button";
  /** The invitation's own urn, so a row read twice would show up. */
  const rowFields = { urn: "@data-entity-urn" };
  /** Every pending sent invitation, newest first, as a session starts. */
  const SENT = pendingSent(createNetworkState(), "").map(({ urn }) => ({ urn }));

  /**
   * Sent invitations: ten rows, and a "Show more" whose first press after a
   * load never finishes -- a "Retry" appears under its spinner a moment later,
   * and only that loads the rows -- and which the page hides once nothing is left.
   */
  async function openSent(harness: ContentHarness): Promise<void> {
    await harness.page.goto(new URL("/scenarios/professional-network/mynetwork/invitation-manager/sent/", harness.lab.origin).href);
    await contentReady(harness);
    await expect(harness.page.locator(ROW).first()).toBeAttached({ timeout: 10_000 });
  }

  test("the list is longer than its first ten rows", () => {
    expect(SENT.length).toBeGreaterThan(10);
  });

  test("loadMore: appended rows are read once, and a control the page hides at the end ends the list", async ({ openHarness, page }) => {
    const harness = await openHarness("professional-network");
    await openSent(harness);
    const reply = await harness.runAction({
      commandId: "extract-load-more",
      actionType: "web.dom.extract_list",
      timeoutMs: 90_000,
      extractList: { item: ROW, fields: rowFields, paginate: { mode: "loadMore", control: MORE, maxPages: 10 } }
    });
    // Ten rows a load: the first ten, and one page for each press that loaded more.
    const pages = Math.ceil(SENT.length / INVITATION_PAGE_SIZE);
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: `${SENT.length} records from ${pages} pages; every declared field present` },
      extraction: { recordCount: SENT.length, pagesRead: pages, truncated: false, paginationStop: "control_absent" }
    });
    expect(reply.extracted).toEqual(SENT);
    // The page hid the button once nothing was left.
    await expect(page.locator(MORE)).toBeHidden();
  });
});

test.describe("on company-website", () => {
  test.setTimeout(120_000);

  const PEOPLE = 'section[aria-label="Our people"]';
  /** A card in the grid; the grid is the section's second `div`, after the branch chips. The leadership strip above is another section. */
  const CARD = `${PEOPLE} > div:nth-of-type(2) > article`;
  const MORE = `${PEOPLE} > button`;
  const cardFields = { name: "h3" };
  /** Everyone in the grid, in the order "Everyone" lists them, the job advert included. */
  const EVERYONE = teamCardsFor("all").map((card) => ({ name: card.name }));

  /** The team page with consent answered and the timed prompts dismissed, its first batch drawn. */
  async function openTeam(harness: ContentHarness): Promise<void> {
    await apply(harness, "set-consent", { choice: "essential" });
    await apply(harness, "dismiss-newsletter");
    await apply(harness, "dismiss-chat-greeting");
    await harness.page.goto(new URL("/scenarios/company-website/team", harness.lab.origin).href);
    await contentReady(harness);
    await expect(harness.page.locator(CARD).first()).toBeAttached({ timeout: 10_000 });
    // The batch endpoint refuses two requests closer than 900 ms; the read's first load must not be refused for the page's own.
    await harness.page.waitForTimeout(1_000);
  }

  // A whole-grid read is not here: the page's first press of "Show more people"
  // only shows a spinner, and a `loadMore` read takes that press for a page
  // ignoring its control, ending with the three automatic batches -- 24 of the
  // grid's people, `truncated: false` -- where a person presses again. The
  // whole-read row is the Sent invitations above; this one is reported as an
  // open defect in `reports/t730-b4-extraction-lists.md`.

  test("the grid holds more people than its three automatic batches", () => {
    expect(EVERYONE.length).toBeGreaterThan(TEAM_AUTO_BATCHES * TEAM_BATCH_SIZE);
  });

  test("loadMore: maxPages stops the read with people left and reports it truncated", async ({ openHarness }) => {
    const harness = await openHarness("company-website");
    await openTeam(harness);
    const reply = await harness.runAction({
      commandId: "extract-load-more-capped",
      actionType: "web.dom.extract_list",
      timeoutMs: 90_000,
      extractList: { item: CARD, fields: cardFields, paginate: { mode: "loadMore", control: MORE, maxPages: 2 } }
    });
    // The button is hidden until the automatic batches are in, so the second
    // page is the batch the read's own scroll brought; then the bound stops it.
    const read = EVERYONE.slice(0, 2 * TEAM_BATCH_SIZE);
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: `${read.length} records from 2 pages, truncated; paging stopped because extractList.paginate.maxPages = 2 was reached while the list went on; the read is incomplete -- rerun with input: {extractList: {paginate: {maxPages: N}}} to read more; every declared field present` },
      extraction: { recordCount: read.length, pagesRead: 2, truncated: true, paginationStop: "page_limit" }
    });
    expect(reply.extracted).toEqual(read);
  });

  test("loadMore: an advance that outlasts timeoutMs reports timed_out with the first page", async ({ openHarness }) => {
    const harness = await openHarness("company-website");
    await openTeam(harness);
    const reply = await harness.runAction({
      commandId: "extract-load-more-timeout",
      actionType: "web.dom.extract_list",
      timeoutMs: 300,
      extractList: { item: CARD, fields: cardFields, paginate: { mode: "loadMore", control: MORE, maxPages: 5 } }
    });
    // The first batch is read; the time runs out while the read waits for a way to more.
    const read = EVERYONE.slice(0, TEAM_BATCH_SIZE);
    expect(reply).toMatchObject({
      status: "timed_out",
      message: "Timed out extracting the list after 1 page.",
      validation: { status: "failed", actual: `${read.length} records from 1 page; the time ran out before the list ended` },
      failure: { code: "web.action.timeout", category: "timeout" },
      extraction: { recordCount: read.length, pagesRead: 1, truncated: false }
    });
    expect(reply.extracted).toEqual(read);
  });
});

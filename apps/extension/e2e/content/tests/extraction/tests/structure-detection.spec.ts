// Structure detection on request (`web.dom.capture_snapshot` with
// `detectStructure`) against the realistic sites: what the domain's authoring
// tool asks the page when a model wants to find the list a scraping step reads.
//
// What these rows are really proving:
// - with no target, the page's largest readable list is found -- the
//   everything store's result cards, the job board's fifty cards, the social
//   feed's posts -- and not its pager, its filter menus or its header, on pages
//   whose every class and id is generated;
// - with a target, the list around it is found, even when the target's
//   selector names every card's link, and a selector spanning two runs is
//   refused as ambiguous rather than answered for one of them;
// - a table is read by its column headers (the plumbing firm's price list);
// - how the list continues is reported: the store's Next, the team page's
//   "Show more people" button, and -- only because the feed declares itself one
//   with `role="feed"` -- infinite scroll;
// - what is detected is executable: its item and fields, sent back as a
//   `web.dom.extract_list` request, read the records;
// - sensitive controls are refused the way every reader refuses them, and no
//   answer quotes a page value (D3) or a secret (D2) -- on photo-social's
//   `saved-logins` login page, armed through `set-mode`, whose accounts list
//   repeats a password field across its rows beside a handle and a note, and
//   whose backup-code rows are nothing but a password field.
//
// Each site's own interruptions (consent, notification prompts, chat) are
// answered through the site's own operations before the page is read, as the
// site would record a person answering them; they are not what these rows are
// about.
//
// The message and action names are written out rather than imported, as
// `harness.ts` writes them out.

import type { Page } from "@playwright/test";
import type {
  WebAutomationExtractField,
  WebAutomationExtractListPagination,
  WebAutomationExtractListRequest,
  WebAutomationStructureDetection
} from "@fluxiq-web-extension/domain/client";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import { SAVED_LOGINS_VALUES } from "../../../../../../scenario-lab/src/scenarios/photo-social/index.js";

/** A made-up password, typed by these rows only, and asserted never to leave the page. */
const TYPED_SECRET = "SYNTHETIC_STRUCTURE_PASSWORD_DO_NOT_USE";
/** What photo-social's `saved-logins` page serves in password fields: the remembered passwords and the backup codes. */
const SERVED_SECRETS = [...SAVED_LOGINS_VALUES.accounts.map((account) => account.password), ...SAVED_LOGINS_VALUES.backupCodes];

/** The everything store's Plus wireless-earbud search, the live instruction task's own page. */
const STORE_SEARCH = "/scenarios/everything-store/s?k=wireless+earbuds&rh=plus";
/** A drawn result card; the placeholders carry the container attribute and no listing id. */
const STORE_CARD = '[data-component="search-result"][data-sku]';
/** The Hammerline auction with the longest bid history (thirteen bids). */
const BID_HISTORY_LISTING = "315018264403";

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;

async function detect(harness: ContentHarness, selector?: string): Promise<WebAutomationStructureDetection> {
  const reply = await harness.runAction({
    commandId: `detect-${selector ?? "largest"}`,
    actionType: "web.dom.capture_snapshot",
    detectStructure: selector === undefined ? {} : { selector }
  });
  // Detection only reads: the verb still succeeds with its snapshot.
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "none", reason: "evidence-only" } });
  expect(reply.snapshot).toBeTruthy();
  expect(reply.structure, "a snapshot asked to detect answers with a detection").toBeTruthy();
  return reply.structure as WebAutomationStructureDetection;
}

async function detected(harness: ContentHarness, selector?: string): Promise<Detected> {
  const structure = await detect(harness, selector);
  expect(structure.ok, `a structure was detected: ${JSON.stringify(structure)}`).toBe(true);
  if (!structure.ok) throw new Error("No structure detected.");
  return structure;
}

/** The detection as the request its handle would stand for: item, readable fields, pagination. */
function requestFrom(structure: Detected, paginate?: WebAutomationExtractListPagination): WebAutomationExtractListRequest {
  const fields = structure.proposal.fields.filter((field) => field.spec.handling !== "exclude");
  const request: WebAutomationExtractListRequest = {
    item: structure.proposal.item,
    fields: Object.fromEntries(fields.map((field) => [field.key, field.spec as WebAutomationExtractField]))
  };
  if (paginate !== undefined) request.paginate = paginate;
  return request;
}

/** One site operation, sent as the site's own scripts send it. */
async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

/** Opens a page of the harness's site and waits for the content script to announce itself in it. */
async function open(harness: ContentHarness, path: string): Promise<void> {
  await harness.page.goto(new URL(path, harness.lab.origin).href, { waitUntil: "load" });
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

/** The store's results with its consent, nudges and first-visit check already answered, and its cards drawn. */
async function openStoreSearch(harness: ContentHarness): Promise<void> {
  await apply(harness, "consent", { choice: "accept" });
  await apply(harness, "dismiss-nudge", { nudge: "app-banner" });
  await apply(harness, "dismiss-nudge", { nudge: "notifications" });
  await apply(harness, "pass-soft-check");
  await open(harness, STORE_SEARCH);
  await expect(harness.page.locator(STORE_CARD).first()).toBeVisible();
}

/** Visible texts, trimmed, for the D3 rows: no detection may quote one. */
async function texts(page: Page, selector: string): Promise<string[]> {
  return (await page.locator(selector).allInnerTexts()).map((text) => text.trim()).filter((text) => text.length > 3);
}

test("job-board: selected cards keep one shared company field that reads matching jobs after selection changes", async ({ openHarness, page }) => {
  const harness = await openHarness("job-board");
  await page.goto(new URL("/scenarios/job-board/jobs?q=Halvard", page.url()).href);
  const reject = page.getByRole("button", { name: "Reject non-essential", exact: true });
  if (await reject.isVisible()) await reject.click();
  const dismiss = page.getByRole("link", { name: "No thanks", exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  const titles = page.locator("article[data-jk] h2 a");
  await expect(titles.first()).toBeVisible();
  await titles.first().click();
  const structure = await detected(harness);
  const columns = await page.evaluate(({ item, fields }) => {
    const rows = [...document.querySelectorAll(item)];
    const target = (row: Element, company: boolean) => company
      ? row.querySelector("article > div:nth-of-type(2) > span:first-child")
      : row.querySelector("article h2 a");
    const matching = (company: boolean) => fields.filter((field) => field.spec.kind === "text" && field.spec.selector
      && rows.some((row) => row.querySelector(field.spec.selector!) === target(row, company)));
    const company = matching(true);
    const title = matching(false).find((field) => rows.every((row) => row.querySelector(field.spec.selector!) === target(row, false)));
    const expected = rows.filter((row) => target(row, true)?.textContent === "Halvard Labs")
      .map((row) => ({ title: target(row, false)?.textContent, company: target(row, true)?.textContent }));
    return { company, title, expected };
  }, { item: structure.proposal.item, fields: structure.proposal.fields });
  expect(columns.company).toHaveLength(1);
  expect(columns.company[0]!.coverage).toBe(1);
  expect(columns.title).toBeTruthy();
  expect(columns.expected.length).toBeGreaterThan(0);
  await titles.nth(1).click();
  const reply = await harness.runAction({
    commandId: "read-jobs-after-selection-change", actionType: "web.dom.extract_list",
    extractList: {
      item: structure.proposal.item,
      fields: { company: columns.company[0]!.spec as WebAutomationExtractField, title: columns.title!.spec as WebAutomationExtractField },
      where: [{ field: "company", equals: ["Halvard Labs"] }]
    }
  });
  expect(reply.status).toBe("succeeded");
  expect(reply.extracted).toEqual(columns.expected);
});


test("everything-store: the largest list on a results page is its result cards, with the pager's Next, and it reads", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("everything-store");
  await openStoreSearch(harness);
  const structure = await detected(harness);

  const drawn = await page.locator(STORE_CARD).count();
  expect(drawn).toBeGreaterThanOrEqual(12);
  expect(structure.proposal.itemCount).toBe(await page.locator(structure.proposal.item).count());
  // The run is the drawn cards -- results and the advertisements drawn from the same template -- and nothing else.
  expect(structure.proposal.itemCount).toBe(drawn);
  expect(structure.proposal.pagination).toMatchObject({ mode: "next", maxPages: 1 });
  const next = structure.proposal.pagination?.mode === "next" ? structure.proposal.pagination.next : "";
  expect(await page.locator(next).getAttribute("aria-label"), "Next is the pager's own Next").toMatch(/^Go to next page/u);
  expect(structure.infiniteScroll).toBeUndefined();

  // D3: nothing a card says is in the answer.
  const names = await texts(page, `${STORE_CARD} h2`);
  expect(names.length).toBeGreaterThan(0);
  const wire = JSON.stringify(structure);
  for (const name of names) expect(wire, `the detection quotes no product name (${name})`).not.toContain(name);

  const reply = await harness.runAction({ commandId: "extract-detected-results", actionType: "web.dom.extract_list", extractList: requestFrom(structure) });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  // The read may reach the cards the store draws only when the list's end is scrolled to (`list-completeness.spec.ts`).
  expect(reply.extraction?.recordCount ?? 0).toBeGreaterThanOrEqual(structure.proposal.itemCount);
});

test("everything-store: a target whose selector names every card's title link finds the same list; one spanning cards and pager is ambiguous", async ({ openHarness }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("everything-store");
  await openStoreSearch(harness);
  const largest = await detected(harness);
  const aroundLink = await detected(harness, `${STORE_CARD} h2 a`);
  expect(aroundLink.proposal.item).toBe(largest.proposal.item);
  expect(aroundLink.proposal.itemCount).toBe(largest.proposal.itemCount);
  expect(aroundLink.proposal.fields.map((field) => field.key)).toEqual(largest.proposal.fields.map((field) => field.key));

  expect(await detect(harness, `${STORE_CARD} h2 a, nav[aria-label="pagination"] a`)).toEqual({ ok: false, refused: "ambiguous_target" });
  expect(await detect(harness, '[data-testid="no-such-element"]')).toEqual({ ok: false, refused: "target_not_found" });
  expect(await detect(harness, "::not a selector")).toEqual({ ok: false, refused: "target_not_found" });
});

test("auction-marketplace: the largest list on a bid history is its rows, read by column header", async ({ openHarness, page }) => {
  const harness = await openHarness("auction-marketplace");
  await apply(harness, "consent", { choice: "rejected" });
  await apply(harness, "dismiss-promo");
  await apply(harness, "dismiss-greeting");
  await open(harness, `/scenarios/auction-marketplace/bfl/viewbids/${BID_HISTORY_LISTING}`);
  const table = "main table";
  await expect(page.locator(`${table} tbody tr`).first()).toBeVisible();
  const structure = await detected(harness);

  const rows = await page.locator(`${table} tbody tr`).count();
  expect(rows).toBeGreaterThanOrEqual(10);
  expect(structure.proposal.itemCount).toBe(rows);
  expect(await page.locator(structure.proposal.item).count()).toBe(rows);
  const headers = (await page.locator(`${table} thead th`).allInnerTexts()).map((header) => header.trim());
  expect(headers).toEqual(["Bidder", "Bid amount"]);
  expect(structure.proposal.fields.map((field) => field.spec.header)).toEqual(headers);
  expect(structure.proposal.fields.map((field) => field.spec.kind)).toEqual(headers.map(() => "column"));
  expect(structure.proposal.pagination).toBeUndefined();
  expect(structure.infiniteScroll).toBeUndefined();

  const reply = await harness.runAction({ commandId: "extract-detected-table", actionType: "web.dom.extract_list", extractList: requestFrom(structure) });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  const records = reply.extracted as Array<Record<string, string | null>>;
  expect(records).toHaveLength(rows);
  // D3: no amount the rows name is in the answer.
  const wire = JSON.stringify(structure);
  const amountKey = structure.proposal.fields.find((field) => field.spec.header === "Bid amount")!.key;
  for (const amount of records.map((record) => String(record[amountKey]))) {
    expect(amount).toMatch(/\d/u);
    expect(wire, `the detection quotes no cell (${amount})`).not.toContain(amount);
  }
});

test("job-board: the largest list on a fifty-result page is every card, past the filter menus and the header", async ({ openHarness, page }) => {
  const harness = await openHarness("job-board");
  await apply(harness, "consent", { choice: "rejected" });
  await apply(harness, "dismiss-alert-offer");
  await apply(harness, "minimise-chat");
  await open(harness, "/scenarios/job-board/jobs?limit=50");
  const cards = "ol > li > article";
  await expect(page.locator(cards).first()).toBeVisible();
  const structure = await detected(harness);

  const drawn = await page.locator(cards).count();
  expect(drawn).toBeGreaterThan(25);
  expect(structure.proposal.itemCount).toBe(await page.locator(structure.proposal.item).count());
  expect(structure.proposal.itemCount).toBe(drawn);

  // D3: no posting's title is in the answer.
  const titles = await texts(page, `${cards} h2`);
  expect(titles.length).toBeGreaterThan(0);
  const wire = JSON.stringify(structure);
  for (const title of titles) expect(wire, `the detection quotes no title (${title})`).not.toContain(title);
});

test("social-network-feed: a declared feed is reported as infinite scroll, and scrolling reads it to its end", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("social-network-feed");
  await apply(harness, "consent", { choice: "all" });
  await apply(harness, "notifications", { choice: "dismissed" });
  await apply(harness, "chat", { state: "closed" });
  await open(harness, "/scenarios/social-network-feed/");
  await expect(page.locator('[role="feed"] [role="article"]').first()).toBeVisible();
  const structure = await detected(harness);

  const items = page.locator(structure.proposal.item);
  expect(await items.count()).toBe(structure.proposal.itemCount);
  expect(structure.proposal.itemCount).toBeGreaterThan(0);
  const inFeed = await items.evaluateAll((elements) => elements.every((element) => element.closest('[role="feed"]') !== null && (element.matches('[role="article"]') || element.querySelector('[role="article"]') !== null)));
  expect(inFeed, "the run is the feed's posts").toBe(true);
  expect(structure.proposal.pagination).toBeUndefined();
  expect(structure.infiniteScroll).toBe(true);

  // What the domain keeps for a declared feed: a scroll bounded by the page bound, which the reader stops short of at the end.
  // Read by the posts' links alone: a post's text is cut short behind "See
  // more" until a row-bound click opens it, and a read of cut text is refused
  // (`social-read-completion.spec.ts`), which is a different rule from this one.
  // Optional, because the suggested posts after "You're all caught up" are drawn without one.
  const links = Object.fromEntries(structure.proposal.fields
    .filter((field) => field.spec.kind === "link" && field.coverage === 1)
    .map((field) => [field.key, { ...field.spec, required: false } as WebAutomationExtractField]));
  expect(Object.keys(links).length).toBeGreaterThan(0);
  const reply = await harness.runAction({
    commandId: "extract-detected-feed",
    actionType: "web.dom.extract_list",
    extractList: { item: structure.proposal.item, fields: links, paginate: { mode: "scroll", maxScrolls: 50 } }
  });
  expect(reply, JSON.stringify({ failure: reply.failure, extraction: reply.extraction })).toMatchObject({ status: "succeeded", extraction: { truncated: false, paginationStop: "scrolled_to_end" } });
  expect(reply.extraction?.recordCount ?? 0, "the feed was read past its first batch").toBeGreaterThan(structure.proposal.itemCount);
  await expect(page.getByText("No more posts to show right now")).toBeAttached();
});

test("company-website: a grid continued by its Show more people button pages by the button, not by scrolling", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("company-website");
  await apply(harness, "set-consent", { choice: "essential" });
  await apply(harness, "dismiss-newsletter");
  await apply(harness, "dismiss-chat-greeting");
  await open(harness, "/scenarios/company-website/team");
  const people = 'section[aria-label="Our people"]';
  const more = page.locator(`${people} > button`);
  // The grid loads its batches as its end scrolls into view, then hands over to the button.
  for (let scroll = 0; scroll < 12 && !(await more.isVisible()); scroll += 1) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1_200);
  }
  await expect(more).toBeVisible();
  const structure = await detected(harness, `${people} article`);

  expect(structure.proposal.pagination).toMatchObject({ mode: "loadMore" });
  const control = structure.proposal.pagination?.mode === "loadMore" ? structure.proposal.pagination.control : "";
  expect(await page.locator(control).innerText()).toBe("Show more people");
  expect(structure.infiniteScroll).toBeUndefined();
});

test("photo-social: a login form is answered as one record beside the page's list, never as a list of its fields", async ({ openHarness, page }) => {
  const harness = await openHarness("photo-social");
  await apply(harness, "consent", { choice: "essential" });
  await apply(harness, "notifications");
  await open(harness, "/scenarios/photo-social/accounts/login/");
  // A page-wide search passes the form's fields over (`isFormNotData`); a
  // target inside the form gets the form as one record, its password excluded,
  // beside the nearest real list the page holds.
  const largest = await detected(harness);
  expect(await page.locator(`form ${largest.proposal.item}, form:is(${largest.proposal.item})`).count(), "the form is not the page's list").toBe(0);
  const aimed = await detected(harness, 'input[name="username"]');
  expect(await page.locator(`form :is(${aimed.proposal.item})`).count(), "the form's fields are not answered as a list").toBe(0);
  expect(aimed.record, "the form is answered as one record").toBeTruthy();
  expect(await page.locator(aimed.record!.item).evaluateAll((elements) => elements.map((element) => element.tagName.toLowerCase()))).toEqual(["form"]);
  const password = aimed.record!.fields.filter((field) => field.label.includes("password"));
  expect(password.length).toBeGreaterThan(0);
  for (const field of password) expect(field.spec.handling).toBe("exclude");

  const plain = await harness.runAction({ commandId: "plain-capture", actionType: "web.dom.capture_snapshot" });
  expect(plain.status).toBe("succeeded");
  expect(plain.structure).toBeUndefined();
});

test("photo-social: sensitive controls are refused, excluded, and never quoted", async ({ openHarness, page }) => {
  const harness = await openHarness("photo-social");
  await apply(harness, "set-mode", { mode: "saved-logins" });
  await apply(harness, "consent", { choice: "essential" });
  await apply(harness, "notifications");
  await open(harness, "/scenarios/photo-social/accounts/login/");

  // The page's own password, with a secret typed into it: refused where it is aimed at, and never quoted.
  await page.locator('input[name="password"]').fill(TYPED_SECRET);
  expect(await detect(harness, 'input[name="password"]')).toMatchObject({ ok: false });

  // The backup codes, rows of nothing but a password: nothing in them may be read.
  expect(await detect(harness, '[data-testid="backup-code"]')).toEqual({ ok: false, refused: "sensitive_region" });
  expect(await detect(harness, '[data-testid="backup-code-value"]')).toEqual({ ok: false, refused: "sensitive_region" });

  // The accounts on this device, a handle and a note beside each password: detected, with the password excluded (D12).
  const structure = await detected(harness, '[data-testid="saved-login-handle"]');
  expect(structure.proposal.item).toBe('[data-testid="saved-login"]');
  const secret = structure.proposal.fields.find((field) => field.key === "saved-login-password");
  expect(secret?.spec).toMatchObject({ kind: "value", handling: "exclude" });

  for (const wire of [JSON.stringify(structure), JSON.stringify(await harness.messages())]) {
    for (const value of [TYPED_SECRET, ...SERVED_SECRETS]) expect(wire).not.toContain(value);
  }
});

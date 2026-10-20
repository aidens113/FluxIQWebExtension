// Inference (C4) against the realistic sites: the `extraction.propose` message,
// and whether what it proposes actually reads the list the user picked in.
//
// What these rows are really proving:
// - a picked *field* proposes the *record* it sits in -- the store's result
//   card, not the title inside it; the bid history's rows, not the two cells of
//   one row --
//   and the item selector it proposes matches exactly that run, so a header row
//   or a summary row cannot arrive as a record;
// - the proposal is executable: sent straight back as a `web.dom.extract_list`
//   request it reads the list, with the keys and kinds it proposed;
// - reading a table by its headers survives the columns being reordered, which
//   is the point of proposing `column` fields rather than positions (no
//   realistic site reorders a table, so the reorder is made in the page, as a
//   redesign would make it);
// - a field whose element is a sensitive control is proposed `handling:
//   "exclude"` (decision D12), so the request built from a proposal never reads
//   it and the extraction still succeeds on the rest of the row (photo-social's
//   `saved-logins` login page, armed through `set-mode`, lists the accounts the
//   device remembers, each row a handle, when it was last used and a password
//   field served with the remembered password);
// - a proposal carries no page value (decision D3): the whole reply is searched
//   for the text of the list it describes.
//
// The message name is written out rather than imported, as `harness.ts` writes
// out the others: a spec that shared the constant could not notice it changing.
// The proposal *type* is imported, because that is the contract the picker and
// the domain share.
//
// New harness specs live under `extraction/tests/` (D16), two levels below
// `e2e/content/tests/`, and both levels are load-bearing. The `extraction/`
// directory exists because `e2e/content/tests/` is already at the audit's
// 25-file limit. The `tests/` directory inside it exists because a test file
// must sit directly inside a test root, and `testRootDirNames` is
// `["tests", "e2e"]` -- a spec placed in `extraction/` itself fails the
// test-placement rule. Moving this file up a level breaks one rule or the
// other, so the imports below are three levels deep on purpose. Splitting
// `extract-list.spec.ts` and `evidence.spec.ts` (X5-H) should land here too.

import type { Page } from "@playwright/test";
import type { WebAutomationExtractField, WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import { SAVED_LOGINS_VALUES } from "../../../../../../scenario-lab/src/scenarios/photo-social/index.js";

/** The everything store's Plus wireless-earbud search, the live instruction task's own page. */
const STORE_SEARCH = "/scenarios/everything-store/s?k=wireless+earbuds&rh=plus";
/** A drawn result card; the placeholders carry the container attribute and no listing id. */
const STORE_CARD = '[data-component="search-result"][data-sku]';
/** The Hammerline auction with the longest bid history (thirteen bids). */
const BID_HISTORY_LISTING = "315018264403";

/** The passwords photo-social's `saved-logins` page remembers its accounts with; no reply may carry one. */
const REMEMBERED_PASSWORDS = SAVED_LOGINS_VALUES.accounts.map((account) => account.password);

type ProposeReply = { ok: true; proposal: WebAutomationExtractionProposal } | { ok: false; refused: string };

/** Asks the content script what the element proposes, as the picker and the background worker will. */
async function propose(harness: ContentHarness, selector: string): Promise<WebAutomationExtractionProposal> {
  const delivery = await harness.deliver({ type: "extraction.propose", selector });
  expect(delivery.responded, `the content script answered extraction.propose for ${selector}`).toBe(true);
  const reply = delivery.response as ProposeReply;
  expect(reply.ok, `a proposal was made for ${selector}: ${JSON.stringify(reply)}`).toBe(true);
  if (!reply.ok) throw new Error(`No proposal for ${selector}.`);
  return reply.proposal;
}

/** The proposal as the request it stands for: its item selector, and each field's spec under its key. */
function requestFrom(proposal: WebAutomationExtractionProposal): { item: string; fields: Record<string, WebAutomationExtractField> } {
  return {
    item: proposal.item,
    fields: Object.fromEntries(proposal.fields.map((field) => [field.key, field.spec as WebAutomationExtractField]))
  };
}

function fieldLabelled(proposal: WebAutomationExtractionProposal, label: string): WebAutomationExtractionProposal["fields"][number] {
  const field = proposal.fields.find((candidate) => candidate.label === label);
  expect(field, `the proposal has a field labelled ${label}: ${proposal.fields.map((one) => one.label).join(", ")}`).toBeTruthy();
  if (!field) throw new Error(`No field labelled ${label}.`);
  return field;
}

/**
 * The key of the proposed field of `kind` that, in every item, reads the
 * element `within` names inside it: the element itself or, for a link, one
 * holding it; for text, the element or one inside it carrying the same words.
 * Keys are derived from page structure, so a row asks the page which field
 * reads what rather than naming one.
 */
async function fieldReading(page: Page, proposal: WebAutomationExtractionProposal, kind: "text" | "link", within: string): Promise<string> {
  const key = await page.evaluate(({ item, fields, kind, within }) => {
    const items = [...document.querySelectorAll(item)];
    const reads = (field: (typeof fields)[number]) => items.every((row) => {
      const target = row.querySelector(within);
      if (!target) return false;
      const selected = field.spec.selector ? row.querySelector(field.spec.selector) : row;
      if (!selected) return false;
      if (selected === target) return true;
      if (kind === "link") return selected.contains(target);
      return target.contains(selected) && selected.textContent?.trim() === target.textContent?.trim();
    });
    return fields.find((field) => field.spec.kind === kind && reads(field))?.key ?? "";
  }, { item: proposal.item, fields: proposal.fields, kind, within });
  expect(key, `a ${kind} field reads each item's ${within}: ${proposal.fields.map((field) => `${field.key}=${field.spec.kind}`).join(", ")}`).not.toBe("");
  return key;
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

test("everything-store: a picked product title proposes the result cards, with a link field and the Next control", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("everything-store");
  await apply(harness, "consent", { choice: "accept" });
  await apply(harness, "dismiss-nudge", { nudge: "app-banner" });
  await apply(harness, "dismiss-nudge", { nudge: "notifications" });
  await apply(harness, "pass-soft-check");
  await open(harness, STORE_SEARCH);
  await expect(page.locator(STORE_CARD).first()).toBeVisible();
  const proposal = await propose(harness, `${STORE_CARD} h2 a`);

  // The record is the card the title sits in, not the heading and not the list.
  const drawn = await page.locator(STORE_CARD).count();
  expect(proposal.itemCount).toBe(drawn);
  expect(await page.locator(proposal.item).count()).toBe(drawn);
  expect(await page.locator(`:is(${proposal.item}) h2 a`).count()).toBe(drawn);
  expect(proposal.confidence).toBeGreaterThan(0);
  expect(proposal.confidence).toBeLessThanOrEqual(1);

  const linkKey = await fieldReading(page, proposal, "link", "h2 a");
  const titleKey = await fieldReading(page, proposal, "text", "h2 a");

  // Next is detected, named explicitly, and asks for the page in front of it
  // (`detect-pagination.ts`, PROPOSED_MAX_PAGES).
  expect(await page.locator('nav[aria-label="pagination"] a[aria-label^="Go to page"]').count()).toBeGreaterThan(1);
  expect(proposal.pagination).toMatchObject({ mode: "next", maxPages: 1 });
  const next = proposal.pagination?.mode === "next" ? proposal.pagination.next : "";
  expect(await page.locator(next).getAttribute("aria-label")).toMatch(/^Go to next page/u);

  // D3: nothing the cards say is in the proposal.
  const names = (await page.locator(`${STORE_CARD} h2 a`).allInnerTexts()).map((name) => name.trim());
  const wire = JSON.stringify(proposal);
  for (const name of names) expect(wire, `the proposal quotes no product name (${name})`).not.toContain(name);

  // The proposal is the request: sent back, it reads this page's records.
  const reply = await harness.runAction({
    commandId: "extract-proposed-results",
    actionType: "web.dom.extract_list",
    extractList: requestFrom(proposal)
  });
  expect(reply, JSON.stringify(reply.failure ?? reply.validation)).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  const records = reply.extracted as Array<Record<string, string | null>>;
  // The read may reach the cards the store draws only when the list's end is scrolled to (`list-completeness.spec.ts`).
  expect(records.length).toBeGreaterThanOrEqual(drawn);
  expect(records.slice(0, drawn).map((record) => record[titleKey])).toEqual(names);
  for (const record of records) expect(String(record[linkKey])).toMatch(/^https?:\/\//u);
});

test("auction-marketplace: a picked bid amount proposes the history's rows as column fields, and the header row is not a record", async ({ openHarness, page }) => {
  const harness = await openHarness("auction-marketplace");
  await apply(harness, "consent", { choice: "rejected" });
  await apply(harness, "dismiss-promo");
  await apply(harness, "dismiss-greeting");
  await open(harness, `/scenarios/auction-marketplace/bfl/viewbids/${BID_HISTORY_LISTING}`);
  const table = "main table";
  await expect(page.locator(`${table} tbody tr`).first()).toBeVisible();
  const proposal = await propose(harness, `${table} tbody tr:nth-child(2) td:nth-child(2)`);

  // The cells of one row are a run too; the record is the row they are columns of.
  const rows = await page.locator(`${table} tbody tr`).count();
  expect(rows).toBeGreaterThanOrEqual(10);
  expect(proposal.itemCount).toBe(rows);
  expect(await page.locator(proposal.item).count()).toBe(rows);
  expect(await page.locator(`${table} thead tr`).evaluate((header, item) => header.matches(item), proposal.item)).toBe(false);

  const headers = (await page.locator(`${table} thead th`).allInnerTexts()).map((header) => header.trim());
  expect(headers).toEqual(["Bidder", "Bid amount"]);
  expect(proposal.fields.map((field) => field.spec.kind)).toEqual(headers.map(() => "column"));
  expect(proposal.fields.map((field) => field.spec.header)).toEqual(headers);

  const request = requestFrom(proposal);
  const before = await harness.runAction({ commandId: "extract-proposed-table", actionType: "web.dom.extract_list", extractList: request });
  expect(before).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  expect(before.extracted).toHaveLength(rows);

  // Reading by header is what survives the reorder: the same request, the same
  // records. The columns are swapped in the page, cell for cell, as a redesign
  // of the table would draw them; no realistic site reorders a table itself.
  await page.evaluate((selector) => {
    for (const row of document.querySelectorAll(`${selector} tr`)) {
      const last = row.lastElementChild;
      if (last) row.prepend(last);
    }
  }, table);
  await expect(page.locator(`${table} thead th`).first()).toHaveText("Bid amount");
  const after = await harness.runAction({ commandId: "extract-reordered-proposal", actionType: "web.dom.extract_list", extractList: request });
  expect(after).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  expect(after.extracted).toEqual(before.extracted);
});

test("photo-social: a password field in a repeating row is proposed excluded, and no reply carries its value", async ({ openHarness }) => {
  const harness = await openHarness("photo-social");
  await apply(harness, "set-mode", { mode: "saved-logins" });
  await apply(harness, "consent", { choice: "essential" });
  await apply(harness, "notifications");
  await open(harness, "/scenarios/photo-social/accounts/login/");
  const proposal = await propose(harness, '[data-testid="saved-login-handle"]');
  const unquoted = (wire: string) => {
    for (const password of REMEMBERED_PASSWORDS) expect(wire).not.toContain(password);
  };

  expect(proposal.itemCount).toBe(3);
  expect(proposal.item).toBe('[data-testid="saved-login"]');
  // D12: the picker opens with the password's column excluded, and inference cannot propose otherwise.
  expect(fieldLabelled(proposal, "saved-login-password").spec).toMatchObject({ kind: "value", handling: "exclude" });
  // The ordinary fields beside it are untouched, so the exclusion is targeted.
  expect(fieldLabelled(proposal, "saved-login-handle").spec.handling).toBeUndefined();
  expect(fieldLabelled(proposal, "saved-login-last-used").spec.handling).toBeUndefined();
  unquoted(JSON.stringify(proposal));

  // The request built from the proposal reads the rows and never the password.
  const reply = await harness.runAction({
    commandId: "extract-proposed-saved-logins",
    actionType: "web.dom.extract_list",
    extractList: requestFrom(proposal)
  });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  const handle = fieldLabelled(proposal, "saved-login-handle").key;
  const lastUsed = fieldLabelled(proposal, "saved-login-last-used").key;
  expect([...(reply.extraction?.fieldNames ?? [])].sort()).toEqual([handle, lastUsed].sort());
  expect(reply.extracted).toEqual(SAVED_LOGINS_VALUES.accounts.map((account) => ({ [handle]: account.handle, [lastUsed]: account.lastUsed })));
  unquoted(JSON.stringify(reply));
  unquoted(JSON.stringify(await harness.messages()));
});

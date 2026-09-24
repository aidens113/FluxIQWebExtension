// Inference (C4) against real fixtures: the `extraction.propose` message, and
// whether what it proposes actually reads the list the user picked in.
//
// What these rows are really proving:
// - a picked *field* proposes the *record* it sits in -- the card, not the
//   heading inside it; the twelve table rows, not the four cells of one row --
//   and the item selector it proposes matches exactly that run, so a header row
//   or a summary row cannot arrive as a record;
// - the proposal is executable: sent straight back as a `web.dom.extract_list`
//   request it reads the list, with the keys and kinds it proposed;
// - reading a table by its headers survives the columns being reordered, which
//   is the point of proposing `column` fields rather than positions;
// - a field whose element is a sensitive control is proposed `handling:
//   "exclude"` (decision D12), so the request built from a proposal never reads
//   it and the extraction still succeeds on the rest of the row;
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

const NEXT = '[data-testid="pagination-next"]';
const PAGE_NUMBERS = '[data-testid^="pagination-page-"]';
const PRODUCT_NAME = '[data-testid="product-name"]';

/** A synthetic password, injected by these rows only, and asserted never to leave the page. */
const INJECTED_SECRET = "SYNTHETIC_PROPOSAL_PASSWORD_DO_NOT_USE";

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
 * Arms a fixture variant through the Lab's authenticated `mutate` endpoint and
 * reloads, as `extract-list.spec.ts` does for the same fixture.
 */
async function armVariant(harness: ContentHarness, operation: string): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify({})
  });
  if (!response.ok) throw new Error(`The Scenario Lab answered ${response.status} arming ${operation} on ${harness.scenarioId}.`);
  await harness.page.reload();
  const ready = (await harness.messages()).some((message) => message.type === "fluxiq.contentReady");
  expect(ready, "the content script re-announced itself after the reload").toBe(true);
}

/** Three rows of one template, each holding an ordinary label and a password field that is marked by its type alone. */
async function injectCredentialRows(page: Page, secret: string): Promise<void> {
  await page.evaluate((password) => {
    const main = document.querySelector("main");
    if (!main) throw new Error("basic-form has no main");
    const rows = [1, 2, 3].map((number) =>
      `<li data-testid="credential-row">`
      + `<span data-testid="credential-label">Account ${number}</span>`
      + `<input type="password" data-testid="credential-secret" name="secret-${number}" value="${password}">`
      + `</li>`).join("");
    main.insertAdjacentHTML("beforeend", `<ul data-testid="credential-list">${rows}</ul>`);
  }, secret);
}

test("product-catalog: a picked product name proposes the eight cards, with a link field and the Next control", async ({ openHarness, page }) => {
  const harness = await openHarness("product-catalog");
  const proposal = await propose(harness, PRODUCT_NAME);

  // The record is the card the name sits in, not the heading and not the list.
  expect(proposal.itemCount).toBe(8);
  expect(await page.locator(proposal.item).count()).toBe(8);
  expect(await page.locator(`${proposal.item} ${PRODUCT_NAME}`).count()).toBe(8);
  expect(proposal.confidence).toBeGreaterThan(0);
  expect(proposal.confidence).toBeLessThanOrEqual(1);

  expect(proposal.fields.map((field) => field.spec.kind)).toContain("link");
  expect(fieldLabelled(proposal, "product-link").spec).toMatchObject({ kind: "link" });

  // Next is detected, named explicitly, and asks for the page in front of it.
  // The count used to come from the page's own numbered controls, which made a
  // proposal decide how much of a list to take -- a question only the
  // instruction can answer, and the one that had two of three live runs on
  // 2026-09-24 walk a three-page catalog for a "first page" request
  // (`detect-pagination.ts`, PROPOSED_MAX_PAGES).
  expect(await page.locator(PAGE_NUMBERS).count()).toBeGreaterThan(1);
  expect(proposal.pagination).toMatchObject({ mode: "next", next: NEXT, maxPages: 1 });

  // D3: nothing the cards say is in the proposal.
  const names = (await page.locator(PRODUCT_NAME).allInnerTexts()).map((name) => name.trim());
  const wire = JSON.stringify(proposal);
  for (const name of names) expect(wire, `the proposal quotes no product name (${name})`).not.toContain(name);

  // The proposal is the request: sent back, it reads this page's records.
  const reply = await harness.runAction({
    commandId: "extract-proposed-catalog",
    actionType: "web.dom.extract_list",
    extractList: requestFrom(proposal)
  });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  const records = reply.extracted as Array<Record<string, string | null>>;
  expect(records).toHaveLength(8);
  expect(records.map((record) => record[fieldLabelled(proposal, "product-name").key])).toEqual(names);
  for (const record of records) {
    expect(String(record[fieldLabelled(proposal, "product-link").key])).toMatch(/^https?:\/\//u);
  }
});

test("data-table: a picked Price cell proposes the twelve rows as column fields, and the header row is not a record", async ({ openHarness, page }) => {
  const harness = await openHarness("data-table");
  const proposal = await propose(harness, '[data-testid="inventory-body"] tr td:nth-child(3)');

  // The cells of one row are a run too; the record is the row they are columns of.
  expect(proposal.itemCount).toBe(12);
  expect(proposal.item).toBe('[data-testid="inventory-row"]');
  expect(await page.locator(proposal.item).count()).toBe(12);

  const headers = (await page.locator("thead th").allInnerTexts()).map((header) => header.trim());
  expect(proposal.fields.map((field) => field.spec.kind)).toEqual(headers.map(() => "column"));
  expect(proposal.fields.map((field) => field.spec.header)).toEqual(headers);

  const request = requestFrom(proposal);
  const before = await harness.runAction({ commandId: "extract-proposed-table", actionType: "web.dom.extract_list", extractList: request });
  expect(before).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  expect(before.extracted).toHaveLength(12);

  // Reading by header is what survives the reorder: the same request, the same records.
  await armVariant(harness, "reorder-columns");
  await expect(page.locator("thead th").first()).toHaveText("Price");
  const after = await harness.runAction({ commandId: "extract-reordered-proposal", actionType: "web.dom.extract_list", extractList: request });
  expect(after).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  expect(after.extracted).toEqual(before.extracted);
});

test("basic-form: a password field in a repeating row is proposed excluded, and no reply carries its value", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await injectCredentialRows(page, INJECTED_SECRET);
  const proposal = await propose(harness, '[data-testid="credential-label"]');

  expect(proposal.itemCount).toBe(3);
  expect(proposal.item).toBe('[data-testid="credential-row"]');
  // D12: the picker opens with the password's column excluded, and inference cannot propose otherwise.
  expect(fieldLabelled(proposal, "credential-secret").spec).toMatchObject({ kind: "value", handling: "exclude" });
  // The ordinary field beside it is untouched, so the exclusion is targeted.
  expect(fieldLabelled(proposal, "credential-label").spec.handling).toBeUndefined();
  expect(JSON.stringify(proposal)).not.toContain(INJECTED_SECRET);

  // The request built from the proposal reads the rows and never the password.
  const reply = await harness.runAction({
    commandId: "extract-proposed-credentials",
    actionType: "web.dom.extract_list",
    extractList: requestFrom(proposal)
  });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  expect(reply.extraction?.fieldNames).toEqual([fieldLabelled(proposal, "credential-label").key]);
  expect(reply.extracted).toEqual([1, 2, 3].map((number) => ({ [fieldLabelled(proposal, "credential-label").key]: `Account ${number}` })));
  expect(JSON.stringify(reply)).not.toContain(INJECTED_SECRET);
  expect(JSON.stringify(await harness.messages())).not.toContain(INJECTED_SECRET);
});

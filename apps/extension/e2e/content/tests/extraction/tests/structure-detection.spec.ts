// Structure detection on request (`web.dom.capture_snapshot` with
// `detectStructure`) against real fixtures: what the domain's authoring tool
// asks the page when a model wants to find the list a scraping step reads.
//
// What these rows are really proving:
// - with no target, the page's largest readable list is found -- the catalog's
//   eight cards, the table's twelve rows, the directory's 240 rows, the feed's
//   posts -- and not its pagination buttons, its menus or a form's labels;
// - with a target, the list around it is found, even when the target's
//   selector names every card's link, and a selector spanning two runs is
//   refused as ambiguous rather than answered for one of them;
// - how the list continues is reported: the catalog's Next control, the feed's
//   Load more button, and -- only because the feed declares itself one with
//   `role="feed"` -- infinite scroll;
// - what is detected is executable: its item and fields, sent back as a
//   `web.dom.extract_list` request, read the records;
// - sensitive controls are refused the way every reader refuses them, and no
//   answer quotes a page value (D3) or a secret (D2).
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
import { armVariant } from "./scenario-variant.js";

/** A synthetic password, injected by these rows only, and asserted never to leave the page. */
const INJECTED_SECRET = "SYNTHETIC_STRUCTURE_PASSWORD_DO_NOT_USE";

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

/** Rows of one template: a label, and a password field marked by its type alone -- or, with `secretOnly`, the password alone. */
async function injectCredentialRows(page: Page, secret: string, secretOnly: boolean): Promise<void> {
  await page.evaluate(([password, onlySecret]) => {
    const main = document.querySelector("main");
    if (!main) throw new Error("basic-form has no main");
    const rows = [1, 2, 3].map((number) =>
      `<li data-testid="credential-row">`
      + (onlySecret ? "" : `<span data-testid="credential-label">Account ${number}</span>`)
      + `<input type="password" data-testid="credential-secret" name="secret-${number}" value="${password}">`
      + `</li>`).join("");
    main.insertAdjacentHTML("beforeend", `<ul data-testid="credential-list">${rows}</ul>`);
  }, [secret, secretOnly] as const);
}

test("product-catalog: the largest list is the eight cards, with their fields and the Next control, and it reads", async ({ openHarness, page }) => {
  const harness = await openHarness("product-catalog");
  const structure = await detected(harness);

  expect(structure.proposal.itemCount).toBe(8);
  expect(structure.proposal.item).toBe('[data-testid="product-card"]');
  expect(await page.locator(structure.proposal.item).count()).toBe(8);
  expect(structure.proposal.pagination).toMatchObject({ next: '[data-testid="pagination-next"]' });
  expect(structure.infiniteScroll).toBeUndefined();
  const byKey = new Map(structure.proposal.fields.map((field) => [field.key, field]));
  expect(byKey.get("product-link")?.spec.kind).toBe("link");
  expect(byKey.get("product-name")?.spec.kind).toBe("text");

  // D3: nothing a card says is in the answer.
  const names = (await page.locator('[data-testid="product-name"]').allInnerTexts()).map((name) => name.trim());
  const wire = JSON.stringify(structure);
  for (const name of names) expect(wire, `the detection quotes no product name (${name})`).not.toContain(name);

  const reply = await harness.runAction({ commandId: "extract-detected-catalog", actionType: "web.dom.extract_list", extractList: requestFrom(structure) });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  const records = reply.extracted as Array<Record<string, string | null>>;
  expect(records).toHaveLength(8);
  expect(records.map((record) => record["product-name"])).toEqual(names);
});

test("product-catalog: a target whose selector names every card's link finds the same list; one spanning two runs is ambiguous", async ({ openHarness }) => {
  const harness = await openHarness("product-catalog");
  const largest = await detected(harness);
  const aroundLink = await detected(harness, '[data-testid="product-link"]');
  expect(aroundLink).toEqual(largest);

  expect(await detect(harness, '[data-testid="product-link"], [data-testid^="pagination-page-"]')).toEqual({ ok: false, refused: "ambiguous_target" });
  expect(await detect(harness, '[data-testid="no-such-element"]')).toEqual({ ok: false, refused: "target_not_found" });
  expect(await detect(harness, "::not a selector")).toEqual({ ok: false, refused: "target_not_found" });
});

test("data-table: the largest list is the twelve rows, read by column header", async ({ openHarness, page }) => {
  const harness = await openHarness("data-table");
  const structure = await detected(harness);

  expect(structure.proposal.itemCount).toBe(12);
  expect(structure.proposal.item).toBe('[data-testid="inventory-row"]');
  const headers = (await page.locator("thead th").allInnerTexts()).map((header) => header.trim());
  expect(structure.proposal.fields.map((field) => field.spec.header)).toEqual(headers);
  expect(structure.proposal.fields.map((field) => field.spec.kind)).toEqual(headers.map(() => "column"));
  expect(structure.proposal.pagination).toBeUndefined();
  expect(structure.infiniteScroll).toBeUndefined();

  const reply = await harness.runAction({ commandId: "extract-detected-table", actionType: "web.dom.extract_list", extractList: requestFrom(structure) });
  expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
  const records = reply.extracted as Array<Record<string, string | null>>;
  expect(records).toHaveLength(12);
  // D3: no product the rows name is in the answer.
  const wire = JSON.stringify(structure);
  for (const product of records.map((record) => String(record.product))) {
    expect(product.length).toBeGreaterThan(3);
    expect(wire, `the detection quotes no cell (${product})`).not.toContain(product);
  }
});

test("member-directory: the largest list is all 240 rows, past the menus and the filter options", async ({ openHarness, page }) => {
  const harness = await openHarness("member-directory");
  const structure = await detected(harness);

  const rows = await page.locator('[data-testid="member-rows"] > tr[data-member-id]').count();
  expect(rows).toBe(240);
  expect(structure.proposal.itemCount).toBe(rows);
  expect(await page.locator(structure.proposal.item).count()).toBe(rows);
  expect(structure.proposal.fields.map((field) => field.spec.header)).toEqual(expect.arrayContaining(["Member", "Role", "Team", "Status"]));

  // D3: no member's address is in the answer.
  const text = (await page.locator('[data-testid="member-rows"]').innerText());
  const emails = [...text.matchAll(/[\w.+-]+@[\w.-]+/gu)].map((match) => match[0]).slice(0, 20);
  expect(emails.length).toBeGreaterThan(0);
  const wire = JSON.stringify(structure);
  for (const email of emails) expect(wire).not.toContain(email);
  expect(wire).not.toContain("@");
});

test("infinite-feed: a declared feed is reported as infinite scroll, and scrolling reads it to its end", async ({ openHarness }) => {
  const harness = await openHarness("infinite-feed");
  const structure = await detected(harness);

  expect(structure.proposal.item).toBe('[data-testid="feed-item"]');
  expect(structure.proposal.itemCount).toBe(10);
  expect(structure.proposal.pagination).toBeUndefined();
  expect(structure.infiniteScroll).toBe(true);

  // What the domain keeps for a declared feed: a scroll bounded by the page bound, which the reader stops short of at the end.
  const reply = await harness.runAction({
    commandId: "extract-detected-feed",
    actionType: "web.dom.extract_list",
    extractList: requestFrom(structure, { mode: "scroll", maxScrolls: 50 })
  });
  expect(reply).toMatchObject({ status: "succeeded", extraction: { recordCount: 60, truncated: false } });
});

test("infinite-feed: with a Load more button the feed pages by the button, not by scrolling", async ({ openHarness }) => {
  const harness = await openHarness("infinite-feed");
  await armVariant(harness, "set-mode", { mode: "load-more" });
  const structure = await detected(harness);

  expect(structure.proposal.pagination).toMatchObject({ mode: "loadMore", control: '[data-testid="load-more"]' });
  expect(structure.infiniteScroll).toBeUndefined();
});

test("basic-form: a form's labels and inputs are not a list, and a snapshot not asked to detect answers nothing", async ({ openHarness }) => {
  const harness = await openHarness("basic-form");
  expect(await detect(harness)).toEqual({ ok: false, refused: "no_repeating_run" });

  const plain = await harness.runAction({ commandId: "plain-capture", actionType: "web.dom.capture_snapshot" });
  expect(plain.status).toBe("succeeded");
  expect(plain.structure).toBeUndefined();
});

test("basic-form: sensitive controls are refused, excluded, and never quoted", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");

  // Rows of nothing but a password: nothing in them may be read.
  await injectCredentialRows(page, INJECTED_SECRET, true);
  expect(await detect(harness)).toEqual({ ok: false, refused: "sensitive_region" });
  expect(await detect(harness, '[data-testid="credential-row"]')).toEqual({ ok: false, refused: "sensitive_region" });
  expect(await detect(harness, '[data-testid="credential-secret"]')).toEqual({ ok: false, refused: "sensitive_region" });

  // Rows with a label beside the password: detected, with the password excluded (D12).
  await page.evaluate(() => document.querySelector('[data-testid="credential-list"]')?.remove());
  await injectCredentialRows(page, INJECTED_SECRET, false);
  const structure = await detected(harness, '[data-testid="credential-label"]');
  expect(structure.proposal.item).toBe('[data-testid="credential-row"]');
  const secret = structure.proposal.fields.find((field) => field.key === "credential-secret");
  expect(secret?.spec).toMatchObject({ kind: "value", handling: "exclude" });

  expect(JSON.stringify(structure)).not.toContain(INJECTED_SECRET);
  expect(JSON.stringify(await harness.messages())).not.toContain(INJECTED_SECRET);
});

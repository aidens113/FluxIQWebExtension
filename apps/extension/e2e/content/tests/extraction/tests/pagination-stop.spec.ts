// Why a paginated `web.dom.extract_list` stopped paging, for the stops a page
// can show without loading a new document (the ones that load one are
// `job-board-listing.spec.ts`).
//
// Each row runs a read that asks for five pages on a realistic page whose way
// forward goes nowhere new, and checks the one closed word the read reports as
// `paginationStop` and the phrase the model reads in the result's `actual`:
// - the company website's VAT switch, named as the read's next control: its
//   other option redraws the same price list (`page_repeated`), and the option
//   already chosen is a press the page ignores (`list_unchanged`);
// - the everything store's last results page draws Next as a disabled span
//   (`control_disabled`).
//
// The cross-border marketplace's "Next ›", a `div` whose handler throws, is not
// a `list_unchanged` page: a script's Next is swapped for the pager's following
// page (`page-advance/follow-next.ts`), and that is a link to page 2.

import { PRICE_LIST } from "../../../../../../scenario-lab/src/scenarios/company-website/data/index.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** A service row of the open "Servicing & safety checks" table; a partner advert's name cell carries a "Sponsored" tag. */
const SERVICE_ROW = '[data-category="servicing"] tbody tr:not(:has(th span))';
/** The servicing services by name, partner adverts left out, in page order. */
const SERVICES = (PRICE_LIST.find(({ id }) => id === "servicing")?.rows ?? []).filter((row) => !row.partner).map((row) => ({ service: row.name }));

/** One site operation, as the page's own scripts send it. */
async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

/** "Services & prices" with consent answered and the timed prompts dismissed, as a returning visitor sees it. */
async function openServices(harness: ContentHarness): Promise<void> {
  await apply(harness, "set-consent", { choice: "essential" });
  await apply(harness, "dismiss-newsletter");
  await apply(harness, "dismiss-chat-greeting");
  await harness.page.goto(new URL("/scenarios/company-website/services", harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

test("a control that redraws the list it was on stops the read on page_repeated rather than reading it again", async ({ openHarness }) => {
  test.setTimeout(60_000);
  const harness = await openHarness("company-website");
  await openServices(harness);
  // The "ex. VAT" option re-fetches the price list and draws every table again:
  // the same services as new elements, which is all a read of their names sees.
  const reply = await harness.runAction({
    commandId: "extract-same-page",
    actionType: "web.dom.extract_list",
    timeoutMs: 30_000,
    extractList: { item: SERVICE_ROW, fields: { service: "column:Service" }, paginate: { next: '[data-basis="ex"]', maxPages: 5 } }
  });
  expect(reply).toMatchObject({ status: "succeeded", extraction: { recordCount: SERVICES.length, pagesRead: 2, truncated: false, paginationStop: "page_repeated" } });
  expect(reply.validation).toMatchObject({ actual: expect.stringContaining("paging stopped because the page the control led to held only records earlier pages already had") });
  expect(reply.extracted).toEqual(SERVICES);
});

test("a disabled Next is the list ending, said as control_disabled, without pressing it", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  // The earbud search's fifth and last page, past the store's browser check,
  // which the session's first search meets (as `everything-store-next-page.spec.ts` passes it).
  const url = new URL("/scenarios/everything-store/s?k=wireless+earbuds&page=5", harness.lab.origin).href;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto(url, { waitUntil: "load" }).catch(() => undefined);
    if (!(await page.locator("[data-continue]").count().catch(() => 1))) break;
    await page.waitForTimeout(1_700);
    await page.locator("[data-continue]").click().catch(() => undefined);
    await page.waitForTimeout(2_000);
  }
  const next = 'nav[aria-label="pagination"] > :last-child';
  await expect(page.locator(next)).toHaveAttribute("aria-disabled", "true");
  await page.waitForTimeout(1_500);
  const startedAt = Date.now();
  const reply = await harness.runAction({
    commandId: "extract-disabled-next",
    actionType: "web.dom.extract_list",
    timeoutMs: 30_000,
    extractList: { item: '[data-component="search-result"][data-sku]', fields: { title: "h2" }, paginate: { next, maxPages: 5 } }
  });
  expect(reply).toMatchObject({ status: "succeeded", extraction: { pagesRead: 1, truncated: false, paginationStop: "control_disabled" } });
  expect(reply.extraction?.recordCount ?? 0).toBeGreaterThan(0);
  // A disabled control used to be pressed and waited on for the page's whole change window.
  expect(Date.now() - startedAt).toBeLessThan(8_000);
  expect(new URL(page.url()).searchParams.get("page")).toBe("5");
});

test("a Next the page ignores ends the read with its rows and list_unchanged", async ({ openHarness }) => {
  test.setTimeout(60_000);
  const harness = await openHarness("company-website");
  await openServices(harness);
  // The option already chosen: the switch's handler returns on a press of the
  // active basis, so pressing it changes nothing on the page.
  const reply = await harness.runAction({
    commandId: "extract-ignored-next",
    actionType: "web.dom.extract_list",
    timeoutMs: 30_000,
    extractList: { item: SERVICE_ROW, fields: { service: "column:Service" }, paginate: { next: '[data-basis="inc"]', maxPages: 5 } }
  });
  expect(reply).toMatchObject({ status: "succeeded", extraction: { recordCount: SERVICES.length, pagesRead: 1, paginationStop: "list_unchanged" } });
  expect(reply.extracted).toEqual(SERVICES);
  expect(reply.validation).toMatchObject({ actual: expect.stringContaining("the page ignored its pagination control") });
});

// `web.dom.next_page` against the everything store's search results, as a Flow
// that reads every page runs it: read the page, then Next page, again and
// again, until Next page answers that the list has ended (contract C1, design
// 4.2 of the read-list redesign).
//
// The store is the page that taught the read its pager rules, and these rows
// hold them for the step that now carries them:
// - from page two the store's Next leads back to page two, so the step must
//   follow the pager's page three instead (`by: "following"`), or a loop over
//   it would read page two until its bound;
// - on page five Next is a disabled span, so the step must answer `ended`
//   with `control_disabled` and press nothing, which is what ends the loop
//   without the recovery ladder;
// - every Next is a link, so each press loads a new document. The harness
//   talks to the page's own script, which that load destroys, so this spec
//   plays the worker's part (`runtime/extract-list-continuation.ts`): when the
//   reply is lost it waits for the new document and sends the same command
//   with a mark, asking whether the list arrived. The mark the page sent died
//   with its document, so the spec's says `next`; which page was reached is
//   read off the address instead.
//
// The store refuses a sixth results page in eight seconds, so the spec spaces
// its presses as the worker's page-load pace would.

import type {
  WebAutomationExtractField,
  WebAutomationExtractListRequest,
  WebAutomationStructureDetection
} from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** The earbud search, which the store spreads over five results pages. */
const SEARCH = "/scenarios/everything-store/s?k=wireless+earbuds";
/** The token the spec's stand-in worker sends its continuations under. */
const TOKEN = "next-page-spec";
/** What the worker's pace would space the store's results pages by: five in eight seconds is its limit. */
const PACE_MS = 2_000;

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;

/** Opens the search, passing the store's browser check when it stands (as `everything-store-extraction.spec.ts` does). */
async function openSearch(harness: ContentHarness): Promise<void> {
  const url = new URL(SEARCH, harness.lab.origin).href;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await harness.page.goto(url, { waitUntil: "load" }).catch(() => undefined);
    const blocked = await harness.page.locator("[data-continue]").count().catch(() => 1);
    if (!blocked) return;
    await harness.page.waitForTimeout(1_700);
    await harness.page.locator("[data-continue]").click().catch(() => undefined);
    await harness.page.waitForTimeout(2_000);
  }
  throw new Error("The store kept answering with its browser check.");
}

async function detect(harness: ContentHarness): Promise<Detected> {
  const reply = await harness.runAction({ commandId: `detect-${Date.now()}`, actionType: "web.dom.capture_snapshot", detectStructure: {} });
  const structure = reply.structure as WebAutomationStructureDetection;
  expect(structure.ok, `a structure was detected: ${JSON.stringify(structure)}`).toBe(true);
  if (!structure.ok) throw new Error("No structure detected.");
  return structure;
}

/** The detection as a read of the one page it is on, which is what a read in a Flow's page loop is. */
function readOf(structure: Detected): WebAutomationExtractListRequest {
  const fields = structure.proposal.fields.filter((field) => field.spec.handling !== "exclude");
  return {
    item: structure.proposal.item,
    fields: Object.fromEntries(fields.map((field) => [field.key, field.spec as WebAutomationExtractField]))
  };
}

/** The results page the address names; the first page's names none. */
function pageOf(url: string): number {
  return Number(new URL(url).searchParams.get("page") ?? "1");
}

/**
 * Presses Next page as the worker sends it: with a token, so the press is
 * marked; and when the press took the document away, once more in the new
 * document with a mark, which asks whether the list arrived and presses nothing.
 */
async function nextPage(harness: ContentHarness, item: string, step: number): Promise<BrowserActionResult> {
  const action: BrowserActionCommand = { commandId: `next-page-${step}`, actionType: "web.dom.next_page", timeoutMs: 30_000, nextPage: { item } };
  const sent = await harness.deliver({ type: "executeAction", topFrameOnly: true, extraction: { token: TOKEN }, action }).catch(() => undefined);
  if (sent?.responded) return sent.response as BrowserActionResult;
  await harness.page.waitForLoadState("load");
  const asked = await harness.deliver({ type: "executeAction", topFrameOnly: true, extraction: { token: TOKEN, resume: { by: "next" } }, action });
  expect(asked.responded, "the document the press loaded answered for it").toBe(true);
  return asked.response as BrowserActionResult;
}

test("a read and Next page go through all five results pages, and Next page ends on the last without pressing", async ({ openHarness, page }) => {
  test.setTimeout(240_000);
  const harness = await openHarness("everything-store");
  await openSearch(harness);
  await page.waitForTimeout(1_500);
  const read = readOf(await detect(harness));

  const pagesRead: number[] = [];
  let last: BrowserActionResult | undefined;
  for (let step = 1; step <= 6; step += 1) {
    const rows = await harness.runAction({ commandId: `read-${step}`, actionType: "web.dom.extract_list", extractList: read });
    expect(rows.status, JSON.stringify(rows.validation)).toBe("succeeded");
    expect(rows.extraction?.recordCount ?? 0, `page ${pageOf(page.url())} showed its results`).toBeGreaterThan(0);
    pagesRead.push(pageOf(page.url()));

    await page.waitForTimeout(PACE_MS);
    last = await nextPage(harness, read.item, step);
    if (last.nextPage?.outcome !== "moved") break;
    expect(last.status, JSON.stringify(last.validation)).toBe("succeeded");
    expect(last.route).toBeUndefined();
  }

  // Page two's Next leads back to page two; the step went to page three instead.
  expect(pagesRead).toEqual([1, 2, 3, 4, 5]);
  // Page five's Next is a disabled span: the list ended, which succeeds down the `ended` route.
  expect(last).toMatchObject({ status: "succeeded", route: "ended", nextPage: { outcome: "ended", stop: "control_disabled" } });
  expect(pageOf(page.url()), "nothing was pressed on the last page").toBe(5);
});

test("from page two the step follows the pager's page three rather than the Next that leads back",async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await openSearch(harness);
  await page.waitForTimeout(1_500);
  const { item } = readOf(await detect(harness));
  await page.goto(new URL(`${SEARCH}&page=2`, harness.lab.origin).href, { waitUntil: "load" });
  await page.waitForTimeout(PACE_MS);

  // The page's own answer before the press took it away is lost with it, so
  // the press is checked by where it went; a step that followed Next would
  // have reloaded page two.
  await nextPage(harness, item, 1);
  expect(pageOf(page.url())).toBe(3);
});

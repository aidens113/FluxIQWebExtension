// Structure detection and `web.dom.extract_list` on the everything store's
// cart, in the state its `add-to-cart` task leaves it: two Sage Green 1.7 L
// kettles and the batteries in the cart, the phone case moved to Saved for
// later beside the two items already saved there.
//
// "What is in my cart, as a table" is the most ordinary extraction there is,
// and until 2026-09-28 it could not be detected at all
// (`docs/working/language-driven-flow-loop-plan/reports/cart-extraction.md`):
// - the cart holds two lines, and a run needed three siblings, so every
//   element of the page -- the lines themselves included -- was refused
//   `no_repeating_run`. A live build aimed the detection at the cart a dozen
//   times, was refused every time, and produced no Flow
//   (`run-mulum3x7-18ceeb75`);
// - page-wide, the answer was the four "Delete | Save for later | Compare |
//   Share" links inside one line, and once pairs counted, Saved for later's
//   three items -- a list, but not the one asked about.
//
// These rows pin the fix: a record pair is a run, a target is where the search
// starts rather than the only place it looks, and the list holding the most
// data outranks the one with the most items. The oracle is the fixture's own
// expected records, not this file.

import type {
  WebAutomationExtractField,
  WebAutomationExtractListRequest,
  WebAutomationStructureDetection
} from "@fluxiq-web-extension/domain/client";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import { HOUSEHOLD, TIDEWELL_KETTLES } from "../../../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { ADD_TO_CART_WORKFLOW } from "../../../../../../scenario-lab/src/scenarios/everything-store/workflows/index.js";

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;

const SAGE = TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Sage Green" && child.variant.capacity === "1.7 L");
/** The fixture's own expected records: item, quantity and price per cart line. */
const EXPECTED = ADD_TO_CART_WORKFLOW.expected.extracted?.[0]?.records ?? [];
const ACTIVE_LINES = '[data-name="Active Items"] [data-line]';

/**
 * The task's end state, through the store's own operations -- the ones the
 * product page's Add to Cart and the cart's Save for later send. Save for later
 * fails its first request of a session by design, so it is sent twice, as the
 * recording retries it.
 */
async function leaveCartAsTheTaskDoes(harness: ContentHarness): Promise<string> {
  if (!SAGE) throw new Error("The Tidewell family has no Sage Green 1.7 L child");
  const send = async (operation: string, payload: Record<string, unknown>): Promise<void> => {
    const response = await fetch(`${harness.lab.origin}/api/everything-store/${operation}`, {
      method: "POST",
      headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    expect(response.ok, `the store accepted ${operation}`).toBe(true);
  };
  await send("add-to-cart", { sku: SAGE.sku, quantity: 2 });
  await send("save-for-later", { lineId: "L2" });
  await send("save-for-later", { lineId: "L2" });
  await harness.page.goto(new URL("/scenarios/everything-store/cart", harness.lab.origin).href, { waitUntil: "load" });

  // The state these rows are about, read off the page rather than assumed.
  const skus = await harness.page.evaluate((selector) => Array.from(document.querySelectorAll(selector)).map((line) => line.getAttribute("data-sku")), ACTIVE_LINES);
  expect(skus, "the cart holds the kettles and the batteries, newest first").toEqual([SAGE.sku, HOUSEHOLD.batteries.sku]);
  await expect(harness.page.locator(`[data-name="Saved Cart Items"] [data-sku="${HOUSEHOLD.phoneCase.sku}"]`)).toHaveCount(1);
  return SAGE.sku;
}

async function detect(harness: ContentHarness, selector?: string): Promise<Detected> {
  const reply = await harness.runAction({
    commandId: `detect-${selector ?? "page"}`,
    actionType: "web.dom.capture_snapshot",
    detectStructure: selector === undefined ? {} : { selector }
  });
  const structure = reply.structure as WebAutomationStructureDetection;
  expect(structure.ok, `a list was detected from ${selector ?? "the page"}: ${JSON.stringify(structure)}`).toBe(true);
  if (!structure.ok) throw new Error("No structure detected.");
  return structure;
}

/** The detection as the request its handle stands for, with no field chosen by hand: the minimal-parameter read. */
function requestFrom(structure: Detected): WebAutomationExtractListRequest {
  const fields = structure.proposal.fields.filter((field) => field.spec.handling !== "exclude");
  return { item: structure.proposal.item, fields: Object.fromEntries(fields.map((field) => [field.key, field.spec as WebAutomationExtractField])) };
}

test("the fixture's own expectation is two rows, and its recorded read gives exactly them", async ({ openHarness }) => {
  test.setTimeout(90_000);
  expect(EXPECTED).toHaveLength(2);
  const harness = await openHarness("everything-store");
  await leaveCartAsTheTaskDoes(harness);
  const read = await harness.runAction({
    commandId: "extract-recorded",
    actionType: "web.dom.extract_list",
    extractList: { item: ACTIVE_LINES, fields: { item: 'a[href*="/dp/"] > span', quantity: '[aria-live="polite"]', price: ":scope > p > span" } }
  });
  expect(read.status, JSON.stringify(read.validation)).toBe("succeeded");
  expect(read.extracted).toEqual(EXPECTED);
});

test("the cart's two lines are the list: detected page-wide and from any element of the cart, and read as the expected rows", async ({ openHarness }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  const kettle = await leaveCartAsTheTaskDoes(harness);

  const pageWide = await detect(harness);
  expect(pageWide.proposal.itemCount, "the cart's lines, not Saved for later's three items nor a line's four action links").toBe(2);
  const exact = await harness.page.evaluate(([item, active]) => {
    const detected = Array.from(document.querySelectorAll(item));
    const wanted = Array.from(document.querySelectorAll(active));
    return detected.length === wanted.length && detected.every((element, index) => element === wanted[index]);
  }, [pageWide.proposal.item, ACTIVE_LINES] as const);
  expect(exact, "the detected items are exactly the cart's active lines").toBe(true);

  // Wherever a model aims inside the cart -- a line, its title, its quantity,
  // one of its action links, the heading, the subtotal, the checkout button --
  // the answer is the same list. Aimed at an element with no list around it,
  // the detection used to refuse; now it looks outward.
  const targets = [
    ACTIVE_LINES,
    `${ACTIVE_LINES} a[href*="/dp/"] > span`,
    `[data-sku="${kettle}"] [aria-live="polite"]`,
    `[data-name="Active Items"] [data-sku="${kettle}"] [data-action="save-for-later"]`,
    '[data-name="Active Items"] h1',
    '[data-testid="cart-subtotal"]',
    '[data-action="proceed"]'
  ];
  for (const target of targets) {
    expect((await detect(harness, target)).proposal.item, `aimed at ${target}`).toBe(pageWide.proposal.item);
  }

  // And the proposal reads, as it stands, into the expected rows: nothing
  // chosen by hand, every expected value in its own record, in cart order.
  const read = await harness.runAction({ commandId: "extract-detected", actionType: "web.dom.extract_list", extractList: requestFrom(pageWide) });
  expect(read.status, JSON.stringify(read.validation)).toBe("succeeded");
  const records = (read.extracted ?? []) as ReadonlyArray<Record<string, unknown>>;
  expect(records).toHaveLength(EXPECTED.length);
  EXPECTED.forEach((expected, index) => {
    const values = Object.values(records[index] ?? {}).filter((value): value is string => typeof value === "string").map((value) => value.trim());
    for (const [column, value] of Object.entries(expected)) {
      expect(typeof value === "string" && values.includes(value), `row ${index + 1} carries its ${column} ${JSON.stringify(value)}: ${JSON.stringify(values)}`).toBe(true);
    }
  });
});

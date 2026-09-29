// What a detected cart line's columns are called, and whether a model choosing
// "quantity" and "price" among them could choose right.
//
// Live build `lane-run-mum06sfc-f1d9403f` (round 2, everything store) read the
// cart with `quantity` = `"on"` and `price` = `"1"` on every row. A cart line
// carries a select checkbox, a quantity stepper whose number is a text leaf, and
// a price text. The detection offered the checkbox as the line's only `value`
// column, and HTML reads an unvalued checkbox as the constant `"on"`. Every
// column was labelled by its path through hashed class names, so the quantity
// and the price were two text columns nothing told apart. The model is shown a
// column's label, kind and coverage and nothing else (D3).
//
// These rows pin what the model is now shown. A checkbox with no `value` is not
// a column. The quantity's column says `number` and the price's says
// `currency amount`. Each label still carries no value read off the page.

import type { WebAutomationExtractField, WebAutomationStructureDetection } from "@fluxiq-web-extension/domain/client";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;

const ACTIVE_LINES = '[data-name="Active Items"] [data-line]';
/** Where the fixture's own recorded read finds each line's quantity and price (`everything-store-cart.spec.ts`). */
const QUANTITY = '[aria-live="polite"]';
const PRICE = ":scope > p > span";

async function openCart(harness: ContentHarness): Promise<void> {
  await harness.page.goto(new URL("/scenarios/everything-store/cart", harness.lab.origin).href, { waitUntil: "load" });
  await expect(harness.page.locator(ACTIVE_LINES).first()).toBeVisible();
}

async function detect(harness: ContentHarness): Promise<Detected> {
  const reply = await harness.runAction({ commandId: "detect-cart", actionType: "web.dom.capture_snapshot", detectStructure: {} });
  const structure = reply.structure as WebAutomationStructureDetection;
  expect(structure.ok, `a list was detected: ${JSON.stringify(structure)}`).toBe(true);
  if (!structure.ok) throw new Error("No structure detected.");
  return structure;
}

type Bound = { key: string; label: string; kind: string; checkbox: boolean; quantity: boolean; price: boolean };

/** What each proposed field's element is on every line: a checkbox, the quantity, the price, or none of those. */
async function boundElements(harness: ContentHarness, structure: Detected): Promise<Bound[]> {
  const fields = structure.proposal.fields
    .filter((field) => field.spec.handling !== "exclude")
    .map((field) => ({ key: field.key, label: field.label, kind: field.spec.kind, selector: field.spec.selector }));
  return harness.page.evaluate(([item, all, quantity, price]) => {
    const lines = Array.from(document.querySelectorAll(item));
    return all.map((field) => {
      const elements = lines.map((line) => (field.selector ? line.querySelector(field.selector) : line));
      const every = (test: (element: Element | null, line: Element) => boolean) => lines.length > 0 && lines.every((line, index) => test(elements[index] ?? null, line));
      return {
        key: field.key,
        label: field.label,
        kind: field.kind,
        checkbox: elements.some((element) => element instanceof HTMLInputElement && element.type === "checkbox"),
        quantity: every((element, line) => element !== null && element === line.querySelector(quantity)),
        price: every((element, line) => element !== null && element === line.querySelector(price))
      };
    });
  }, [structure.proposal.item, fields, QUANTITY, PRICE] as const);
}

test("a cart line's columns say what they hold: no unvalued checkbox is a column, and the quantity and the price are told apart", async ({ openHarness }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("everything-store");
  await openCart(harness);
  const structure = await detect(harness);
  expect(structure.proposal.itemCount, "the cart's active lines").toBe(await harness.page.locator(ACTIVE_LINES).count());

  const bound = await boundElements(harness, structure);
  const shown = JSON.stringify(bound.map(({ label, kind }) => `${kind}: ${label}`));
  expect(bound.filter((field) => field.checkbox), `no column reads the select checkbox, whose value is the constant "on": ${shown}`).toEqual([]);

  const quantity = bound.filter((field) => field.quantity);
  const price = bound.filter((field) => field.price);
  expect(quantity, `one column reads the quantity: ${shown}`).toHaveLength(1);
  expect(price, `one column reads the price: ${shown}`).toHaveLength(1);
  expect(quantity[0]!.label, "the quantity's column says it holds a number").toMatch(/\(number\)$/u);
  expect(price[0]!.label, "the price's column says it holds a currency amount").toMatch(/\(currency amount\)$/u);
  expect(bound.filter((field) => field.label.endsWith("(currency amount)")).map((field) => field.key), "only the price is offered as a currency amount").toEqual([price[0]!.key]);

  // The labels are the only thing that changed: the proposal still reads each
  // line's quantity and price under those columns, as the page shows them.
  const specOf = (key: string): WebAutomationExtractField => structure.proposal.fields.find((field) => field.key === key)!.spec as WebAutomationExtractField;
  const read = await harness.runAction({
    commandId: "extract-cart",
    actionType: "web.dom.extract_list",
    extractList: { item: structure.proposal.item, fields: { quantity: specOf(quantity[0]!.key), price: specOf(price[0]!.key) } }
  });
  expect(read.status, JSON.stringify(read.validation)).toBe("succeeded");
  const shownOnPage = await harness.page.evaluate(([item, quantitySelector, priceSelector]) => Array.from(document.querySelectorAll(item)).map((line) => ({
    quantity: (line.querySelector(quantitySelector)?.textContent ?? "").trim(),
    price: (line.querySelector(priceSelector)?.textContent ?? "").trim()
  })), [structure.proposal.item, QUANTITY, PRICE] as const);
  expect(read.extracted).toEqual(shownOnPage);
});

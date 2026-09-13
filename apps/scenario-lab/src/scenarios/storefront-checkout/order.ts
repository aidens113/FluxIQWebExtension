/**
 * The store's fixed catalogue, delivery tariff and address book. Nothing here
 * depends on the seed or the clock: a checkout that priced itself differently
 * on two loads would make every total assertion a coin toss.
 *
 * Money is whole cents everywhere and is formatted once, on the way into the
 * markup, so no page string is ever the source of a rounding difference.
 */
export const storefrontOrder = {
  store: { name: "Northlake Outfitters", tagline: "Trail gear, Portland OR" },
  items: [
    { sku: "NLO-KP32-SLT", name: "Kestrel 32L Trail Pack", option: "Slate", quantity: 1, unitCents: 18_900 },
    { sku: "NLO-RMBL-CHR", name: "Ridgeline Merino Base Layer", option: "Charcoal / M", quantity: 2, unitCents: 7_400 },
    { sku: "NLO-BB75-STL", name: "Basalt 750ml Insulated Bottle", option: "Steel", quantity: 1, unitCents: 3_200 },
  ],
  /** The one code the store honours, and the fraction of the item subtotal it takes off. */
  promotion: { code: "TRAIL10", percentOff: 10 },
  deliveryOptions: [
    { id: "standard", testId: "delivery-standard", label: "Standard shipping", detail: "4-6 business days", costCents: 0, estimate: "Arrives Mon 22 Sep - Wed 24 Sep" },
    { id: "express", testId: "delivery-express", label: "Express shipping", detail: "2 business days", costCents: 1_200, estimate: "Arrives Tue 16 Sep, order within 3 hours" },
    { id: "priority", testId: "delivery-priority", label: "Priority overnight", detail: "Next business day", costCents: 2_400, estimate: "Arrives Mon 15 Sep before 12:00" },
  ],
  /**
   * What the postcode lookup answers with. A postcode outside the book
   * returns nothing, which is a real lookup's ordinary outcome and the reason
   * the page has a "no matches" branch at all.
   */
  addressBook: {
    "97205": [
      { id: "addr-9581", line1: "1120 SW Alder St", line2: "Apt 4B", city: "Portland", region: "OR" },
      { id: "addr-9582", line1: "1120 SW Alder St", line2: "Apt 12C", city: "Portland", region: "OR" },
      { id: "addr-9583", line1: "925 SW 10th Ave", line2: "Suite 300", city: "Portland", region: "OR" },
    ],
    "97214": [
      { id: "addr-4410", line1: "3040 SE Division St", line2: "", city: "Portland", region: "OR" },
      { id: "addr-4411", line1: "3040 SE Division St", line2: "Unit B", city: "Portland", region: "OR" },
    ],
  },
} as const;

export type DeliveryOptionId = (typeof storefrontOrder.deliveryOptions)[number]["id"];

/**
 * `1234` becomes `$12.34`; the only place cents become a string. The grouping
 * is written out rather than delegated to `toLocaleString`, whose output
 * depends on the host's ICU data -- a page whose totals read differently on
 * two machines cannot be asserted on.
 */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(Math.round(cents));
  const dollars = String(Math.floor(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${sign}$${dollars}.${String(absolute % 100).padStart(2, "0")}`;
}

/**
 * The one spelling of a postal address on this page. The server renders the
 * suggestion list with it, and the client rebuilds that list with the same
 * strings after a lookup, so a reload can never reword an address the shopper
 * already chose.
 */
export function formatAddress(entry: { line1: string; line2: string; city: string; region: string }, postcode: string): string {
  return [entry.line1, entry.line2, `${entry.city}, ${entry.region} ${postcode}`].filter(part => part !== "").join(", ");
}

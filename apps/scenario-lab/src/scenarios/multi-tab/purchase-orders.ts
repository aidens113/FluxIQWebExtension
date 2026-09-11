/** One purchase order: a row on the list page and the record its details tab shows. */
export type PurchaseOrder = {
  order: string;
  supplier: string;
  status: string;
  buyer: string;
  delivery: string;
  total: string;
};

// Order numbers are fixed so step targets and tab paths are the same for
// every seed; only the content of each order varies with the seed.
const ORDER_NUMBERS = ["PO-4471", "PO-4472", "PO-4473", "PO-4474"] as const;
const SUPPLIERS = ["Northwind Traders", "Contoso Components", "Fabrikam Industrial", "Tailspin Freight", "Litware Office Supply", "Adatum Lab Goods"];
const STATUSES = ["Awaiting approval", "Approved", "Shipped", "Partially received"];
const BUYERS = ["M. Okafor", "J. Lindqvist", "R. Tanaka", "S. Moreau", "A. Haddad"];
/** Delivery dates count from this fixed day, never from the clock. */
const DELIVERY_BASE_UTC = Date.UTC(2026, 9, 1);
const DAY_MS = 86_400_000;

/** The four orders the fixture shows for `seed`, drawn from a seeded generator (no `Math.random`). */
export function purchaseOrdersFor(seed: number): PurchaseOrder[] {
  const next = seededGenerator(seed);
  const draw = (size: number) => Math.floor(next() * size);
  const suppliers = [...SUPPLIERS];
  for (let index = suppliers.length - 1; index > 0; index -= 1) {
    const swap = draw(index + 1);
    [suppliers[index], suppliers[swap]] = [suppliers[swap]!, suppliers[index]!];
  }
  return ORDER_NUMBERS.map((order, index) => ({
    order,
    supplier: suppliers[index]!,
    status: STATUSES[draw(STATUSES.length)]!,
    buyer: BUYERS[draw(BUYERS.length)]!,
    delivery: new Date(DELIVERY_BASE_UTC + draw(60) * DAY_MS).toISOString().slice(0, 10),
    total: formatDollars(12_000 + draw(980_000)),
  }));
}

/** mulberry32: a small, well-distributed 32-bit generator, identical in every runtime for a given seed. */
function seededGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** US-dollar text without `Intl`, so the rendering does not depend on the host's locale data. */
function formatDollars(cents: number): string {
  const whole = Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${whole}.${String(cents % 100).padStart(2, "0")}`;
}

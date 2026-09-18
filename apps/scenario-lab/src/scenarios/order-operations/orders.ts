import { shiftDay } from "./format.js";
import type { CustomerOrder, DeliveryAddress, FulfilmentState, OrderLine, PaymentState } from "./types.js";

/** How many orders the book holds. Large enough that the table, not the shell, is the page. */
export const ORDER_BOOK_SIZE = 280;
/** How many it holds after a short trading period, which is all the `quiet-week` rendering changes. */
export const QUIET_WEEK_SIZE = 60;

/** The first day of the trading period the book covers. Every placed date is this day plus an offset. */
export const TRADING_START = "2026-02-02";
/** How many days the book spans. */
const TRADING_DAYS = 54;

// Twenty given names and fourteen family names, both in alphabetical order, so
// the book is exactly 280 customers and no two share a name. Nothing here
// depends on the lab seed: a manifest's expected records are literal text, so
// the book must read the same on every run. Every address is invented, in a
// town that does not exist, and every mail domain ends in `.test`.
const GIVEN_NAMES = [
  "Ada", "Bede", "Caris", "Dermot", "Elke", "Fionn", "Gwen", "Halvard", "Isolde", "Jarek",
  "Katri", "Lior", "Maud", "Nadia", "Orson", "Petra", "Quill", "Rune", "Saoirse", "Teodor",
] as const;
const FAMILY_NAMES = [
  "Ainsworth", "Brenner", "Cadogan", "Delacroix", "Ekstrand", "Fitzgerald", "Guthrie",
  "Halloran", "Iverson", "Joubert", "Kirkbride", "Larsson", "Mirembe", "Norridge",
] as const;
const STREETS = [
  "12 Harrow Mill Lane", "4 Saltbridge Row", "89 Corbett Rise", "31 Netherby Close",
  "7 Maltkiln Yard", "56 Fennimore Walk", "23 Quarryfield Road", "68 Tallowgate",
] as const;
const TOWNS = ["Fenwick Cross", "Ardley Bay", "Stonemoor", "Harlow Vale", "Kestrelby", "Winderlock"] as const;

/** The eighteen things this shop sells, with the price it sells them at. */
const CATALOGUE: ReadonlyArray<{ item: string; sku: string; unitPence: number }> = [
  { item: "Ridgeline hiking sock", sku: "SKU-1104", unitPence: 1_250 },
  { item: "Copperfield kettle", sku: "SKU-1118", unitPence: 6_400 },
  { item: "Ashgrove cutting board", sku: "SKU-1126", unitPence: 3_850 },
  { item: "Lowfell wool blanket", sku: "SKU-1133", unitPence: 8_900 },
  { item: "Harbourlight desk lamp", sku: "SKU-1147", unitPence: 5_200 },
  { item: "Pennard ceramic mug", sku: "SKU-1152", unitPence: 1_450 },
  { item: "Marlow canvas holdall", sku: "SKU-1168", unitPence: 11_500 },
  { item: "Thornbury pepper mill", sku: "SKU-1171", unitPence: 2_950 },
  { item: "Elmsworth picture frame", sku: "SKU-1185", unitPence: 2_200 },
  { item: "Quayside tea caddy", sku: "SKU-1190", unitPence: 1_950 },
  { item: "Stanmore reading light", sku: "SKU-1204", unitPence: 4_600 },
  { item: "Birchall storage crate", sku: "SKU-1213", unitPence: 3_400 },
  { item: "Curlew linen napkin set", sku: "SKU-1227", unitPence: 2_650 },
  { item: "Dunwich stoneware bowl", sku: "SKU-1236", unitPence: 2_400 },
  { item: "Ferndale garden trowel", sku: "SKU-1248", unitPence: 1_750 },
  { item: "Glaisdale enamel jug", sku: "SKU-1255", unitPence: 3_100 },
  { item: "Hollowmere coat hook", sku: "SKU-1263", unitPence: 900 },
  { item: "Inglewood wall clock", sku: "SKU-1274", unitPence: 5_600 },
];

const PAYMENT_CYCLE: readonly PaymentState[] = [
  "Paid", "Paid", "Authorised", "Paid", "Part refunded", "Paid", "Failed", "Paid", "Refunded",
];
const FULFILMENT_CYCLE: readonly FulfilmentState[] = [
  "Unfulfilled", "Picking", "Dispatched", "Delivered", "Unfulfilled", "Dispatched", "Cancelled",
];
/** How many lines an order has, in a repeating pattern: two, three or four. */
const LINE_COUNT_CYCLE = [2, 3, 2, 4, 3, 2] as const;
const QUANTITY_CYCLE = [1, 2, 1, 1, 3, 1, 2] as const;

/** The whole order book, oldest reference first. */
export const customerOrders: readonly CustomerOrder[] = Array.from({ length: ORDER_BOOK_SIZE }, (_unused, index) => order(index));

/** The book a short trading period leaves: the same orders, fewer of them. */
export const quietWeekOrders: readonly CustomerOrder[] = customerOrders.slice(0, QUIET_WEEK_SIZE);

export function orderByReference(orders: readonly CustomerOrder[], reference: string): CustomerOrder | undefined {
  return orders.find((candidate) => candidate.reference === reference);
}

/**
 * The order the refund workflow gives money back against: paid for, and with
 * more than one line, so refunding one line leaves the order part refunded
 * rather than refunded outright.
 */
export const REFUND_ORDER: CustomerOrder = pick(
  (order) => order.payment === "Paid" && order.lines.length > 1,
  "no paid order has more than one line",
);

/** The order the line-item read opens: the longest kind this shop takes, and not the one a refund has already touched. */
export const LINE_ITEM_ORDER: CustomerOrder = pick(
  (order) => order.lines.length === 4 && order.reference !== REFUND_ORDER.reference,
  "no order has four lines",
);

/** The first line of an order, which is the one a partial refund is measured against. */
export function firstLineOf(order: CustomerOrder): OrderLine {
  const [line] = order.lines;
  if (!line) throw new Error(`The order book is wrong: ${order.reference} has no lines`);
  return line;
}

function pick(matches: (order: CustomerOrder) => boolean, reason: string): CustomerOrder {
  const found = customerOrders.find(matches);
  if (!found) throw new Error(`The order book is wrong: ${reason}`);
  return found;
}

function order(index: number): CustomerOrder {
  const given = cycle(GIVEN_NAMES, index);
  const family = FAMILY_NAMES[Math.floor(index / GIVEN_NAMES.length) % FAMILY_NAMES.length] ?? "Ainsworth";
  return {
    reference: `ORD-${40_100 + index * 3}`,
    customer: `${given} ${family}`,
    customerEmail: `${given.toLowerCase()}.${family.toLowerCase()}@postbox.test`,
    placed: shiftDay(TRADING_START, index % TRADING_DAYS),
    payment: cycle(PAYMENT_CYCLE, index),
    fulfilment: cycle(FULFILMENT_CYCLE, index),
    lines: linesFor(index),
    address: addressFor(index),
  };
}

/** Two to four lines, taken from the catalogue in a repeating stride so no order repeats an item. */
function linesFor(index: number): readonly OrderLine[] {
  const count = cycle(LINE_COUNT_CYCLE, index);
  return Array.from({ length: count }, (_unused, position): OrderLine => {
    const product = cycle(CATALOGUE, index * 5 + position * 3);
    return { item: product.item, sku: product.sku, quantity: cycle(QUANTITY_CYCLE, index + position), unitPence: product.unitPence };
  });
}

function addressFor(index: number): DeliveryAddress {
  return {
    line1: cycle(STREETS, index),
    town: cycle(TOWNS, index),
    postcode: `FX${(index % 9) + 1} ${(index % 8) + 1}QR`,
  };
}

function cycle<TValue>(values: readonly TValue[], index: number): TValue {
  const value = values[index % values.length];
  if (value === undefined) throw new Error("An order cycle must not be empty");
  return value;
}

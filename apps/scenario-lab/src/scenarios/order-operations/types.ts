/**
 * The order desk's vocabulary: what an order is, what the book can be filtered
 * to, what a run leaves behind, and the renderings the fixture can be armed
 * into.
 *
 * `baseline` is the desk as it ships. The two armed renderings are each one
 * thing a real deployment does between a recording and a run:
 *
 * - `relabelled-dispatch` -- the dispatch-run shortcut in the page header was
 *   redesigned. It keeps its place and its job and loses everything a recording
 *   wrote down about it: its test id, its class and its label, which becomes
 *   "Pick and pack". Export and New order stay beside it as the pressable wrong
 *   answers.
 * - `quiet-week` -- a short trading period, so the book holds far fewer orders.
 *   Nothing about the page moves; only how many rows a filtered read returns.
 */
export const orderOperationsModes = ["baseline", "relabelled-dispatch", "quiet-week"] as const;

export type OrderOperationsMode = (typeof orderOperationsModes)[number];

/** Where an order's money has got to, as the table and the filters spell it. */
export const paymentStates = ["Paid", "Authorised", "Part refunded", "Refunded", "Failed"] as const;

export type PaymentState = (typeof paymentStates)[number];

/** Where an order's goods have got to. */
export const fulfilmentStates = ["Unfulfilled", "Picking", "Dispatched", "Delivered", "Cancelled"] as const;

export type FulfilmentState = (typeof fulfilmentStates)[number];

/** One line of an order: what was bought, how many, and what it came to. */
export type OrderLine = { item: string; sku: string; quantity: number; unitPence: number };

/** A delivery address. Every one of them is invented, in a town that does not exist. */
export type DeliveryAddress = { line1: string; town: string; postcode: string };

/**
 * One row of the order book. `placed` is the ISO day the order was taken,
 * which is what the date filters compare against; the column shows it the way
 * a person writes a date.
 */
export type CustomerOrder = {
  reference: string;
  customer: string;
  customerEmail: string;
  placed: string;
  payment: PaymentState;
  fulfilment: FulfilmentState;
  lines: readonly OrderLine[];
  address: DeliveryAddress;
};

/** What the toolbar is asking for. An empty string is "any", as each select's first option is. */
export type OrderFilters = { search: string; payment: string; fulfilment: string; placedFrom: string; placedTo: string };

/**
 * What the run left behind. `refunds`, `dispatched` and `cancelled` are the
 * changes the page reported through `mutate`; `oracle` is the book those
 * changes produce, so a run's final state can be checked without replaying the
 * page's arithmetic.
 */
export type OrderOperationsState = {
  mode: OrderOperationsMode;
  /** Order reference to the pence refunded against it so far. */
  refunds: Record<string, number>;
  /** References dispatched during the run, in the order the page reported them. */
  dispatched: string[];
  cancelled: string[];
  /** Operations the page reported, oldest first, capped. */
  activity: string[];
  oracle: { orderCount: number; awaitingDispatchCount: number; refundedCount: number };
};

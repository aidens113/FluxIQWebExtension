import { fulfilmentStates, paymentStates, type CustomerOrder, type OrderFilters } from "./types.js";

/** One option of an order control: the value the control carries, and the label a person reads. */
export type OrderOption = { value: string; label: string };

export const PAYMENT_OPTIONS: readonly OrderOption[] = [
  { value: "", label: "Any payment state" },
  ...paymentStates.map((state) => ({ value: slug(state), label: state })),
];

export const FULFILMENT_OPTIONS: readonly OrderOption[] = [
  { value: "", label: "Any fulfilment state" },
  ...fulfilmentStates.map((state) => ({ value: slug(state), label: state })),
];

/**
 * What the dispatch-run shortcut in the page header asks for: this week's paid
 * orders that nobody has picked yet. It is a preset rather than a saved view,
 * because that is what a warehouse actually presses on a Monday morning, and
 * because it sets four controls at once -- which is what makes pressing the
 * wrong control in its place so visible in the result.
 */
export const DISPATCH_RUN: OrderFilters = {
  search: "",
  payment: "paid",
  fulfilment: "unfulfilled",
  placedFrom: "2026-03-09",
  placedTo: "2026-03-15",
};

/** The filters the book opens on: the whole trading period, nothing narrowed. */
export function defaultOrderFilters(): OrderFilters {
  return { search: "", payment: "", fulfilment: "", placedFrom: "", placedTo: "" };
}

/** A state as a control value: `Part refunded` becomes `part-refunded`. */
export function slug(label: string): string {
  return label.toLowerCase().replaceAll(" ", "-");
}

/**
 * The rows the toolbar leaves. Search matches a reference, a customer's name or
 * their address; each select matches its label exactly; and the two date boxes
 * bound the day the order was taken, inclusive, ignoring a box left empty. ISO
 * days compare correctly as text, which is why the row carries the day in that
 * form as well as in the one the column shows.
 */
export function filterOrders(orders: readonly CustomerOrder[], filters: OrderFilters): CustomerOrder[] {
  const needle = filters.search.trim().toLowerCase();
  const payment = labelFor(PAYMENT_OPTIONS, filters.payment);
  const fulfilment = labelFor(FULFILMENT_OPTIONS, filters.fulfilment);
  const from = isoDay(filters.placedFrom);
  const to = isoDay(filters.placedTo);
  return orders.filter((order) =>
    (needle === "" || matchesSearch(order, needle))
    && (payment === undefined || order.payment === payment)
    && (fulfilment === undefined || order.fulfilment === fulfilment)
    && (from === undefined || order.placed >= from)
    && (to === undefined || order.placed <= to));
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;

/** A date box's value, or nothing at all when it is empty or half typed. A bound nobody can read is no bound. */
function isoDay(value: string): string | undefined {
  const trimmed = value.trim();
  return ISO_DAY.test(trimmed) ? trimmed : undefined;
}

function matchesSearch(order: CustomerOrder, needle: string): boolean {
  return [order.reference, order.customer, order.customerEmail].some((field) => field.toLowerCase().includes(needle));
}

function labelFor(options: readonly OrderOption[], value: string): string | undefined {
  if (value === "") return undefined;
  return options.find((option) => option.value === value)?.label;
}

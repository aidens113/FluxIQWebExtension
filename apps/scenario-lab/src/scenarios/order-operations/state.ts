import { orderTotalPence } from "./format.js";
import { applyOrderChanges, bookCounts, isDispatchable, isRefundable, ordersFor } from "./ledger.js";
import { orderByReference } from "./orders.js";
import { orderOperationsModes, type OrderOperationsState } from "./types.js";

/** Enough history to see what a run did, and a hard stop so a stuck page cannot grow the snapshot without bound. */
const ACTIVITY_LIMIT = 50;

/** The book as the day starts: nothing refunded, nothing dispatched, the desk unarmed. */
export function createOrderOperationsState(): OrderOperationsState {
  return withOracle({ mode: "baseline", refunds: {}, dispatched: [], cancelled: [], activity: [] });
}

/**
 * `set-mode` arms a rendering and, like every armed fixture here, clears what
 * an earlier run did, so an armed run's oracle is its own and never a stale
 * success from the recording. The three change operations are what the page
 * reports as a person works: money given back against an order, orders handed
 * to the carrier, and an order stopped.
 *
 * Each of them is refused unless the order is actually in a state that allows
 * it, because the desk -- not the page -- is what decides that. A refund
 * against an order nobody paid for, or a dispatch of something already sent,
 * leaves the state alone however the page was driven.
 */
export function mutateOrderOperationsState(state: OrderOperationsState, operation: string, payload: unknown): OrderOperationsState {
  if (!isRecord(payload)) return state;
  if (operation === "set-mode") {
    const mode = orderOperationsModes.find((candidate) => candidate === payload.mode);
    return mode === undefined ? state : withOracle({ mode, refunds: {}, dispatched: [], cancelled: [], activity: [] });
  }
  if (operation === "refund-order") return refundOrder(state, payload);
  if (operation === "dispatch-orders") return dispatchOrders(state, payload);
  if (operation === "cancel-order") {
    const reference = knownReference(state, payload.reference);
    if (reference === undefined || state.cancelled.includes(reference)) return state;
    return withOracle({ ...state, cancelled: [...state.cancelled, reference], activity: append(state.activity, `cancelled ${reference}`) });
  }
  return state;
}

/**
 * Money given back against one order, never more than the order came to. The
 * payment state follows from the running total rather than being set: part of
 * it back reads "Part refunded", all of it reads "Refunded".
 */
function refundOrder(state: OrderOperationsState, payload: Record<string, unknown>): OrderOperationsState {
  const reference = knownReference(state, payload.reference);
  const amount = payload.amountPence;
  if (reference === undefined || typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) return state;
  const order = orderByReference(current(state), reference);
  if (!order || !isRefundable(order)) return state;
  const refunded = Math.min((state.refunds[reference] ?? 0) + amount, orderTotalPence(order));
  return withOracle({
    ...state,
    refunds: { ...state.refunds, [reference]: refunded },
    activity: append(state.activity, `refunded ${reference} ${refunded}`),
  });
}

function dispatchOrders(state: OrderOperationsState, payload: Record<string, unknown>): OrderOperationsState {
  const references = readReferences(payload.references)
    .filter((reference) => {
      const order = orderByReference(current(state), reference);
      return order !== undefined && isDispatchable(order);
    });
  if (references.length === 0) return state;
  return withOracle({
    ...state,
    dispatched: [...state.dispatched, ...references],
    activity: append(state.activity, `dispatched ${references.length}`),
  });
}

/** The book as the run has left it so far, which is what every guard above is judged against. */
function current(state: OrderOperationsState) {
  return applyOrderChanges(ordersFor(state.mode), state.refunds, state.dispatched, state.cancelled);
}

/** The book a rendering would now show, given the run's own changes. */
function withOracle(state: Omit<OrderOperationsState, "oracle">): OrderOperationsState {
  return { ...state, oracle: bookCounts(applyOrderChanges(ordersFor(state.mode), state.refunds, state.dispatched, state.cancelled)) };
}

function knownReference(state: OrderOperationsState, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return orderByReference(ordersFor(state.mode), value)?.reference;
}

function readReferences(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === "string"))] : [];
}

function append(activity: readonly string[], entry: string): string[] {
  return [...activity, entry].slice(-ACTIVITY_LIMIT);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

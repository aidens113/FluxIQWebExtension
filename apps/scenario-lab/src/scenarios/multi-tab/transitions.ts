import type { PurchaseOrder } from "./purchase-orders.js";

/** How a details tab was requested: the new-tab link, the `window.open` control, or a typed URL. */
export type OpenPath = "link" | "window" | "direct";
export type OrderOpen = { order: string; via: OpenPath };

/**
 * The fixture's whole state, and so the `/__control/final-state` oracle:
 * `detailsVisits` is written by the details route, `blockedOpens` by the
 * armed list page, and `reviewedOrders` by the list page's confirmation,
 * which is accepted only for an order whose details were visited.
 */
export type MultiTabState = {
  seed: number;
  orders: PurchaseOrder[];
  popupsBlocked: boolean;
  detailsVisits: OrderOpen[];
  blockedOpens: OrderOpen[];
  reviewedOrders: string[];
};

const OPEN_PATHS: readonly string[] = ["link", "window", "direct"];
const HISTORY_LIMIT = 50;

/**
 * The fixture's `mutate`. `block-popups` arms the `popup-blocked` variant;
 * `record-visit` is the details route's mutation; `record-blocked-open` is
 * sent by the armed list page when it refuses to open a tab or window;
 * `confirm-review` is the list page's confirmation. Anything else, and any
 * payload naming an unknown order, leaves the state unchanged.
 */
export function applyMultiTabOperation(state: MultiTabState, operation: string, payload: unknown): MultiTabState {
  if (operation === "block-popups") return state.popupsBlocked ? state : { ...state, popupsBlocked: true };
  const request = orderOpen(state, payload);
  if (operation === "record-visit" && request) return { ...state, detailsVisits: bounded([...state.detailsVisits, request]) };
  if (operation === "record-blocked-open" && request && state.popupsBlocked && request.via !== "direct") {
    return { ...state, blockedOpens: bounded([...state.blockedOpens, request]) };
  }
  if (operation === "confirm-review") {
    const order = knownOrder(state, payload);
    const visited = order !== undefined && state.detailsVisits.some((visit) => visit.order === order);
    if (order !== undefined && visited && !state.reviewedOrders.includes(order)) return { ...state, reviewedOrders: [...state.reviewedOrders, order] };
  }
  return state;
}

function orderOpen(state: MultiTabState, payload: unknown): OrderOpen | undefined {
  const order = knownOrder(state, payload);
  const via = isRecord(payload) ? payload.via : undefined;
  return order !== undefined && typeof via === "string" && OPEN_PATHS.includes(via) ? { order, via: via as OpenPath } : undefined;
}

function knownOrder(state: MultiTabState, payload: unknown): string | undefined {
  const order = isRecord(payload) ? payload.order : undefined;
  return typeof order === "string" && state.orders.some((candidate) => candidate.order === order) ? order : undefined;
}

function bounded<T>(entries: T[]): T[] {
  return entries.slice(-HISTORY_LIMIT);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

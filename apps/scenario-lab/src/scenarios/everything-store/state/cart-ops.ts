import { CATALOG, HOUSEHOLD } from "../catalog/index.js";
import { withActivity } from "./activity.js";
import { linePrice } from "./line-price.js";
import type { CartLine, StoreState } from "./types.js";

const MAX_QUANTITY = 10;

function quantityOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_QUANTITY ? value : undefined;
}

/** Adds to an existing line of the same listing from the same seller, or puts a new line at the top. */
function added(state: StoreState, sku: string, offerId: string | null, quantity: number): StoreState {
  const existing = state.cart.find((line) => line.sku === sku && line.offerId === offerId);
  if (existing) {
    const cart = state.cart.map((line) => line === existing ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + quantity) } : line);
    return { ...state, cart };
  }
  const line: CartLine = { lineId: `L${state.nextLine}`, sku, offerId, quantity, selected: true };
  return { ...state, cart: [line, ...state.cart], nextLine: state.nextLine + 1 };
}

function lineIdOf(value: unknown): string | undefined {
  return typeof value === "string" && /^[LS]\d{1,4}$/u.test(value) ? value : undefined;
}

/**
 * The cart's operations. `add-to-cart` takes the listing, a quantity, an
 * optional marketplace offer and the buy box's protection-plan tick;
 * `add-bundle` is "Add all three to Cart". `save-for-later` fails its first
 * request of a session and changes nothing, which the page shows as a spinner
 * that only a retry clears. Returns `undefined` for an operation that is not
 * the cart's.
 */
export function applyCartOperation(state: StoreState, operation: string, payload: Record<string, unknown>): StoreState | undefined {
  switch (operation) {
    case "add-to-cart": {
      const quantity = quantityOf(payload.quantity);
      const sku = typeof payload.sku === "string" ? payload.sku : "";
      const offerId = typeof payload.offerId === "string" ? payload.offerId : null;
      if (quantity === undefined || linePrice(sku, offerId) === undefined) return state;
      let next = added(state, sku, offerId, quantity);
      if (payload.protection === true && CATALOG.bySku(sku)?.kind === "kettle") next = added(next, HOUSEHOLD.protectionPlan.sku, null, quantity);
      return withActivity(next, `added ${quantity} ${sku}${offerId ? ` from ${offerId}` : ""}`);
    }
    case "add-bundle": {
      const skus = Array.isArray(payload.skus) ? payload.skus.filter((sku): sku is string => typeof sku === "string" && linePrice(sku, null) !== undefined) : [];
      return skus.length === 0 ? state : withActivity(skus.reduce((next, sku) => added(next, sku, null, 1), state), `added bundle of ${skus.length}`);
    }
    case "set-quantity": {
      const lineId = lineIdOf(payload.lineId);
      if (payload.quantity === 0 && lineId) return withActivity({ ...state, cart: state.cart.filter((line) => line.lineId !== lineId) }, `deleted ${lineId}`);
      const quantity = quantityOf(payload.quantity);
      if (!lineId || quantity === undefined) return state;
      return withActivity({ ...state, cart: state.cart.map((line) => line.lineId === lineId ? { ...line, quantity } : line) }, `set ${lineId} to ${quantity}`);
    }
    case "delete-line": {
      const lineId = lineIdOf(payload.lineId);
      if (!lineId) return state;
      return withActivity({ ...state, cart: state.cart.filter((line) => line.lineId !== lineId), saved: state.saved.filter((line) => line.lineId !== lineId) }, `deleted ${lineId}`);
    }
    case "save-for-later": {
      const line = state.cart.find((candidate) => candidate.lineId === lineIdOf(payload.lineId));
      if (!line) return state;
      if (state.guard.saveGlitch === "armed") return withActivity({ ...state, guard: { ...state.guard, saveGlitch: "spent" } }, `save for later failed ${line.lineId}`);
      return withActivity({ ...state, cart: state.cart.filter((candidate) => candidate !== line), saved: [line, ...state.saved] }, `saved ${line.lineId}`);
    }
    case "move-to-cart": {
      const line = state.saved.find((candidate) => candidate.lineId === lineIdOf(payload.lineId));
      if (!line || linePrice(line.sku, line.offerId) === undefined) return state;
      return withActivity({ ...state, saved: state.saved.filter((candidate) => candidate !== line), cart: [{ ...line, selected: true }, ...state.cart] }, `moved ${line.lineId}`);
    }
    case "select-line": {
      const lineId = lineIdOf(payload.lineId);
      if (!lineId || typeof payload.selected !== "boolean") return state;
      const selected = payload.selected;
      return { ...state, cart: state.cart.map((line) => line.lineId === lineId ? { ...line, selected } : line) };
    }
    case "select-all": {
      if (typeof payload.selected !== "boolean") return state;
      const selected = payload.selected;
      return { ...state, cart: state.cart.map((line) => ({ ...line, selected })) };
    }
    default:
      return undefined;
  }
}

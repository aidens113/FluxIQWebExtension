import { findProduct, speedOf } from "../catalog/index.js";
import { quantity, text } from "./payload-fields.js";
import type { BigboxState, CartLine, Fulfilment } from "../types.js";

const METHODS: readonly Fulfilment[] = ["pickup", "delivery", "shipping"];
const MAX_QTY = 12;

/**
 * The line an add-to-cart or Buy now payload describes, or undefined when it
 * names nothing the catalog carries, a quantity out of range, or a way of
 * getting the item the shopper's store cannot offer. The page never offers
 * the last; a request that asks for it anyway is refused, not corrected.
 */
export function requestedLine(state: BigboxState, payload: Record<string, unknown>): Omit<CartLine, "lineId"> | undefined {
  const found = findProduct(text(payload, "productId"), text(payload, "sku"));
  const qty = quantity(payload, "qty");
  const fulfilment = METHODS.find((method) => method === text(payload, "fulfilment"));
  if (!found || qty === undefined || fulfilment === undefined) return undefined;
  if (speedOf(found.variant, state.storeId, fulfilment) === "none") return undefined;
  return { productId: found.product.id, sku: found.variant.sku, qty, fulfilment };
}

/** Adds a line, or tops up the line for the same size and method, never past twelve. */
export function addToLines(state: BigboxState, lines: CartLine[], added: Omit<CartLine, "lineId">): { lines: CartLine[]; nextLine: number } {
  const existing = lines.find((line) => line.sku === added.sku && line.fulfilment === added.fulfilment);
  if (existing) return { lines: lines.map((line) => (line === existing ? { ...line, qty: Math.min(MAX_QTY, line.qty + added.qty) } : line)), nextLine: state.nextLine };
  return { lines: [...lines, { lineId: `L${state.nextLine}`, ...added }], nextLine: state.nextLine + 1 };
}

/** `update-qty`, `remove-line`, `save-for-later` and `move-to-cart`: the cart page's own controls. */
export function changeLine(state: BigboxState, operation: string, payload: Record<string, unknown>): BigboxState | undefined {
  const lineId = text(payload, "lineId");
  const inCart = state.cart.find((line) => line.lineId === lineId);
  const inSaved = state.saved.find((line) => line.lineId === lineId);
  if (operation === "update-qty") {
    const qty = quantity(payload, "qty");
    return inCart && qty !== undefined ? { ...state, cart: state.cart.map((line) => (line === inCart ? { ...line, qty } : line)) } : undefined;
  }
  if (operation === "remove-line") {
    if (!inCart && !inSaved) return undefined;
    return { ...state, cart: state.cart.filter((line) => line !== inCart), saved: state.saved.filter((line) => line !== inSaved) };
  }
  if (operation === "save-for-later") {
    return inCart ? { ...state, cart: state.cart.filter((line) => line !== inCart), saved: [...state.saved, inCart] } : undefined;
  }
  if (operation === "move-to-cart" && inSaved) {
    const { lines, nextLine } = addToLines(state, state.cart, inSaved);
    return { ...state, cart: lines, nextLine, saved: state.saved.filter((line) => line !== inSaved) };
  }
  return undefined;
}

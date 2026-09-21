import { STORES } from "./stores.js";
import type { Speed } from "../types.js";

/**
 * Pickup speed at every store, with the named exceptions: `pickupAt("today",
 * { "2291": "tomorrow" })` is on the shelf everywhere except Carden Falls
 * Supercenter, which has it tomorrow.
 */
export function pickupAt(speed: Speed, exceptions: Readonly<Record<string, Speed>> = {}): Readonly<Record<string, Speed>> {
  return Object.freeze(Object.fromEntries(STORES.map((store) => [store.id, exceptions[store.id] ?? speed])));
}

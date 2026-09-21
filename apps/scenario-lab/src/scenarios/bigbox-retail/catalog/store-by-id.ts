import { HOME_STORE_ID, STORES } from "./stores.js";
import type { Store } from "../types.js";

/** The store with `id`, or the home store for an id no store carries. */
export function storeById(id: string): Store {
  return STORES.find((store) => store.id === id) ?? STORES.find((store) => store.id === HOME_STORE_ID)!;
}

import type { Store } from "./types.js";

/**
 * The sellers. Fictional, and several deliberately close to one another: a
 * marketplace this size always has a "VoltBay Store" selling the same listing
 * as "Voltbay Official Store", a little cheaper, under the same title.
 */
const STORE_LIST: readonly Store[] = [
  { id: "voltbay-official", name: "Voltbay Official Store", positiveFeedback: "96.8%", followers: "48.2K", coupon: { offCents: 200, minimumCents: 2500 } },
  { id: "voltbay-lookalike", name: "VoltBay Store", positiveFeedback: "91.2%", followers: "3.1K", coupon: { offCents: 100, minimumCents: 1500 } },
  { id: "hubsmith", name: "Hubsmith Global Store", positiveFeedback: "97.5%", followers: "112K" },
  { id: "lumora", name: "Lumora Tech Store", positiveFeedback: "95.9%", followers: "27.4K" },
  { id: "qinport", name: "Qinport Official Store", positiveFeedback: "96.1%", followers: "64.0K" },
  { id: "nordwave", name: "Nordwave Electronics", positiveFeedback: "98.2%", followers: "9.8K", coupon: { offCents: 150, minimumCents: 2000 } },
  { id: "castellan", name: "Castellan Gadgets ES", positiveFeedback: "97.0%", followers: "15.3K" },
  { id: "tidewell", name: "Tidewell Computer Store", positiveFeedback: "94.7%", followers: "21.9K" },
  { id: "brightloop", name: "Brightloop Store", positiveFeedback: "93.8%", followers: "6.2K" },
  { id: "kestrel", name: "Kestrel Connect Store", positiveFeedback: "95.4%", followers: "33.7K" },
  { id: "mirafone", name: "Mirafone Accessories", positiveFeedback: "96.6%", followers: "58.1K" },
  { id: "pelican", name: "Pelican Peak Digital", positiveFeedback: "92.9%", followers: "4.4K" },
  { id: "zhenfa", name: "Zhenfa Accessories Store", positiveFeedback: "90.3%", followers: "71.5K" },
  { id: "oaklane", name: "Oaklane Iberia Tech", positiveFeedback: "97.7%", followers: "8.6K" },
  { id: "sunforge", name: "Sunforge 3C Store", positiveFeedback: "94.1%", followers: "12.0K" },
  { id: "duvra", name: "Duvra Warehouse EU", positiveFeedback: "96.3%", followers: "5.7K" },
  { id: "keelson", name: "Keelson Plaza ES", positiveFeedback: "98.0%", followers: "11.4K" },
  { id: "vistula", name: "Vistula Cable Co.", positiveFeedback: "95.0%", followers: "2.9K" },
  { id: "morava", name: "Morava Direct CZ", positiveFeedback: "94.6%", followers: "1.8K" },
];

export const STORES: ReadonlyMap<string, Store> = new Map(STORE_LIST.map((store) => [store.id, store]));

/** The store a listing names. Every listing names one that exists, which the catalogue test holds. */
export function storeById(id: string): Store {
  const store = STORES.get(id);
  if (!store) throw new Error(`Unknown store ${id}`);
  return store;
}

import type { Store } from "../types.js";

/**
 * The four stores the store picker lists. Two pairs share a town, and each
 * pair a Supercenter and a Neighborhood Market, so a store is only told apart
 * by its full name: "Carden Falls" alone names two of them, and so does
 * "Millbrook Crossing".
 */
export const STORES: readonly Store[] = [
  { id: "2291", name: "Carden Falls Supercenter", address: "1400 Orchard Pkwy, Carden Falls", distance: "2.1 mi", hours: "Open until 11pm", taxBasisPoints: 725 },
  { id: "5510", name: "Carden Falls Neighborhood Market", address: "212 W Mill St, Carden Falls", distance: "3.4 mi", hours: "Open until 10pm", taxBasisPoints: 725 },
  { id: "1187", name: "Millbrook Crossing Supercenter", address: "88 Ferris Rd, Millbrook", distance: "9.8 mi", hours: "Open 24 hours", taxBasisPoints: 675 },
  { id: "4419", name: "Millbrook Crossing Neighborhood Market", address: "17 Canal St, Millbrook", distance: "10.6 mi", hours: "Open until 10pm", taxBasisPoints: 675 },
];

/** The store a shopper has before they change it. */
export const HOME_STORE_ID = "2291";

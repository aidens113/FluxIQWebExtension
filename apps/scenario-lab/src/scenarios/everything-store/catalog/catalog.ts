import { EARBUD_ADS, EARBUDS, FEATURED_BRANDS } from "./earbuds/index.js";
import { HOUSEHOLD } from "./household.js";
import { KETTLE_ADS, KETTLES, OFFERS, TIDEWELL_KETTLES, type Offer } from "./kettles/index.js";
import type { Product } from "./types.js";

const ALL: readonly Product[] = [...new Map([
  ...EARBUDS, ...EARBUD_ADS.map(({ product }) => product), ...FEATURED_BRANDS,
  ...TIDEWELL_KETTLES, ...KETTLES, ...KETTLE_ADS.map(({ product }) => product), ...Object.values(HOUSEHOLD),
].map((product) => [product.sku, product] as const)).values()];

const BY_SKU = new Map(ALL.map((product) => [product.sku, product] as const));

/** Every listing the store holds, looked up by id, with its marketplace offers and its variant family. */
export const CATALOG = {
  all: ALL,
  bySku: (sku: string): Product | undefined => BY_SKU.get(sku),
  offer: (offerId: string): Offer | undefined => OFFERS.find((offer) => offer.offerId === offerId),
  offersFor: (sku: string): readonly Offer[] => OFFERS.filter((offer) => offer.sku === sku),
  family: (familyId: string): readonly Product[] => ALL.filter((product) => product.family === familyId),
} as const;

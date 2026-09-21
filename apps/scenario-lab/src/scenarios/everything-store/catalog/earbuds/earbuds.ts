import { asin } from "../asin.js";
import { fixedRandom } from "../fixed-random.js";
import { listing } from "../listing.js";
import type { Product } from "../types.js";

/** The catalogue's own constant; see `fixed-random.ts` for why it is not the lab seed. */
const AUTHORING_SEED = 0x2026_0921;
const ORGANIC_COUNT = 70;

const LINES: ReadonlyArray<readonly [brand: string, model: string]> = [
  ["Soundcrest", "Air Pro"], ["Soundcrest", "Air Pro 2"], ["Soundcrest", "Air Lite"], ["Soundcrest", "Sport X"],
  ["Aurelle", "Pods"], ["Aurelle", "Pods Fit"], ["Aurelle", "Echo"],
  ["Novaq", "Q20"], ["Novaq", "Q30 Pro"], ["Novaq", "Life Beam"],
  ["Pulsebud", "Neo"], ["Pulsebud", "Mini"], ["Trevio", "T5"], ["Trevio", "T7 Plus"],
  ["Kinetra", "Run"], ["Lumo Audio", "Drift"], ["Lumo Audio", "Drift Pro"],
  ["Zephyrline", "Z1"], ["Zephyrline", "Z3"], ["Oakhaven Sound", "Grove"], ["Vireo Audio", "V2"],
  ["Halden", "Buds 3"], ["Quillon", "QX"], ["Tessaro", "Arc"],
];
const HOURS = [24, 30, 36, 40, 48, 50, 60, 80] as const;
const FEATURES = [
  "IPX7 Waterproof", "Deep Bass", "Active Noise Cancelling", "Touch Control", "Built-in Mic",
  "LED Power Display", "Low Latency Gaming Mode", "Ear Hooks for Running", "Wireless Charging Case",
] as const;
const COLOURS = ["Black", "White", "Midnight Blue", "Graphite", "Sage", "Rose Gold", "Ivory"] as const;
const PRICES = [1499, 1799, 1999, 2299, 2499, 2699, 2999, 3299, 3499, 3999, 4499, 4799, 4999, 5499, 5999, 6499, 6999, 7999, 8999, 9999, 12999] as const;
const BOUGHT = ["50+", "100+", "200+", "500+", "1K+", "2K+", "5K+"] as const;
const COUPONS = ["Save 10%", "Save 15%", "Save $5.00"] as const;
const MARKET_SELLERS = ["Soundwave Outlet", "TechNest Direct", "Aurora Electronics US"] as const;

/**
 * Listings the catalogue plants on purpose, by relevance rank. Each is a
 * situation a person reading the results has to judge, and each is pinned by
 * the scenario test so a change to the generator cannot quietly move it.
 */
const PLANTED: Readonly<Record<number, Partial<Product>>> = {
  1: { priceCents: 4999, plus: true, rating: 4.1, seller: "Brightaisle" },
  4: { priceCents: 5000, plus: true, rating: 4.6, seller: "Brightaisle", listPriceCents: 6999 },
  6: { priceCents: 2999, plus: true, rating: 3.8, seller: "Brightaisle" },
  9: { priceCents: 1999, plus: true, rating: 3.9, seller: "Brightaisle" },
  10: {
    kind: "accessory", brand: "EarFit", plus: true, rating: 4.5, priceCents: 1299, listPriceCents: null, seller: "Brightaisle",
    title: "Replacement Ear Tips for Wireless Earbuds, Memory Foam Eartips, 3 Pairs (S/M/L), Black",
  },
  12: {
    brand: "Brightaisle Basics", plus: true, rating: 4.0, priceCents: 2299, listPriceCents: null, seller: "Brightaisle",
    title: "Brightaisle Basics Sport Wireless Earbuds, Bluetooth 5.3 with Ear Hooks, 36H Playtime, IPX7 Sweatproof, Black",
  },
  15: { priceCents: 3499, plus: true, rating: 4.3, seller: "Brightaisle" },
  22: {
    kind: "accessory", brand: "ChargeMate", plus: true, rating: 4.2, priceCents: 2499, listPriceCents: null, seller: "Brightaisle",
    title: "Charging Case Replacement for Soundcrest Air Pro Wireless Earbuds, 600mAh Charger Case with Pairing Button, White",
  },
  27: { brand: "Aurelle", priceCents: 3999, plus: true, rating: 4.4, seller: "Brightaisle" },
  31: { priceCents: 4799, plus: true, rating: 4.0, seller: "Brightaisle" },
  41: { brand: "Aurelle", priceCents: 3999, plus: true, rating: 4.4, seller: "Aurora Electronics US" },
};

/**
 * Ranks 27 and 41 are the same model from two sellers, one of them the store:
 * lookalikes that differ in their titles' last words and in nothing a quick
 * glance takes in. Both are listings in their own right.
 */
const LOOKALIKE_TITLES: Readonly<Record<number, string>> = {
  27: "Aurelle Pods Fit Wireless Earbuds, Bluetooth 5.3 Headphones with 36H Playtime, Touch Control, Built-in Mic, Ivory",
  41: "Aurelle Pods Fit Wireless Earbuds, Bluetooth 5.3 Headphones with 36H Playtime, Touch Control, Built-in Mic, Ivory with Wireless Charging Case",
};

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)] as T;
}

function generated(random: () => number): Product {
  const [brand, model] = pick(random, LINES);
  const first = pick(random, FEATURES);
  const second = pick(random, FEATURES.filter((feature) => feature !== first));
  const title = `${brand} ${model} Wireless Earbuds, Bluetooth 5.3 Headphones with ${pick(random, HOURS)}H Playtime, ${first}, ${second}, ${pick(random, COLOURS)}`;
  const priceCents = pick(random, PRICES);
  const plus = random() < 0.62;
  return listing({
    sku: asin(random),
    kind: "earbuds",
    brand,
    title,
    priceCents,
    listPriceCents: random() < 0.35 ? priceCents + pick(random, [1000, 1500, 2000, 3000]) : null,
    rating: Math.min(4.8, Math.round((3.3 + random() * 1.5) * 10) / 10),
    ratingCount: Math.floor(40 + random() ** 2 * 30_000),
    plus,
    seller: plus || random() < 0.5 ? "Brightaisle" : pick(random, MARKET_SELLERS),
    bought: random() < 0.4 ? `${pick(random, BOUGHT)} bought in past month` : null,
    coupon: random() < 0.15 ? pick(random, COUPONS) : null,
    stock: "In Stock",
    available: true,
    family: null,
    variant: null,
    hue: Math.floor(random() * 360),
  });
}

function planted(product: Product, rank: number): Product {
  const overrides = PLANTED[rank];
  const title = LOOKALIKE_TITLES[rank] ?? overrides?.title ?? product.title;
  if (!overrides && title === product.title) return product;
  const { slug: _slug, ...rest } = product;
  return listing({ ...rest, ...overrides, title });
}

/**
 * Every pair of wireless earbuds (and the accessories that share their words)
 * the search holds, in relevance order: the order an unsorted search shows
 * them. Seventy listings, over five pages of results.
 */
export const EARBUDS: readonly Product[] = (() => {
  const random = fixedRandom(AUTHORING_SEED);
  return Array.from({ length: ORGANIC_COUNT }, (_, rank) => planted(generated(random), rank));
})();

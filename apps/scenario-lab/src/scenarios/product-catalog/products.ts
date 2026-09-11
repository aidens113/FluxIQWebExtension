import type { CatalogProduct } from "./types.js";

/**
 * The authored catalog in listing order: 23 products, five out of stock,
 * four whose names contain "lamp" (one of them out of stock), and two priced
 * over $1,000 so their price text carries a thousands separator. It is the
 * same for every lab seed: the manifest's expected extraction records are
 * literal text, so the content must not move when a runner reseeds the lab.
 */
export const catalogProducts: readonly CatalogProduct[] = [
  product(1, "Aurora Desk Lamp", 4900, 46, true),
  product(2, "Birch Bookshelf", 18900, 43, true),
  product(3, "Cobalt Ceramic Mug", 1450, 48, false),
  product(4, "Drift Wool Throw", 7200, 44, true),
  product(5, "Ember Scented Candle", 2200, 41, true),
  product(6, "Fjord Standing Desk", 124900, 47, true),
  product(7, "Grove Planter Set", 3875, 39, false),
  product(8, "Harbor Wall Clock", 5600, 42, true),
  product(9, "Iris Linen Napkins", 1800, 45, true),
  product(10, "Juniper Floor Lamp", 13900, 40, false),
  product(11, "Kiln Stoneware Bowl", 2600, 46, true),
  product(12, "Lark Desk Organizer", 3150, 38, true),
  product(13, "Meadow Cotton Rug", 24500, 44, false),
  product(14, "Nimbus Pendant Light", 16800, 43, true),
  product(15, "Orchard Cutting Board", 4400, 49, true),
  product(16, "Pebble Bath Mat", 2900, 42, true),
  product(17, "Quill Notebook Set", 1600, 47, true),
  product(18, "Ridge Clip Lamp", 3400, 41, true),
  product(19, "Slate Coaster Set", 1950, 40, false),
  product(20, "Tidal Glass Carafe", 2700, 45, true),
  product(21, "Umber Leather Tray", 5800, 43, true),
  product(22, "Vale Oak Dining Table", 108000, 46, true),
  product(23, "Willow Reading Lamp", 6400, 44, true),
];

function product(index: number, name: string, priceCents: number, ratingTenths: number, inStock: boolean): CatalogProduct {
  return { id: `p${String(index).padStart(2, "0")}`, slug: name.toLowerCase().replaceAll(" ", "-"), name, priceCents, ratingTenths, inStock };
}

import type { CategorySlug } from "./categories.js";

/**
 * A sponsored post. On the page it is the same card component a listing uses
 * -- photo, price, title, a place -- with one small "Sponsored" line above
 * the photo and a link that leaves for the advertiser's shop in a new tab.
 * Adverts ignore every filter but the category or search they are bought
 * against, which is why a cheaper "new" folding bike from a shop sits at the
 * top of a search a person has narrowed to local, like-new ones.
 */
export type Advert = {
  id: string;
  advertiser: string;
  title: string;
  price: number;
  was?: number;
  /** The town the card names where a listing names its place. */
  town: string;
  categories: readonly CategorySlug[];
  /** Search words the advert is bought against; any one of them places it. */
  keywords: readonly string[];
  pitch: string;
};

export const ADVERTS: readonly Advert[] = [
  { id: "vm-folding-clearance", advertiser: "Velomart Outlet", title: "Folding bike, 20in, 7-speed, clearance", price: 149, was: 229, town: "Kelford", categories: ["bicycles"], keywords: ["bike", "bikes", "folding", "bicycle"],
    pitch: "Brand new folding bikes, delivered free in 2 days. Limited stock at this price." },
  { id: "vm-gravel", advertiser: "Velomart Outlet", title: "Gravel bike, 2x9 drivetrain, all sizes", price: 349, town: "Kelford", categories: ["bicycles"], keywords: ["bike", "bikes", "gravel", "road", "bicycle"],
    pitch: "New gravel bikes in every size, free fitting in store." },
  { id: "oh-dining", advertiser: "Oakhaus Furniture", title: "6-seater oak dining table, free delivery", price: 299, town: "Kelford", categories: ["furniture"], keywords: ["dining", "table", "tables"],
    pitch: "Solid oak dining tables, delivered and assembled free this month." },
  { id: "oh-chairs", advertiser: "Oakhaus Furniture", title: "Dining chairs, set of 4, 40% off", price: 119, was: 199, town: "Kelford", categories: ["furniture"], keywords: ["dining", "chairs", "chair"],
    pitch: "Upholstered dining chairs at 40% off while stocks last." },
  { id: "bc-phones", advertiser: "Brightcell Mobile", title: "Refurbished phones from £89", price: 89, town: "Kelford", categories: ["electronics"], keywords: ["phone", "smartphone", "phones"],
    pitch: "Refurbished phones with a 12-month warranty." },
];

export function advertById(id: string): Advert | undefined {
  return ADVERTS.find((advert) => advert.id === id);
}

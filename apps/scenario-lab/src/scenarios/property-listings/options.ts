import { propertyAreas } from "./listings.js";

/** One choice in a search select: the value the control carries, and the words the page shows for it. */
export type PropertyOption = { value: string; label: string };

/** A price band, with the bounds the search applies. An absent bound is open. */
export type PropertyBandOption = PropertyOption & { min?: number; max?: number };

/** The Area select. An area's value is its name lowercased and hyphenated, as a query string carries it. */
export const PROPERTY_AREA_OPTIONS: readonly PropertyOption[] = [
  { value: "", label: "All areas" },
  ...propertyAreas.map((area) => ({ value: area.toLowerCase().replaceAll(" ", "-"), label: area })),
];

/** The Bedrooms select. The last option is a floor, not an exact count, which is how a portal asks the question. */
export const PROPERTY_BED_OPTIONS: readonly PropertyOption[] = [
  { value: "", label: "Any number of bedrooms" },
  { value: "1", label: "1 bedroom" },
  { value: "2", label: "2 bedrooms" },
  { value: "3", label: "3 bedrooms" },
  { value: "4", label: "4 bedrooms" },
  { value: "5", label: "5 or more bedrooms" },
];

/**
 * The Price select. `max` is exclusive, so the bands tile the market without
 * overlapping. Five bedrooms start above 430,000 everywhere, so the first band
 * and five bedrooms together are a search with no answer.
 */
export const PROPERTY_BAND_OPTIONS: readonly PropertyBandOption[] = [
  { value: "", label: "Any price" },
  { value: "up-to-250000", label: "Up to \u00a3250,000", max: 250_000 },
  { value: "250000-500000", label: "\u00a3250,000 to \u00a3500,000", min: 250_000, max: 500_000 },
  { value: "500000-750000", label: "\u00a3500,000 to \u00a3750,000", min: 500_000, max: 750_000 },
  { value: "750000-plus", label: "\u00a3750,000 and over", min: 750_000 },
];

/** The Sort select, in the order the page offers it; the first is what the site opens on. */
export const PROPERTY_SORT_OPTIONS: readonly PropertyOption[] = [
  { value: "recent", label: "Most recent" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

import type { PropertyListing, PropertyVariant } from "./types.js";

/** The search page. Listing links are written root-relative from here, so their `href` text is the same on every run's port. */
export const PROPERTY_ROOT = "/scenarios/property-listings/";

/** An asking price as a portal writes it: a pound sign, then the amount with thousands separators. */
export function formatPrice(priceGbp: number): string {
  return `\u00a3${groupThousands(priceGbp)}`;
}

/** `1,095 sq ft`. A home whose agent published no floor area has no text here at all. */
export function formatFloorArea(floorAreaSqFt: number): string {
  return `${groupThousands(floorAreaSqFt)} sq ft`;
}

export function formatBedrooms(bedrooms: number): string {
  return `${bedrooms} bedroom${bedrooms === 1 ? "" : "s"}`;
}

/**
 * How long a home has been on the market, in the words a portal uses rather
 * than as a date: "Today", "Yesterday", days inside a week, then whole weeks,
 * then whole months. Nothing here depends on the clock, so the text is the
 * same on every run.
 */
export function formatListed(daysAgo: number): string {
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return `${daysAgo} days ago`;
  if (daysAgo < 28) return plural(Math.floor(daysAgo / 7), "week");
  return plural(Math.max(1, Math.floor(daysAgo / 30)), "month");
}

/** The council tax band the valuation office would have given this home, or nothing while it is a new build. */
export function councilTaxBand(listing: PropertyListing): string | undefined {
  if (listing.newBuild) return undefined;
  const bands = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const index = Math.min(bands.length - 1, Math.max(0, Math.floor(listing.priceGbp / 100_000) - 1));
  return `Band ${bands[index]}`;
}

export function listingPath(listing: PropertyListing): string {
  return `${PROPERTY_ROOT}listings/${listing.slug}`;
}

/**
 * Whether the card names the marketing agent. Under `agent-withheld` a seventh
 * of the market stops naming one, and the line is left off the card rather
 * than emptied, so the field reads as no value rather than as blank text. The
 * manifest builds its expected records from this predicate and the page
 * renders from it, so the two cannot drift.
 */
export function cardShowsAgent(listing: PropertyListing, variant: PropertyVariant): boolean {
  return variant !== "agent-withheld" || Number(listing.reference.slice(3)) % 7 !== 3;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"} ago`;
}

function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

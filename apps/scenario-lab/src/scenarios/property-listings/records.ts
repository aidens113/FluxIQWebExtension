import { cardShowsAgent, councilTaxBand, formatBedrooms, formatFloorArea, formatListed, formatPrice } from "./format.js";
import type { PropertyListing, PropertyVariant } from "./types.js";

/** What a read of the results cards yields for `listings` under `variant`, in the page's own words. */
export function listingRecords(listings: readonly PropertyListing[], variant: PropertyVariant): Array<Record<string, string | null>> {
  return listings.map((listing) => ({
    price: formatPrice(listing.priceGbp),
    address: listing.address,
    bedrooms: formatBedrooms(listing.bedrooms),
    // A home whose agent published no floor area has no element for it, so
    // nothing is read rather than something read as blank.
    floorArea: listing.floorAreaSqFt === undefined ? null : formatFloorArea(listing.floorAreaSqFt),
    agent: cardShowsAgent(listing, variant) ? listing.agent : null,
    listed: formatListed(listing.listedDaysAgo),
  }));
}

/** What a read of a home's own page yields: the two facts the card also shows, and the three only it has. */
export function detailRecords(listings: readonly PropertyListing[]): Array<Record<string, string | null>> {
  return listings.map((listing) => ({
    address: listing.address,
    price: formatPrice(listing.priceGbp),
    tenure: listing.tenure,
    // A new build has no band until it is first occupied, and its row is
    // absent from the key facts rather than empty.
    councilTax: councilTaxBand(listing) ?? null,
    epc: listing.epcRating,
  }));
}

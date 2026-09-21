import { sellerById, type Listing } from "../catalog/index.js";
import { CHAT_SCRIPT, LISTING_SCRIPT } from "../client/index.js";
import { priceText } from "../format/index.js";
import type { ClassifiedsState } from "../types.js";
import { listingShellMarkup, shellMarkup } from "../view/index.js";
import { classifiedsDocument, type PageBuild } from "./document.js";

/** A listing's page, served with its details still to come; `detail.json` fills the panel. */
export function listingPage(build: PageBuild, state: ClassifiedsState, listing: Listing): string {
  const seller = sellerById(listing.seller);
  const body = shellMarkup({ sheet: build.sheet, ids: build.ids, state, section: "listing", category: listing.category, main: listingShellMarkup(build.sheet, listing, state) });
  return classifiedsDocument(build, state, `${listing.title} | Kerbfind Marketplace`, body, [LISTING_SCRIPT, CHAT_SCRIPT], {
    listing: { id: listing.id, price: listing.price, priceText: priceText(listing.price), sellerName: seller.name, sellerFirst: seller.name.split(" ")[0] },
  });
}

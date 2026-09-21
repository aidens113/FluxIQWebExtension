import { escapeHtml } from "../../../html.js";
import type { AuctionState, Listing } from "../types.js";
import type { AuctionClasses } from "./styles.js";

const HEART = "M12 21s-7-4.4-9.3-8.6C1 9 3 5 6.6 5c2 0 3.4 1.1 5.4 3 2-1.9 3.4-3 5.4-3C21 5 23 9 21.3 12.4 19 16.6 12 21 12 21z";

/**
 * The listing's watch control. `cta` is the one the site shipped with: a
 * labelled button, "Add to Watchlist", that reads "Watching" once pressed and
 * takes the listing off again when pressed a second time. It carries the
 * component library's test hook, `x-watch-cta`, as the production build ships
 * it. `heart` is what the `watch-redesign` rendering replaced it with: an
 * icon on the photo whose only name is its label, "Save item".
 */
export function watchButton(css: AuctionClasses, listing: Listing, state: AuctionState, style: "cta" | "heart"): string {
  const watching = state.watched.includes(listing.id);
  if (style === "heart") {
    const fill = watching ? "#e0103a" : "none";
    return `<button class="${css.galleryHeart} ${css.watchCta}" type="button" value="${listing.id}" aria-label="Save item" aria-pressed="${watching}"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${HEART}" fill="${fill}" stroke="${watching ? "#e0103a" : "#191919"}" stroke-width="1.8"/></svg></button>`;
  }
  return `<button class="${css.button} ${css.buttonGhost} ${css.watchCta}" data-testid="x-watch-cta" type="button" value="${listing.id}" aria-pressed="${watching}">${watching ? "&#9829; Watching" : "&#9825; Add to Watchlist"}</button>`;
}

/** Save a seller. Pressed again, it forgets them. */
export function followButton(css: AuctionClasses, seller: string, state: AuctionState, label: string): string {
  const saved = state.followed.includes(seller);
  return `<button class="${css.button} ${css.buttonGhost} ${css.followCta}" type="button" value="${escapeHtml(seller)}" aria-pressed="${saved}" title="${escapeHtml(label)}">${saved ? "Seller saved" : escapeHtml(label)}</button>`;
}

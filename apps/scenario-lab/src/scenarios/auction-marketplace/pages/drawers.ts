import { escapeHtml } from "../../../html.js";
import { bidCount, bidIncrement, currentPrice, minimumBid, moneyText, postageText, timeLeftText } from "../catalog/index.js";
import type { AuctionState, Listing } from "../types.js";
import { bidsText } from "./card.js";
import type { AuctionClasses } from "./styles.js";

/**
 * The bid drawer, which slides in from the right edge of the window. It has
 * three stages -- enter a maximum, review it, see the result -- and one field
 * a person never sees: an off-screen "Bid reference" box that the site uses
 * to spot bots, because a form-filling script fills every input it finds.
 *
 * Review bid is a div. Confirm bid is a button, at the foot of the drawer,
 * in the bottom-right corner of the window, which is where the chat widget's
 * greeting opens a few seconds after the page loads.
 */
export function bidDrawerMarkup(css: AuctionClasses, listing: Listing, state: AuctionState): string {
  const { currency } = listing;
  const minimum = minimumBid(listing, state.bids);
  const chips = [minimum, minimum + bidIncrement(minimum), minimum + 2 * bidIncrement(minimum)]
    .map((amount) => `<button class="${css.chip}" type="button" value="${(amount / 100).toFixed(2)}">Bid ${moneyText(currency, amount)}</button>`).join("");
  const standing = `Current bid: ${moneyText(currency, currentPrice(listing, state.bids))} · ${bidsText(bidCount(listing, state.bids))} · ${timeLeftText(listing.endsIn ?? 0)}`;
  return `<div class="${css.drawer} ${css.bidDrawer}" role="dialog" aria-modal="true" aria-label="Place your bid" hidden>
<div class="${css.drawerHead}"><span>Place your bid</span><div class="${css.modalClose}">&#215;</div></div>
<div class="${css.drawerBody}">
<section>
<p class="${css.priceMeta}">${escapeHtml(standing)}</p>
<div class="${css.chips}">${chips}</div>
<label class="${css.field}"><span class="${css.fieldLabel}">Your max bid</span><input class="${css.fieldInput}" type="text" name="maxbid" inputmode="decimal" autocomplete="off"></label>
<p class="${css.hint}">Enter ${moneyText(currency, minimum)} or more</p>
<div class="${css.trap}" aria-hidden="true"><label>Bid reference <input type="text" name="reference" tabindex="-1" autocomplete="off"></label></div>
<p class="${css.hint}" role="alert"></p>
<p class="${css.legal}">Your max bid is the most you are willing to pay. We bid for you, only as much as needed to keep you in the lead, up to your max.</p>
</section>
<section hidden>
<p class="${css.fieldLabel}">Review your bid</p>
<p>${escapeHtml(listing.title)}</p>
<p>Your max bid: <strong></strong></p>
<p class="${css.legal}">By selecting Confirm bid, you commit to buy this item from the seller if you are the winning bidder. Bids cannot be retracted.</p>
<p><span class="${css.link}">Edit bid</span></p>
</section>
<section hidden><p class="${css.status}" role="status"></p></section>
</div>
<div class="${css.drawerFoot}"><div class="${css.divButton}">Review bid</div><button class="${css.button} ${css.buttonPrimary}" type="button" hidden>Confirm bid</button><button class="${css.button} ${css.buttonGhost}" type="button" hidden>Done</button></div>
</div>`;
}

/** Buy it now's review drawer: the price, the postage, a hidden bot trap, and Confirm and pay. */
export function buyDrawerMarkup(css: AuctionClasses, listing: Listing): string {
  return `<div class="${css.drawer} ${css.buyDrawer}" role="dialog" aria-modal="true" aria-label="Review your purchase" hidden>
<div class="${css.drawerHead}"><span>Review your purchase</span><div class="${css.modalClose}">&#215;</div></div>
<div class="${css.drawerBody}">
<section>
<p>${escapeHtml(listing.title)}</p>
<p>Price: <strong></strong></p>
<p>Postage: ${escapeHtml(postageText(listing.currency, listing.postage))}</p>
<div class="${css.trap}" aria-hidden="true"><label>Order reference <input type="text" name="reference" tabindex="-1" autocomplete="off"></label></div>
<p class="${css.legal}">By selecting Confirm and pay, you agree to buy this item and to pay for it with your saved card ending 4417.</p>
</section>
<section hidden><p class="${css.status}" role="status"></p></section>
</div>
<div class="${css.drawerFoot}"><button class="${css.button} ${css.buttonPrimary}" type="button">Confirm and pay</button><button class="${css.button} ${css.buttonGhost}" type="button" hidden>Done</button></div>
</div>`;
}

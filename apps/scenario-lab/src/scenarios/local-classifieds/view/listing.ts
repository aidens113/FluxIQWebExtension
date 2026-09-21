import { escapeHtml } from "../../../html.js";
import { placeById, sellerById, type Listing } from "../catalog/index.js";
import { conditionLabel, listedOn, listedText, priceText } from "../format/index.js";
import { latestOffer, offerReceiptText } from "../readouts.js";
import { CLASSIFIEDS_ROOT } from "../root.js";
import type { ClassifiedsState } from "../types.js";
import type { ClassSheet, IdName } from "./classes.js";
import { photoFor } from "./photo.js";

const HEART = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z"/></svg>`;

/**
 * The listing page as it is served: the photo, and a panel of grey skeleton
 * bars where the details will go. The details arrive a moment later from the
 * listing's own data address, the way a single-page app fills in a route.
 *
 * In the `moved-save` rendering the photo carries a heart, "Add to saved
 * items", which is where Save went.
 */
export function listingShellMarkup(sheet: ClassSheet, listing: Listing, state: ClassifiedsState): string {
  const c = sheet.names;
  const place = placeById(listing.place).name;
  const heart = state.mode !== "moved-save" ? "" : `<div class="${c.heart}" role="button" tabindex="0" aria-label="Add to saved items" title="Add to saved items" aria-pressed="${state.saved.includes(listing.id)}">${HEART}</div>`;
  const skeleton = Array.from({ length: 6 }, (_, index) => `<div class="${c.skeleton}" style="height:${index === 0 ? 28 : 14}px;margin:12px 0;width:${90 - index * 9}%"></div>`).join("");
  return `<div class="${c.pdp}">
  <div class="${c.pdpMedia}">
    <div class="${c.pdpArrow}" role="button" tabindex="0" aria-label="View previous image" style="left:16px">&lsaquo;</div>
    <div><img class="${c.pdpPhoto}" alt="${escapeHtml(`${listing.title} in ${place}`)}" src="${photoFor(listing.title, listing.category)}">
    <div class="${c.pdpThumbs}"><div class="${c.pdpThumb}"></div><div class="${c.pdpThumb}"></div><div class="${c.pdpThumb}"></div></div></div>
    <div class="${c.pdpArrow}" role="button" tabindex="0" aria-label="View next image" style="right:16px">&rsaquo;</div>
    ${heart}
  </div>
  <div class="${c.pdpPanel}" aria-busy="true"><div>${skeleton}</div></div>
</div>`;
}

/**
 * The details the panel fills in. Save sits in the action row, the one control
 * on the site with a test id -- the recording names it, which is what the
 * `moved-save` rendering takes away when it puts Hide there instead.
 *
 * The message box and Make offer are pinned to the bottom of the panel, which
 * is exactly where the chat window opens.
 */
export function listingPanelMarkup(sheet: ClassSheet, ids: Record<IdName, string>, listing: Listing, state: ClassifiedsState, mapOrigin: string): string {
  const c = sheet.names;
  const place = placeById(listing.place);
  const seller = sellerById(listing.seller);
  const saved = state.saved.includes(listing.id);
  const was = listing.was === undefined ? "" : `<span class="${c.pdpWas}">${escapeHtml(priceText(listing.was))}</span>`;
  const sold = listing.sold ? ` <span class="${c.chip}">Sold</span>` : "";
  const save = state.mode === "moved-save"
    ? `<div class="${c.actionButton}" role="button" tabindex="0">Hide</div>`
    : `<div class="${c.actionButton}" role="button" tabindex="0" aria-pressed="${saved}" data-testid="marketplace_pdp_save">${saved ? "Saved" : "Save"}</div>`;
  const details = [["Condition", conditionLabel(listing.condition)] as const, ...(listing.details ?? [])]
    .map(([key, value]) => `<div class="${c.detailRow}"><span class="${c.detailKey}">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></div>`).join("");
  const hidden = state.hidden.includes(listing.id) ? `<div class="${c.receipt}">You've hidden this listing. It won't appear in your feed.</div>` : "";
  const offer = latestOffer(state, listing.id);
  const receipt = offer ? `<div class="${c.receipt}" data-testid="marketplace_offer_receipt">${escapeHtml(offerReceiptText(offer))}</div>` : "";
  const initials = seller.name.split(" ").map((part) => part[0]).join("");
  const contact = listing.sold ? `<div class="${c.receipt}">This item has been sold.</div>` : `<span class="${c.messageLabel}">Send seller a message</span>
  <div class="${c.messageBox}">
    <label class="${c.srOnly}" for="${ids.messageInput}">Message</label>
    <input class="${c.messageInput}" id="${ids.messageInput}" value="Hi, is this still available?" autocomplete="off">
    <div class="${c.honeypot}" aria-hidden="true"><label>Company <input type="text" name="company" tabindex="-1" autocomplete="off"></label></div>
    <div class="${c.sendButton}" role="button" tabindex="0">Send</div>
  </div>
  <div class="${c.offerButton}" role="button" tabindex="0">Make offer</div>`;
  return `<div>
  <h1 class="${c.pdpTitle}">${escapeHtml(listing.title)}</h1>
  <div class="${c.pdpPriceRow}"><span class="${c.pdpPrice}">${escapeHtml(priceText(listing.price))}</span>${was}${sold}</div>
  <div class="${c.pdpListed}"><span title="${escapeHtml(listedOn(listing.hours))}">${escapeHtml(listedText(listing.hours))}</span> in <a href="${CLASSIFIEDS_ROOT}">${escapeHtml(place.name)}</a></div>
  <div class="${c.pdpActions}">
    <div class="${c.actionPrimary}" role="button" tabindex="0">Message</div>
    ${save}
    <div class="${c.actionButton}" role="button" tabindex="0">Share</div>
    <div class="${c.actionButton}" role="button" tabindex="0" aria-label="More options">&middot;&middot;&middot;</div>
  </div>
  ${hidden}
  <div class="${c.pdpSection}">
    <h2 class="${c.pdpSectionTitle}">Details</h2>
    ${details}
    ${descriptionMarkup(sheet, listing.description)}
    <div class="${c.distance}">${place.miles} mi away · ${escapeHtml(place.name)}</div>
    <iframe class="${c.mapFrame}" title="Map" src="${mapOrigin}${CLASSIFIEDS_ROOT}map/${place.id}/" loading="lazy"></iframe>
  </div>
  <div class="${c.pdpSection}">
    <h2 class="${c.pdpSectionTitle}">Seller information</h2>
    <div class="${c.sellerCard}"><div class="${c.avatar}">${escapeHtml(initials)}</div><div>
      <div class="${c.sellerName}">${escapeHtml(seller.name)}</div>
      <div class="${c.sellerMeta}">Joined Kerbfind in ${seller.joined}</div>
      <div class="${c.sellerMeta}">${seller.rating.toFixed(1)} &#9733; (${seller.reviews})</div>
      <div class="${c.sellerMeta}">${escapeHtml(seller.replies)}</div>
    </div></div>
  </div>
</div>
<div class="${c.stickyBar}">
  ${contact}
  ${receipt}
</div>`;
}

/** A long description is cut at a word and finished by "See more", which is a span that only a script makes into a control. */
function descriptionMarkup(sheet: ClassSheet, text: string): string {
  const c = sheet.names;
  if (text.length <= 140) return `<p class="${c.description}">${escapeHtml(text)}</p>`;
  const cut = text.slice(0, text.lastIndexOf(" ", 120));
  return `<p class="${c.description}"><span>${escapeHtml(cut)}</span><span hidden>${escapeHtml(text.slice(cut.length))}</span>&hellip; <span class="${c.seeMore}" role="button" tabindex="0">See more</span></p>`;
}

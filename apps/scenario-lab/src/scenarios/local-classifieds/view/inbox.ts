import { escapeHtml } from "../../../html.js";
import { listingById, listingByKey, sellerById } from "../catalog/index.js";
import { priceText } from "../format/index.js";
import type { ClassifiedsState } from "../types.js";
import { listingPath } from "./card.js";
import type { ClassSheet } from "./classes.js";

/** The conversations the account had before the session, newest first. */
const PRIOR_THREADS = [
  { key: "road-52-alex", snippet: "Alex: Still keen on the road bike? I could do £200 if you collect this week.", when: "2d" },
  { key: "floor-lamp", snippet: "Sam: Yes, it's still available.", when: "5d" },
] as const;

/**
 * Marketplace inbox and Buying: one thread per listing the account has
 * written to, newest first, with the last thing said in it.
 */
export function inboxMarkup(sheet: ClassSheet, state: ClassifiedsState, heading: string): string {
  const c = sheet.names;
  const sent = [...state.offers.map((offer) => ({ listingId: offer.listingId, snippet: `You: Offer of ${priceText(offer.amount)}${offer.delivered ? "" : " · Not delivered"}` })),
    ...state.messages.map((message) => ({ listingId: message.listingId, snippet: `You: ${message.text}${message.delivered ? "" : " · Not delivered"}` }))];
  const latest = new Map<string, string>();
  for (const entry of sent) latest.set(entry.listingId, entry.snippet);
  const fresh = [...latest.entries()].reverse().map(([listingId, snippet]) => ({ listing: listingById(listingId), snippet, when: "now" }));
  const prior = PRIOR_THREADS.map((thread) => ({ listing: listingByKey(thread.key), snippet: thread.snippet, when: thread.when }));
  const rows = [...fresh, ...prior].flatMap(({ listing, snippet, when }) => {
    if (!listing) return [];
    const seller = sellerById(listing.seller);
    return [`<li class="${c.thread}"><div class="${c.avatar}">${escapeHtml(seller.name.split(" ").map((part) => part[0]).join(""))}</div>
<div><a class="${c.threadName}" href="${listingPath(listing)}">${escapeHtml(`${seller.name} · ${listing.title}`)}</a><div class="${c.threadSnippet}">${escapeHtml(snippet)} · ${when}</div></div></li>`];
  }).join("\n");
  return `<div class="${c.pageHead}"><h2 class="${c.pageTitle}">${escapeHtml(heading)}</h2></div><ul class="${c.threadList}">${rows}</ul>`;
}

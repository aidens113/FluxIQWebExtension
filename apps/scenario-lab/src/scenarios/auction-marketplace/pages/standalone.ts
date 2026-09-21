import { buildClassNames } from "../../../build-classes.js";
import { escapeHtml, fixtureClient, page } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { sellerById } from "../catalog/index.js";
import { challengeClientScript } from "../client/index.js";
import { MARKET_ROOT } from "../paths.js";
import type { Listing } from "../types.js";
import { auctionClasses, auctionStylesheet } from "./styles.js";

/**
 * The bot check a marketplace puts in front of a visitor it has seen move
 * quickly: a plain page that says it is checking the browser, continues by
 * itself after five seconds, and offers a Continue button for anyone who does
 * not want to wait. Waiting or pressing it is all it takes.
 */
export function renderChallenge(context: RenderContext, returnTo: string): string {
  const css = auctionClasses(context.seed);
  const reference = buildClassNames(`challenge:${context.seed}:${returnTo}`, ["ref"]).ref ?? "";
  const body = `<div class="${css.challenge}"><div class="${css.challengeCard}">
<h1>Checking your browser before you continue</h1>
<div class="${css.spinner}"></div>
<p>We saw unusual activity from your network. This takes about five seconds, or you can continue now.</p>
<button class="${css.button} ${css.buttonPrimary}" type="button">Continue</button>
<p class="${css.hint}">Reference ${escapeHtml(reference.replace("css-", "").toUpperCase())}</p>
</div></div>
<style>${auctionStylesheet(css)}</style>`;
  return page("Pardon the wait | Hammerline", body, `${fixtureClient(context.runToken, "auction-marketplace")}\n${challengeClientScript(returnTo)}`);
}

/** Where the challenge sends the visitor afterwards: the results address they asked for, or the home page for anything else. */
export function safeReturnPath(requested: string | null): string {
  return requested !== null && requested.startsWith(`${MARKET_ROOT}sch/`) ? requested : MARKET_ROOT;
}

/**
 * The seller's own description, served from the marketplace's second origin
 * and shown in a frame on the listing page, the way seller-written HTML is
 * kept away from the page that holds the buyer's session.
 */
export function renderDescription(listing: Listing): string {
  const seller = sellerById(listing.seller);
  const paragraphs = listing.description.map((text) => `<p>${escapeHtml(text)}</p>`).join("");
  const body = `<main style="font: 15px/1.5 Georgia, serif; padding: 12px">
<h2 style="margin-top: 0">${escapeHtml(listing.title)}</h2>
${paragraphs}
<h3>Postage and payment</h3>
<p>Posted within two working days of cleared payment from ${escapeHtml(seller.location)}. Combined postage on request.</p>
<p style="color: #707070">Listed with ${escapeHtml(seller.id)} templates</p>
</main>`;
  return page(`${listing.title} - description`, body, "");
}

/** A photograph of the listing: a drawing of a camera in the listing's own colour, served as an image like any other. */
export function listingImage(listing: Listing, index: number): string {
  const hue = (Number(listing.id.slice(-4)) * 7 + index * 40) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<rect width="200" height="200" fill="hsl(${hue} 30% 92%)"/>
<rect x="30" y="70" width="140" height="80" rx="10" fill="hsl(${hue} 20% 25%)"/>
<rect x="45" y="58" width="40" height="16" rx="4" fill="hsl(${hue} 20% 35%)"/>
<circle cx="100" cy="110" r="30" fill="hsl(${hue} 10% 15%)"/><circle cx="100" cy="110" r="18" fill="hsl(${hue} 40% 45%)"/>
<rect x="135" y="80" width="22" height="12" rx="2" fill="hsl(${hue} 10% 80%)"/>
</svg>`;
}

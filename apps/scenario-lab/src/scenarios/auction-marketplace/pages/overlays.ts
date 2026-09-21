import type { AuctionClasses } from "./styles.js";

const CLOSE_GLYPH = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="#191919" stroke-width="2"/></svg>`;

/**
 * The app promotion. It is in every home and results page until it is
 * dismissed, and appears a couple of seconds after the page loads -- long
 * enough that a run has usually started doing something by then. Its scrim
 * takes every click until Not now, a styled span, or the unlabelled close
 * glyph is pressed.
 */
export function promoMarkup(css: AuctionClasses): string {
  return `<div class="${css.scrim} ${css.promo}" hidden>
<div class="${css.modal}" role="dialog" aria-modal="true" aria-labelledby="hl-promo-title">
<div class="${css.modalClose}">${CLOSE_GLYPH}</div>
<p class="${css.modalHead}" id="hl-promo-title">Bid on the go</p>
<p class="${css.modalBody}">Get instant outbid alerts and bid in the last seconds from anywhere with the Hammerline app. Scan the code with your phone, or we can text you a link.</p>
<div class="${css.modalFoot}"><a class="${css.button} ${css.buttonPrimary}" href="#get-the-app">Get the app</a><span class="${css.notNow}">Not now</span></div>
</div>
</div>`;
}

/**
 * The satisfaction survey the `feedback-survey` rendering adds. It interrupts
 * the second results page a visitor loads, and every one after, until it is
 * answered or declined.
 */
export function surveyMarkup(css: AuctionClasses): string {
  const stars = [1, 2, 3, 4, 5].map((value) => `<label><input type="radio" name="hl-survey-rating" value="${value}"> ${value}</label>`).join(" ");
  return `<div class="${css.scrim} ${css.survey}" hidden>
<div class="${css.modal}" role="dialog" aria-modal="true" aria-labelledby="hl-survey-title">
<p class="${css.modalHead}" id="hl-survey-title">How are your search results?</p>
<p class="${css.modalBody}">Tell us how well these results match what you were looking for. It takes ten seconds.</p>
<p class="${css.modalBody}">${stars}</p>
<div class="${css.modalFoot}"><button class="${css.button} ${css.buttonPrimary}" type="button">Send feedback</button><span class="${css.notNow}">No thanks</span></div>
</div>
</div>`;
}

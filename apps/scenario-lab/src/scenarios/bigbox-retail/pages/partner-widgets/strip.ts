import { PARTNER_WIDGETS as W } from "./values.js";

/**
 * The partner embeds' place in the buy box, below its live part: the
 * pay-over-time host beside its details link, the delivery line whose
 * estimate is inserted after it when asked for, and the review line beside
 * the highlights host, which stays empty until its link upgrades it. Every
 * link answers in place (`partnerWidgetsScript`). Unstyled, so the site's
 * stylesheet and class names are the baseline's.
 */
export function partnerWidgetsStrip(): string {
  const offer = `<div><${W.payOverTime.tag}></${W.payOverTime.tag}> <a href="${W.payOverTime.href}">${W.payOverTime.link}</a></div>`;
  const delivery = `<div>Getting it delivered? <a href="${W.deliveryEstimate.href}">${W.deliveryEstimate.link}</a></div>`;
  const reviews = `<div>What shoppers say: <a href="${W.reviewHighlights.href}">${W.reviewHighlights.link}</a> <${W.reviewHighlights.tag}></${W.reviewHighlights.tag}></div>`;
  return `<div>${offer}${delivery}${reviews}</div>`;
}

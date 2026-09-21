import { escapeHtml } from "../../../html.js";
import { formatMoney } from "../catalog/index.js";
import type { Variant } from "../types.js";
import type { BigboxClasses } from "../theme/index.js";

/**
 * A price the way the store's design system draws it: the dollars large, the
 * cents raised and small, and the figure a screen reader hears kept apart in
 * visually hidden text. Read as text, the drawn price is "$897"; the hidden
 * one is the only place "$8.97" is written out whole. A Rollback adds "Now"
 * before it and the struck-through old price after it.
 */
export function priceMarkup(variant: Variant, c: BigboxClasses): string {
  const whole = Math.floor(variant.priceCents / 100);
  const cents = String(variant.priceCents % 100).padStart(2, "0");
  const now = variant.wasCents === undefined ? "" : `<span class="${c.priceNow}">Now</span>`;
  const was = variant.wasCents === undefined ? "" : `<span class="${c.priceWas}"><span class="${c.srOnly}">Was</span><s>${formatMoney(variant.wasCents)}</s></span>`;
  const unit = variant.unit === "" ? "" : `<div class="${c.unitPrice}">${escapeHtml(variant.unit)}</div>`;
  return `<div class="${c.priceBlock}">${now}<span class="${c.srOnly}">${formatMoney(variant.priceCents)}</span><span class="${c.priceMain}" aria-hidden="true">$${whole.toLocaleString("en-US")}<sup class="${c.priceSup}">${cents}</sup></span>${was}${unit}</div>`;
}

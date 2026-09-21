import { escapeHtml } from "../../../html.js";
import { SITE_ROOT } from "../catalog/index.js";
import { miniCartText } from "../cart/index.js";
import type { BigboxState } from "../types.js";
import type { BigboxClasses } from "../theme/index.js";

/**
 * The inside of the header's mini cart, the flyout a shopper sees on hovering
 * the cart. It is served on its own too (`mini-cart`), so the page can redraw
 * it after every change; the count badge beside it is only ever drawn with the
 * page, and goes stale until the next load.
 */
export function miniCartMarkup(state: BigboxState, c: BigboxClasses): string {
  const text = miniCartText(state);
  const lines = text.lines.map((line) => `<li data-testid="${line.testId}">${escapeHtml(line.text)}</li>`).join("");
  return `<strong>Your cart</strong><p data-testid="mini-cart-store">${escapeHtml(text.store)}</p><ul class="${c.miniCartList}">${lines}</ul><p data-testid="mini-cart-summary">${escapeHtml(text.summary)}</p><p data-testid="mini-cart-saved">${escapeHtml(text.saved)}</p><a href="${SITE_ROOT}cart">View cart</a>`;
}

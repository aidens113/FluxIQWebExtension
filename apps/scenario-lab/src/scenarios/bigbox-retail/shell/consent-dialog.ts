import type { BigboxClasses } from "../theme/index.js";

/**
 * The consent dialog every page opens with until it is answered. It sits over
 * a scrim that takes every click aimed at the page behind it.
 */
export function consentDialogMarkup(c: BigboxClasses, titleId: string): string {
  return `<div class="${c.scrim}"></div>
<div class="${c.consent}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
  <h2 id="${titleId}">Your privacy choices</h2>
  <p>ValueRidge and our 38 partners use cookies and similar technologies to run the site, remember your store, measure how it is used and show you relevant ads. You can change your mind at any time from the Privacy choices link at the bottom of every page.</p>
  <div class="${c.consentActions}">
    <button type="button" class="${c.btn} ${c.btnPrimary}">Accept all</button>
    <button type="button" class="${c.btn} ${c.btnSecondary}">Reject all</button>
    <button type="button" class="${c.btnLink}">Manage choices</button>
  </div>
</div>`;
}

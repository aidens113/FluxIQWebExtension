/**
 * Every delay the store's pages keep, in milliseconds, in one place so the
 * scenario's own tests wait exactly as long as a patient person would.
 *
 * - `appBanner`, `notifications`: after each page load, until answered.
 * - `chatAutoOpen`: the support chat opens itself on a product page.
 * - `resultsHydrate`: a results page shows placeholders until its script
 *   renders the results it was sent.
 * - `lazyResults`: the results below the twelfth load this long after the
 *   bottom of the list scrolls into view.
 * - `productHydrate`: the buy box does nothing when clicked until the page's
 *   script has attached to it.
 * - `addToCart`: the add button's spinner.
 * - `dealWheel`: the spin-to-win promotion, on the first results page.
 * - `softCheckButton`, `softCheckAuto`: the browser check's button unlocks,
 *   or the check passes on its own if the shopper just waits.
 * - `saveRetry`: a failed Save for later offers "Try again" this long after
 *   its spinner started.
 */
export const STORE_TIMINGS = {
  appBanner: 2000,
  notifications: 4000,
  chatAutoOpen: 5000,
  suggestBlur: 150,
  resultsHydrate: 700,
  lazyResults: 600,
  productHydrate: 1200,
  addToCart: 400,
  dealWheel: 1500,
  softCheckButton: 1500,
  softCheckAuto: 8000,
  saveRetry: 4000,
} as const;

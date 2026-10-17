/**
 * Console errors the live storefront logs on an ordinary visit, which a run
 * must not be failed for: the broken Next handler, the coupon service's cold
 * start, and the feed's rate limit as Chrome reports a 429.
 */
export const SITE_NOISE = ["reading 'current'", "[coupon] claim failed", "status of 429"];

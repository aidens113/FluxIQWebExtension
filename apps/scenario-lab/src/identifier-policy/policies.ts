/**
 * How much of a page's identifier surface a rendering keeps.
 *
 * Every fixture in this repository is authored the way a test author writes
 * one: a `data-testid` on everything worth reaching. Production builds are not
 * authored, they are *built*, and the build removes exactly that attribute --
 * `reactRemoveProperties`, `babel-plugin-react-remove-properties` and the Vue
 * and Angular equivalents are on by default in framework starters.
 *
 * This matters far more than fixture realism, because Core's `normalizedScore`
 * divides by the weight of the signals **the recording** carried. A recording
 * made against an authored fixture carries `id` (26) and `testId` (28) of 142
 * points, so 38% of the scale is settled before a single comparison. Remove
 * them and the arithmetic is a different one -- see
 * `reports/r-fixture-audit.md` §3.1-§3.4 and `reports/x-identifierless.md`,
 * which measures it.
 *
 * - `as-authored` -- the page as its author wrote it. Every existing rendering.
 * - `no-test-ids` -- what an ordinary production build ships: no `data-testid`,
 *   `data-test` or `data-cy` anywhere, and every `id` left exactly as authored,
 *   because a build has no reason to touch one. The common case.
 * - `no-identifiers` -- `no-test-ids`, and every author-stable `id` replaced by
 *   an opaque generated one in React's `useId` shape. The page is still
 *   correct and still accessible -- every `for`, `aria-labelledby`,
 *   `aria-controls` and same-document `href` is rewritten with it -- but
 *   nothing a recording captured as an identifier survives to the replay. The
 *   shape a component library with generated ids produces.
 */
export const identifierPolicies = ["as-authored", "no-test-ids", "no-identifiers"] as const;

export type IdentifierPolicy = (typeof identifierPolicies)[number];

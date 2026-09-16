/**
 * How the settings page renders its "Save changes" action. `baseline` is what
 * the recording sees; each other mode but `save-and-exit` is one identity
 * drift.
 *
 * The first four are corpus variants W20-W23, and each stops one step short of
 * taking every recorded signal away. `reworded-aria` is the step past them: one
 * redesign changes the id, the class, the test id and the visible text
 * together, and the only thing the recording knew the control by that survives
 * is its accessible name, now written as an `aria-label`. It is the one
 * rendering that reaches the resolver's scored fallback instead of an exact
 * lookup, and the one that proves the fallback can succeed: measured, the
 * redesigned Save scores 0.389 against the 0.35 floor at confidence 0.366,
 * with Discard second at -0.360, so it clears the floor by 0.039 and leads by
 * 0.749.
 *
 * It resolves only because of decision D13, which changed how Core's matcher
 * charges a *missing* stable identifier against a *contradicted* one
 * (`MISSING_STABLE_IDENTIFIER_SIMILARITY`, now -0.1). Before that this
 * rendering scored 0.218 and was refused -- which is what this comment used to
 * describe, and it stopped being true on 2026-09-12. Flipping the Core
 * constant back was measured to turn the row red, so this variant and that
 * constant ship together. reports/v-drift-fixture.md has the pre-D13 numbers,
 * reports/v-core-scoring.md the post-D13 ones, and
 * `apps/extension/e2e/content/tests/identity-resolution.spec.ts` pins 0.389 and
 * 0.366 in real Chromium.
 *
 * `renamed-redesign` is the step past `reworded-aria`, and the one drift the
 * matcher is meant to refuse: the same redesign without the aria-label, and
 * the label renamed to "Apply changes", so nothing the recording knew Save by
 * survives -- not its id, test id, class, text or accessible name. Measured in
 * Chromium against the authored recording, it still ranks first, at -0.104
 * with Discard at -0.360 and confidence 0: 0.454 under the 0.35 floor, so the
 * resolver refuses it on the replay path and on the Flow path's recorded point
 * alike (`identity-resolution.spec.ts` pins both).
 *
 * It exists for the LLM repair loop. A provider-free run must fail it with
 * `target_not_found`; a person, or a model reading the sanitized evidence,
 * still sees exactly one submit control in Save's slot, named "Apply
 * changes", beside a reset named "Discard changes". Pressing it saves, so a
 * run that repairs the target passes Save's own oracle, and pressing Discard
 * writes "Changes discarded", which does not.
 *
 * `save-and-exit` is not a drift of Save but the negative case beside them:
 * Save is gone, and its slot holds a lone "Save changes and exit" with no id,
 * class or test id -- a different action whose name contains the recorded one.
 * Against the authored recording it scored 0.359 at confidence 0.337 and was
 * clicked (reports/i-resolver-safety.md, row R7, a single observation), so its
 * variant expects `target_not_found`, and pressing it records an operation of
 * its own rather than a save.
 */
export const identityDriftModes = ["baseline", "selector-only", "text-only", "moved", "wrapped-aria", "reworded-aria", "renamed-redesign", "save-and-exit"] as const;

export type IdentityDriftMode = (typeof identityDriftModes)[number];

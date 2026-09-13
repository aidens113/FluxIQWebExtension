/**
 * How the settings page renders its "Save changes" action. `baseline` is what
 * the recording sees; each other mode is one identity drift.
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
 */
export const identityDriftModes = ["baseline", "selector-only", "text-only", "moved", "wrapped-aria", "reworded-aria"] as const;

export type IdentityDriftMode = (typeof identityDriftModes)[number];

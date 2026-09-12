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
 * lookup -- where, measured, it is ranked first by a wide margin and refused
 * anyway, because the score floor sits above anything this page can reach.
 * reports/v-drift-fixture.md has the numbers.
 */
export const identityDriftModes = ["baseline", "selector-only", "text-only", "moved", "wrapped-aria", "reworded-aria"] as const;

export type IdentityDriftMode = (typeof identityDriftModes)[number];

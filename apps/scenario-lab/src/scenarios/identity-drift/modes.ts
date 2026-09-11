/**
 * How the settings page renders its "Save changes" action. `baseline` is what
 * the recording sees; each other mode is one corpus variant's identity drift
 * (W20-W23).
 */
export const identityDriftModes = ["baseline", "selector-only", "text-only", "moved", "wrapped-aria"] as const;

export type IdentityDriftMode = (typeof identityDriftModes)[number];

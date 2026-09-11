import { defineScenario } from "../../types.js";
import { identityDriftManifest } from "./manifest.js";
import { renderIdentityDriftPage } from "./render.js";
import { createIdentityDriftState, mutateIdentityDriftState, type IdentityDriftState } from "./state.js";

/**
 * A workspace settings page whose "Save changes" action drifts in identity by
 * mode (corpus rows W20-W23). The recording sees the baseline; each variant
 * arms one drift through `set-mode`, and the saved state is the oracle.
 */
export const identityDriftScenario = defineScenario<IdentityDriftState>({
  id: "identity-drift",
  title: "Identity drift",
  startPath: "/scenarios/identity-drift/",
  seed: 121,
  manifest: identityDriftManifest,
  createState: createIdentityDriftState,
  mutate: mutateIdentityDriftState,
  render: renderIdentityDriftPage,
});

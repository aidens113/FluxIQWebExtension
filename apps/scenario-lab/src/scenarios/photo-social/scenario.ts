import { defineScenario } from "../../types.js";
import { photoSocialManifest } from "./manifest.js";
import { renderPhotoHome, routePhotoSocial } from "./route.js";
import { createPhotoState, mutatePhotoState } from "./state.js";
import type { PhotoState } from "./types.js";

/**
 * Framelight, a photo-sharing network built the way the real ones are, mess
 * included. What the site holds never depends on the lab seed; how it is
 * styled does, down to every class name and generated id, so a Flow cannot
 * lean on either. Every relative label is measured from the site's own fixed
 * clock, so a run on any day reads the same page.
 */
export const photoSocialScenario = defineScenario<PhotoState>({
  id: "photo-social",
  title: "Photo social",
  startPath: "/scenarios/photo-social/",
  seed: 238,
  manifest: photoSocialManifest,
  createState: () => createPhotoState(),
  mutate: mutatePhotoState,
  render: renderPhotoHome,
  route: routePhotoSocial,
});

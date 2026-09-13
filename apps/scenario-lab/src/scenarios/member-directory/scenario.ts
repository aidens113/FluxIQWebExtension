import { defineScenario } from "../../types.js";
import { memberDirectoryManifest } from "./manifest.js";
import { renderDirectoryPage } from "./markup.js";
import { createDirectoryState, mutateDirectoryState } from "./state.js";
import type { MemberDirectoryState } from "./types.js";

/**
 * A workspace members console the size of a real one: an application shell
 * around a 240-row table, every class name a build hash, one action button per
 * row identical to the other 239, a portalled menu and dialog, and two fixed
 * surfaces that can be painted over controls the DOM still calls clickable.
 *
 * Nothing here depends on the lab seed. The roster is authored, the manifest's
 * expected records are literal text, and both must read the same on every run.
 */
export const memberDirectoryScenario = defineScenario<MemberDirectoryState>({
  id: "member-directory",
  title: "Member directory",
  startPath: "/scenarios/member-directory/",
  seed: 137,
  manifest: memberDirectoryManifest,
  createState: () => createDirectoryState(),
  mutate: mutateDirectoryState,
  render: renderDirectoryPage,
});

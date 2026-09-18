import { defineScenario } from "../../types.js";
import { socialInboxManifest } from "./manifest.js";
import { renderInboxPage } from "./markup.js";
import { routeInbox } from "./route.js";
import { createInboxState, mutateInboxState } from "./state.js";
import type { InboxState } from "./types.js";

/**
 * A social inbox the size of a real one: an application shell around 320
 * mentions, comments and direct messages across six watched accounts, of which
 * three share a display name *and* a handle and differ only by network. Every
 * class name is a build hash, twenty-five rows are on screen and the rest come
 * from a control that loads older ones, and the three controls on a row are
 * identical to the three on every other row.
 *
 * Nothing here depends on the lab seed. The conversations are authored, every
 * age is measured from the inbox's own fixed reference time rather than the
 * wall clock, and the manifest's expected records are literal text, so a run
 * at any hour of any day reads the same page.
 */
export const socialInboxScenario = defineScenario<InboxState>({
  id: "social-inbox",
  title: "Social inbox",
  startPath: "/scenarios/social-inbox/",
  seed: 172,
  manifest: socialInboxManifest,
  createState: () => createInboxState(),
  mutate: mutateInboxState,
  render: renderInboxPage,
  route: (state, request) => routeInbox(state, request),
});

import { defineScenario } from "../../types.js";
import { supportDeskManifest } from "./manifest.js";
import { renderDeskPage } from "./markup.js";
import { routeSupportDesk } from "./route.js";
import { createSupportDeskState, mutateSupportDeskState } from "./state.js";
import type { SupportDeskState } from "./types.js";

/**
 * A support desk the size of a real one: a 320-ticket queue in an application
 * shell, every class name a build hash, one action button per row identical to
 * the other 319, a detail pane fetched from the desk when a ticket is opened,
 * and a second screen where an escalation is raised against a reference that
 * appears nowhere but the queue.
 *
 * Every workflow here changes something or reads something a single page does
 * not hold, which is the point of the fixture: a run is judged on the state it
 * left behind, not only on what it managed to read.
 *
 * Nothing depends on the lab seed. The queue is authored, the manifest's
 * expected records are literal text, and both must read the same on every run.
 */
export const supportDeskScenario = defineScenario<SupportDeskState>({
  id: "support-desk",
  title: "Support desk",
  startPath: "/scenarios/support-desk/",
  seed: 141,
  manifest: supportDeskManifest,
  createState: () => createSupportDeskState(),
  mutate: mutateSupportDeskState,
  render: renderDeskPage,
  route: routeSupportDesk,
});

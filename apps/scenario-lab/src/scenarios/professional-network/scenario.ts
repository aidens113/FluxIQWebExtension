import { defineScenario } from "../../types.js";
import { professionalNetworkManifest } from "./manifest.js";
import { renderNetworkStart, routeNetwork } from "./route.js";
import { createNetworkState, mutateNetworkState } from "./state.js";
import type { ProfessionalNetworkState } from "./types.js";

/**
 * Guildline, a professional network built to be as awkward to automate as the
 * real kind: the whole site -- feed, people search, invitation manager,
 * profiles, messaging overlay -- behind one start page, with its data authored
 * and its every age measured from a fixed reference time. The lab seed changes
 * only how the page is dressed: generated class names and element ids. What a
 * page says, and what every oracle expects, is the same on every seed.
 */
export const professionalNetworkScenario = defineScenario<ProfessionalNetworkState>({
  id: "professional-network",
  title: "Professional network",
  startPath: "/scenarios/professional-network/",
  seed: 4303,
  manifest: professionalNetworkManifest,
  createState: () => createNetworkState(),
  mutate: mutateNetworkState,
  render: renderNetworkStart,
  route: routeNetwork,
});

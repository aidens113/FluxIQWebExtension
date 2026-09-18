import { defineScenario } from "../../types.js";
import { socialSchedulerManifest } from "./manifest.js";
import { renderSchedulerPage } from "./markup.js";
import { routeScheduler } from "./route.js";
import { createSchedulerState, mutateSchedulerState } from "./state.js";
import type { SchedulerState } from "./types.js";

/**
 * A social publishing console the size of a real one: an application shell
 * around a 280-row queue across eight connected accounts, every class name a
 * build hash, one action button per row identical to the other 279, a composer
 * the page ships collapsed, and two connected accounts that share a display
 * name and differ only by network and handle.
 *
 * Nothing here depends on the lab seed. The queue is authored, every relative
 * label is measured from the console's own fixed reference time rather than
 * the wall clock, and the manifest's expected records are literal text, so a
 * run at any hour of any day reads the same page.
 */
export const socialSchedulerScenario = defineScenario<SchedulerState>({
  id: "social-scheduler",
  title: "Social scheduler",
  startPath: "/scenarios/social-scheduler/",
  seed: 171,
  manifest: socialSchedulerManifest,
  createState: () => createSchedulerState(),
  mutate: mutateSchedulerState,
  render: renderSchedulerPage,
  route: (state, request) => routeScheduler(state, request),
});

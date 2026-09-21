import { defineScenario } from "../../types.js";
import { defaultFeedQuery } from "./catalog/index.js";
import { localClassifiedsManifest } from "./manifest.js";
import { pageBuild, resultsPage } from "./pages/index.js";
import { routeClassifieds } from "./route.js";
import { createClassifiedsState, mutateClassifiedsState } from "./state.js";
import type { ClassifiedsState } from "./types.js";

/**
 * Kerbfind Marketplace: a fictional local-classifieds site modelled on the
 * kind people automate every day, set in the fictional town of Kelford. The
 * account is signed in, has two conversations going and two listings saved.
 *
 * The listings, the prices, the places and every expected answer are authored
 * and never depend on the lab seed. The seed decides what a real deployment
 * would vary between sessions: every class name and id, where the adverts and
 * the repeated card fall in a feed, which batch fails, and how long each of
 * the site's timed interruptions takes to arrive.
 */
export const localClassifiedsScenario = defineScenario<ClassifiedsState>({
  id: "local-classifieds",
  title: "Local classifieds",
  startPath: "/scenarios/local-classifieds/",
  seed: 44,
  manifest: localClassifiedsManifest,
  createState: () => createClassifiedsState(),
  mutate: (state, operation, payload) => mutateClassifiedsState(state, operation, payload, Date.now()),
  render: (state, context) => resultsPage(pageBuild(context.seed, context.runToken, context.alternateOrigin), state, defaultFeedQuery("home")),
  route: (state, request, context) => routeClassifieds(state, request, context, Date.now()),
});

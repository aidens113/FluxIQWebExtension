// `pnpm ui:e2e` opens a real browser on Scenario Lab pages, so it is held to
// the ten realistic scenarios like every other browser test run
// (`../realistic-scenarios/index.ts`). The entry point asks this before it
// prepares a workspace or starts anything; the demo browser session refuses
// again, by the page it is about to open, if a journey opens a scenario its
// row here does not name.
import { unrealisticScenarioRefusal } from "../realistic-scenarios/index.js";
import { RECORDED_TASKS } from "./journeys/index.js";
import { selectUiE2eJourneys, type UiE2eArguments, type UiE2eJourneyId } from "./journey-selection.js";

/**
 * The scenarios each journey opens in its browser. A journey that is not wired
 * opens none. F2's is the extraction journey's default scenario; F4 reruns the
 * Flows F2 and F3 saved, on their scenarios.
 */
export const UI_E2E_JOURNEY_SCENARIOS: Readonly<Record<UiE2eJourneyId, readonly string[]>> = Object.freeze({
  F1: [RECORDED_TASKS["missing-target"].scenarioId],
  F2: ["product-catalog"],
  F3: [RECORDED_TASKS["missing-target"].scenarioId],
  F4: ["product-catalog", RECORDED_TASKS["missing-target"].scenarioId],
  P1: [], P2: [], P3: [], P4: [], P5: [], P6: [],
});

/** The refusal for a run whose selected journeys open a scenario outside the ten, or `null` when none does. */
export function uiE2eScenarioRefusal(args: Pick<UiE2eArguments, "lane" | "journeys">): string | null {
  const opened = selectUiE2eJourneys(args).journeys
    .filter(journey => journey.selected && journey.laneSelected)
    .flatMap(journey => UI_E2E_JOURNEY_SCENARIOS[journey.definition.id]);
  return unrealisticScenarioRefusal(opened, "pnpm ui:e2e");
}

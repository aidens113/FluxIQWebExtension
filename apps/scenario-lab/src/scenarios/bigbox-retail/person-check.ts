import type { ScenarioPersonChecks } from "@fluxiq-web-extension/test-contracts";
import { ROBOT_CHECK_HOLD_MS, ROBOT_CHECK_WAIT_MS } from "./state/index.js";

/**
 * "Robot or human?", as a person passes it when asked: press and hold the
 * button for two seconds (`pages/robot-check-page.ts`). A click does not pass
 * it, however many.
 *
 * It is not person-only: left alone it counts down and passes itself, so an
 * automation that waits gets through without anyone, and the honest
 * `pickup-towels` script only waits. The Lab holds the button only when FluxIQ
 * has asked a person anyway, which is why no row declares a hand-off here.
 */
export const PERSON_CHECKS: ScenarioPersonChecks = Object.freeze({
  scenarioId: "bigbox-retail",
  checks: Object.freeze([
    Object.freeze({
      id: "press-and-hold",
      description: "Robot or human? A Press & Hold button that passes when held for two seconds, and passes by itself after a countdown.",
      shows: "Robot or human?",
      steps: Object.freeze([Object.freeze({ action: "press-and-hold" as const, text: "Press & Hold", holdMs: ROBOT_CHECK_HOLD_MS + 500 })]),
      clears: "navigation" as const,
      clearsWithinMs: ROBOT_CHECK_WAIT_MS,
    }),
  ]),
  handOffs: Object.freeze([]),
});

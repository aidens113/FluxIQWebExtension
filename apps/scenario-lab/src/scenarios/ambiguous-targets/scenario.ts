import { defineScenario } from "../../types.js";
import { ambiguousTargetsManifest } from "./manifest.js";
import { readAmbiguousTargetsMode, type AmbiguousTargetsMode } from "./modes.js";
import { renderAmbiguousTargets } from "./render.js";

/**
 * `mode` is absent until the fixture is armed. Arming is an override, so what
 * an unarmed run publishes must be exactly what it published before the
 * variant existed: the oracle shape is part of this fixture's contract with
 * every consumer, and a variant is not a reason to change it.
 */
export type AmbiguousTargetsState = { selected: string | null; mode?: AmbiguousTargetsMode };

export const ambiguousTargetsScenario = defineScenario<AmbiguousTargetsState>({
  id: "ambiguous-targets", title: "Ambiguous targets", startPath: "/scenarios/ambiguous-targets/",
  seed: 106,
  manifest: ambiguousTargetsManifest,
  createState: () => ({ selected: null }),
  mutate(state, operation, payload) {
    if (operation === "choose") return isRecord(payload) && typeof payload.id === "string" ? { ...state, selected: payload.id } : state;
    const mode = operation === "set-mode" ? readAmbiguousTargetsMode(payload) : undefined;
    // Arming clears the recording's choice, so a stale `primary` can never
    // stand in for the armed run's own outcome.
    return mode ? { selected: null, mode } : state;
  },
  render(state, context) {
    return renderAmbiguousTargets(state.mode ?? "baseline", context.runToken);
  },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

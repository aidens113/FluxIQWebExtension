import { defineScenario } from "../../types.js";
import { failureSurfacesManifest } from "./manifest.js";
import { readFailureSurfacesMode, type FailureSurfacesMode } from "./modes.js";
import { renderBlockedDestination, renderFailureSurfaces } from "./render.js";

/** `mode` is absent until the fixture is armed; see `ambiguous-targets` for why. */
export type FailureSurfacesState = { lastFailure: string | null; attempts: number; mode?: FailureSurfacesMode };

export const failureSurfacesScenario = defineScenario<FailureSurfacesState>({
  id: "failure-surfaces", title: "Failure surfaces", startPath: "/scenarios/failure-surfaces/",
  seed: 108,
  manifest: failureSurfacesManifest,
  createState: () => ({ lastFailure: null, attempts: 0 }),
  mutate(state, operation, payload) {
    if (operation === "attempt") {
      return isRecord(payload) && typeof payload.kind === "string" ? { ...state, lastFailure: payload.kind, attempts: state.attempts + 1 } : state;
    }
    const mode = operation === "set-mode" ? readFailureSurfacesMode(payload) : undefined;
    // Arming clears what the recording did, so a detach the recording performed
    // can never stand in for the armed run's own outcome.
    return mode ? { lastFailure: null, attempts: 0, mode } : state;
  },
  render(state, context) {
    return renderFailureSurfaces(state.mode ?? "baseline", context.runToken);
  },
  route(_state, request) {
    if (request.subpath !== "blocked") return undefined;
    return {
      status: 403,
      body: renderBlockedDestination(request.query.get("to")),
      mutation: { operation: "attempt", payload: { kind: "blocked-url" } },
    };
  },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

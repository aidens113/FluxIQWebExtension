// Whether a run's failure is FluxIQ's, not the facility's.
//
// `runScenario` projects a facility failure for any error that arrived before
// FluxIQ reported a verdict, because an error with no verdict used to mean the
// rig broke before the product was ever judged. It does not: the created-Flow
// lane raises `runtime.behavior` for a build that ended without a Flow, and
// that run is FluxIQ failing at its job, with the facility working exactly as
// it should. `run-muntc23v-7fcc4110` ended `flow_bootstrap.evidence_unusable_decision`
// and was stamped `facilityFailure: scenario.execute / unclassified`, which
// sends the next reader to look for a Lab defect that was never there.
//
// Only `runtime.behavior` is read as the product's: it is the class the lanes
// raise for what the product did. Every other category -- a browser that
// crashed, a server that did not answer, a gateway that would not pair -- stays
// the facility's and is projected as before.

import { RunnerFailure } from "../failure.js";

/**
 * The product failure's own category, published beside the run's failure.
 *
 * - `flow_lane.flow_not_built` -- a Flow-lane run whose build ended without a
 *   Flow. `buildFailureCode` is Core's closed code for why, when it gave one.
 * - `flow_lane.product_behavior` -- any other product failure the Flow lane
 *   raised before FluxIQ reported a verdict.
 * - `recording_lane.product_behavior` -- the same on the recording lane.
 */
export type ProductFailure = Readonly<{
  code: "flow_lane.flow_not_built" | "flow_lane.product_behavior" | "recording_lane.product_behavior";
  buildFailureCode?: string;
}>;

/** A closed Core code, never a message: lowercase words joined by dots and underscores. */
const CLOSED_CODE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/;
const MAX_CODE_LENGTH = 96;

/**
 * The product failure `error` is, or `undefined` when it is the facility's.
 *
 * `flowCreated` is what the Flow lane published before the error, when it
 * published anything: a lane that never did built no Flow either.
 */
export function productFailureOf(error: unknown, lane: { flowLane: boolean; flowCreated: boolean | null | undefined }): ProductFailure | undefined {
  if (!(error instanceof RunnerFailure) || error.category !== "runtime.behavior") return undefined;
  if (!lane.flowLane) return Object.freeze({ code: "recording_lane.product_behavior" });
  if (lane.flowCreated === true) return Object.freeze({ code: "flow_lane.product_behavior" });
  const buildFailureCode = closedCode(buildFailureCodeOf(error));
  return Object.freeze({ code: "flow_lane.flow_not_built", ...(buildFailureCode ? { buildFailureCode } : {}) });
}

/** `details.failure.code`, as the created-Flow lane attaches Core's build failure. */
function buildFailureCodeOf(error: RunnerFailure): unknown {
  const failure = error.details?.failure;
  return failure && typeof failure === "object" ? (failure as { code?: unknown }).code : undefined;
}

function closedCode(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= MAX_CODE_LENGTH && CLOSED_CODE.test(value) ? value : undefined;
}

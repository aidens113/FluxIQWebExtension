import {
  FACILITY_FAILURE_ENDPOINT_PATTERN,
  FACILITY_FAILURE_REFUSAL_MAX_LENGTH,
  isScreenedFacilityRefusal,
  type FacilityFailureDiagnostic,
} from "@fluxiq-web-extension/test-contracts";
import { redactText } from "@fluxiq-web-extension/test-evidence";
import { RunnerFailure } from "../failure.js";

/** How many `RunnerFailure` causes are followed to find the control request Core refused. */
const MAX_CAUSE_DEPTH = 4;

/**
 * The `core.refused` fields of a Lab control request Core answered with a 4xx,
 * or `undefined` when the error is not one.
 *
 * The control client (`http-control`, `FluxIQControlClient.request`) throws a
 * `RunnerFailure` whose details are the route, the status and Core's own
 * `error` sentence, and `existing-fluxiq-control` rewraps a 400 as
 * `facility.contract` with the same details; either may be wrapped again, so
 * `RunnerFailure` causes are followed a few levels. The route must be a Core
 * API route and the status an integer 4xx, or nothing is projected. Core's
 * sentence is kept only when the evidence redaction leaves it unchanged and it
 * passes the contract's screening (`isScreenedFacilityRefusal`) once bounded;
 * otherwise it is dropped and the route and status still say what happened.
 * A hostile getter throws out of here; the projector's `safeProjection` turns
 * that into `unclassified`, as it does for every other projector.
 */
export function coreRefusalFailure(error: unknown): Pick<FacilityFailureDiagnostic, "reason" | "endpoint" | "httpStatus" | "refusal"> | undefined {
  let current: unknown = error;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH && current instanceof RunnerFailure; depth += 1) {
    const details = current.details;
    const endpoint = details?.path;
    const status = details?.status;
    if (typeof endpoint === "string" && FACILITY_FAILURE_ENDPOINT_PATTERN.test(endpoint)
      && typeof status === "number" && Number.isSafeInteger(status) && status >= 400 && status <= 499) {
      const refusal = screenedRefusal(details?.reason);
      return { reason: "core.refused", endpoint, httpStatus: status, ...(refusal === undefined ? {} : { refusal }) };
    }
    current = current.cause;
  }
  return undefined;
}

function screenedRefusal(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const line = value.replace(/\s+/gu, " ").trim();
  // A sentence the redaction would change, or the screening refuses, carried a
  // secret: it is dropped whole, never cut around.
  if (!line || redactText(line) !== line || !isScreenedFacilityRefusal(line, Number.POSITIVE_INFINITY)) return undefined;
  if (line.length <= FACILITY_FAILURE_REFUSAL_MAX_LENGTH) return line;
  const bounded = `${line.slice(0, FACILITY_FAILURE_REFUSAL_MAX_LENGTH - 1).trimEnd()}…`;
  return isScreenedFacilityRefusal(bounded) ? bounded : undefined;
}

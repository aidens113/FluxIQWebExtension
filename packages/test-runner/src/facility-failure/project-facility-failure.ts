import {
  FACILITY_FAILURE_ENDPOINT_PATTERN,
  facilityFailureCauseCodes,
  facilityFailureOperationStages,
  type FacilityFailureBoundary,
  type FacilityFailureDiagnostic,
  type FacilityFailureOperationStage,
  type FacilityFailureStage,
} from "@fluxiq-web-extension/test-contracts";
import { finalizedRecordingWaitFailureDetails } from "../flow-lane/index.js";
import { boundedRunnerCause, RunnerFailure } from "../failure.js";
import { httpTransportFailureDetails, topologyReadinessFailureDetails } from "../http-control/index.js";
import { pairingStatusWaitFailureDetails } from "../run-lifecycle/index.js";
import { ProjectedFacilityError } from "./projected-facility-error.js";

const CAUSE_CODES = new Set<string>(facilityFailureCauseCodes);
const OPERATION_STAGES = new Set<string>(facilityFailureOperationStages);
const READINESS_STAGES = new Set<string>(["scenario.health", "core.health"]);

/** Projects an error to the evaluation contract's closed, secret-free vocabulary. */
export function projectFacilityFailure(
  error: unknown,
  boundary: FacilityFailureBoundary,
  stage: FacilityFailureStage,
): FacilityFailureDiagnostic {
  if (error instanceof ProjectedFacilityError) return error.facilityFailure;

  const readiness = safeProjection(() => topologyReadinessFailureDetails(error));
  if (readiness) {
    const operationStage = operationStageOf(readiness.operationStage, true);
    const timeoutMs = timeoutOf(readiness.timeoutMs);
    if (operationStage && timeoutMs !== undefined) return frozen({ boundary, stage, reason: "readiness.timeout", operationStage, timeoutMs });
  }

  const transport = safeProjection(() => httpTransportFailureDetails(error));
  if (transport) {
    const operationStage = operationStageOf(transport.operationStage, false);
    const causeCode = causeCodeOf(transport.transportCode);
    if (operationStage) return frozen({ boundary, stage, reason: "http.transport", operationStage, ...(causeCode ? { causeCode } : {}), ...endpointOf(error instanceof RunnerFailure ? error.details?.path : undefined) });
  }

  const boundedHttp = boundedHttpFailure(error);
  if (boundedHttp) return frozen({ boundary, stage, ...boundedHttp });

  // These established projectors are intentionally consulted, but their ids,
  // status snapshots and recording counts are outside the evaluation contract.
  // Recognition therefore remains the closed `unclassified` reason.
  const knownWait = safeProjection(() => finalizedRecordingWaitFailureDetails(error))
    ?? safeProjection(() => pairingStatusWaitFailureDetails(error));
  if (knownWait) return frozen({ boundary, stage, reason: "unclassified" });

  const cause = boundedRunnerCause(error);
  if (cause?.kind === "module.missing" && CAUSE_CODES.has(cause.code)) return frozen({ boundary, stage, reason: "module.missing", causeCode: cause.code as NonNullable<FacilityFailureDiagnostic["causeCode"]> });
  if (cause?.kind === "path.missing") return frozen({ boundary, stage, reason: "path.missing", causeCode: "ENOENT" });
  if (cause?.kind === "path.denied" && (cause.code === "EACCES" || cause.code === "EPERM")) return frozen({ boundary, stage, reason: "path.denied", causeCode: cause.code });
  return frozen({ boundary, stage, reason: "unclassified" });
}

function boundedHttpFailure(error: unknown): Pick<FacilityFailureDiagnostic, "reason" | "operationStage" | "timeoutMs" | "endpoint"> | undefined {
  if (!(error instanceof RunnerFailure)) return undefined;
  try {
    const details = error.details;
    const operationStage = operationStageOf(details?.operationStage, false);
    if (!operationStage) return undefined;
    if (error.message === "FluxIQ HTTP operation was interrupted" && details?.bounded === "abort") return { reason: "http.abort", operationStage, ...endpointOf(details?.path) };
    const timeoutMs = timeoutOf(details?.timeoutMs);
    return error.message === "FluxIQ HTTP operation timed out" && details?.bounded === "timeout" && timeoutMs !== undefined
      ? { reason: "http.timeout", operationStage, timeoutMs, ...endpointOf(details?.path) }
      : undefined;
  } catch {
    return undefined;
  }
}

/** The Core route a bounded HTTP failure went to, when it is one; anything else is left out rather than carried. */
function endpointOf(value: unknown): { endpoint?: string } {
  return typeof value === "string" && FACILITY_FAILURE_ENDPOINT_PATTERN.test(value) ? { endpoint: value } : {};
}

function operationStageOf(value: unknown, readiness: boolean): FacilityFailureOperationStage | undefined {
  if (typeof value !== "string" || !OPERATION_STAGES.has(value) || READINESS_STAGES.has(value) !== readiness) return undefined;
  return value as FacilityFailureOperationStage;
}

function causeCodeOf(value: unknown): FacilityFailureDiagnostic["causeCode"] | undefined {
  return typeof value === "string" && CAUSE_CODES.has(value) ? value as FacilityFailureDiagnostic["causeCode"] : undefined;
}

function timeoutOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 300_000 ? value : undefined;
}

function safeProjection(project: () => Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> | undefined {
  try { return project(); } catch { return undefined; }
}

function frozen(value: FacilityFailureDiagnostic): FacilityFailureDiagnostic {
  return Object.freeze(value);
}

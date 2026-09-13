// Why FluxIQ refused a `client.start_recording`, and whether waiting can fix it.
//
// Two failures that need opposite responses arrive under the single wire code
// `recording.project_required`. Core's resolver
// (`F:\!FluxIQ\apps\web\src\lib\automation-studio-context.ts`,
// `resolveClientRecordingProject`) refuses on
//
//     !context?.activeProjectId || !isFresh
//
// where `isFresh` is `now - context.updatedAt < 10_000`. So a refusal that
// still names an `activeProjectId` can only have come from the freshness half:
// the operator does have a project open in Automation Studio and its context
// stamp has merely aged out. Nothing about the extension's request is wrong,
// and the identical request succeeds once that context is stamped again --
// transient. A refusal naming no active project means nobody has chosen one.
// No amount of retrying changes that; it is the user's move, and a retry loop
// would only hide the one message that tells them to make it -- persistent.
//
// `recording.project_context_mismatch` is a third case and also persistent:
// Core has a fresh project and it is not the one the extension asked for.
// Re-sending the same request re-sends the same wrong project, so a retry is a
// guaranteed loop.
//
// What separates them is metadata Core already puts on the wire:
// `apps/web/src/lib/fluxiq.ts` attaches `activeProjectId` and
// `contextUpdatedAt`, and `client-gateway/bridge.ts` forwards them on the
// `server.error` payload. The extension does not have to guess.

import type { RecordingBlockState } from "../../../shared/protocol";
import { objectValue, stringValue } from "../value-readers";

export type RecordingStartRefusalKind = "transient" | "persistent";

export type RecordingStartRefusalReason = "context_stale" | "project_not_selected" | "project_mismatch";

export type RecordingStartRefusal = {
  readonly code: string;
  // Whether re-sending the same start can plausibly succeed. Only "transient"
  // may be retried, and only a bounded number of times.
  readonly kind: RecordingStartRefusalKind;
  readonly reason: RecordingStartRefusalReason;
  readonly title: string;
  readonly message: string;
  // What the status line says while the block is up. Kept beside the block so
  // dismissing the block can clear exactly this error and no other.
  readonly lastError: string;
  // The activity-log detail written when the refusal is surfaced.
  readonly detail: string;
};

export type RecordingStartErrorPayload = {
  readonly message: string;
  readonly code?: string | undefined;
  readonly metadata?: unknown;
};

const PROJECT_REQUIRED = "recording.project_required";
const PROJECT_MISMATCH = "recording.project_context_mismatch";

const PROJECT_NOT_SELECTED_ERROR = "Open a FluxIQ project before recording.";
const CONTEXT_STALE_ERROR = "FluxIQ's project context went stale before recording could start.";
const PROJECT_MISMATCH_ERROR = "FluxIQ has a different project open than the one this recording asked for.";

const REFUSAL_ERRORS = new Set([PROJECT_NOT_SELECTED_ERROR, CONTEXT_STALE_ERROR, PROJECT_MISMATCH_ERROR]);

// Returns undefined for anything that is not a recording-start refusal, so the
// caller keeps its existing handling for every other server error.
export function classifyRecordingStartRefusal(payload: RecordingStartErrorPayload): RecordingStartRefusal | undefined {
  const code = payload.code;
  if (code !== PROJECT_REQUIRED && code !== PROJECT_MISMATCH) return undefined;
  const metadata = objectValue(payload.metadata);
  const activeProjectId = stringValue(metadata?.activeProjectId)?.trim();

  if (code === PROJECT_MISMATCH) {
    return {
      code,
      kind: "persistent",
      reason: "project_mismatch",
      title: "Project Mismatch",
      message: payload.message || "FluxIQ has a different project open than the one this recording asked for. Switch project in the web panel, then start the recording again.",
      lastError: PROJECT_MISMATCH_ERROR,
      detail: "Switch project in the web panel, then start the recording again."
    };
  }

  if (activeProjectId) {
    return {
      code,
      kind: "transient",
      reason: "context_stale",
      title: "FluxIQ Is Catching Up",
      message: "FluxIQ has a project open but its Automation Studio context is stale, so it refused the recording start. Bring the FluxIQ Automation Studio tab to the front, then start the recording again.",
      lastError: CONTEXT_STALE_ERROR,
      detail: "Bring the FluxIQ Automation Studio tab to the front, then start the recording again."
    };
  }

  return {
    code,
    kind: "persistent",
    reason: "project_not_selected",
    title: "Project Required",
    message: payload.message || "Open a FluxIQ project in the web panel before starting a recording.",
    lastError: PROJECT_NOT_SELECTED_ERROR,
    detail: "Open a FluxIQ project in the web panel."
  };
}

// The blocking panel state for a refusal the extension has stopped fighting.
// `attempts` is how many starts were sent in total, so an exhausted transient
// refusal says so rather than reading like a first refusal.
export function recordingStartRefusalBlock(refusal: RecordingStartRefusal, attempts: number): RecordingBlockState {
  return {
    code: refusal.code,
    title: refusal.title,
    message: attempts > 1 ? `${refusal.message} (Retried ${attempts - 1} time${attempts === 2 ? "" : "s"}.)` : refusal.message
  };
}

// Whether a status-line error came from a refusal, so dismissing the block
// clears that error and leaves any newer, unrelated one alone.
export function isRecordingStartRefusalError(value: string | undefined): boolean {
  return value !== undefined && REFUSAL_ERRORS.has(value);
}

import { RunnerFailure } from "../failure.js";
import type { FluxIQHttpOptions } from "../http-control.js";

/** The single Core call this makes; `ExistingFluxIQControlClient` satisfies it. */
export type RecordingCompletenessControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
};

export type RecordingCompletenessInput = {
  projectId: string | undefined;
  /** The recordings this run produced, each already finalized. */
  recordingIds: readonly string[];
  /** The extension's `status.eventCount` as the runner read it before Stop, unchecked: a count it did not report fails closed here. */
  extensionActionCount: unknown;
};

/** The two counts compared, `null` where one could not be read, and the failure they amount to, if any. */
export type RecordingCompleteness = { extensionActions: number | null; coreActions: number | null; failure: RunnerFailure | undefined };

/**
 * Whether Core's recording holds every executable action the extension recorded.
 *
 * The extension counts each executable action it records, from zero at the
 * start of a recording (`ActiveRecording.eventCount`, published as
 * `status.eventCount`), and the runner reads that count before Stop. Core's
 * count is read once from the full session of each recording this run
 * produced (`get-recording`), with Core's own test for an action entry
 * (`recordingEntryIsActionLike`). The index summary the finalization wait polls
 * carries only a total entry count, which evidence entries also make up, so it
 * cannot show an action missing. Nor can Core's discard audit show an action
 * that never reached a recording at all: the recording lane passed smoke W01
 * twice with a recording of 0 entries.
 *
 * - Core holding fewer actions than the extension recorded fails as
 *   `recording.persistence`, naming the two counts and nothing recorded.
 * - Core holding more does not fail: an action the page emits between the read
 *   and Stop reaches Core but not the count.
 * - A count that cannot be read fails closed rather than ruling a loss out
 *   unread: the extension's as `extension.worker`, Core's as
 *   `recording.persistence`.
 */
export async function readRecordingCompleteness(control: RecordingCompletenessControl, input: RecordingCompletenessInput, bounds: FluxIQHttpOptions = {}): Promise<RecordingCompleteness> {
  const extensionActions = count(input.extensionActionCount);
  const core = await coreActionCount(control, input, bounds);
  const coreActions = "actions" in core ? core.actions : null;
  if (extensionActions === null) {
    return { extensionActions, coreActions, failure: new RunnerFailure("extension.worker", "The extension reported no count of the actions it recorded, so a recording Core holds short cannot be ruled out") };
  }
  if (!("actions" in core)) {
    return { extensionActions, coreActions, failure: new RunnerFailure("recording.persistence", `Core's recording ${core.unreadable} could not be read in full, so an action it does not hold cannot be ruled out`, core.cause === undefined ? {} : { cause: core.cause }) };
  }
  const failure = core.actions < extensionActions
    ? new RunnerFailure("recording.persistence", `Core's recording holds ${core.actions} of the ${extensionActions} actions the extension recorded`, { details: { extensionActions, coreActions: core.actions } })
    : undefined;
  return { extensionActions, coreActions: core.actions, failure };
}

type CoreActionCount = { actions: number } | { unreadable: string; cause?: unknown };

async function coreActionCount(control: RecordingCompletenessControl, input: RecordingCompletenessInput, bounds: FluxIQHttpOptions): Promise<CoreActionCount> {
  let actions = 0;
  for (const recordingId of input.recordingIds) {
    let payload: unknown;
    try {
      payload = await control.automationStudioCall("get-recording", { ...(input.projectId === undefined ? {} : { projectId: input.projectId }), recordingId }, bounds);
    } catch (cause) {
      return { unreadable: recordingId, cause };
    }
    const timeline = sessionTimeline(payload, recordingId);
    if (!timeline) return { unreadable: recordingId };
    actions += timeline.filter(isActionEntry).length;
  }
  return { actions };
}

/** Accepts Core's envelope, `automationStudioCall`'s unwrapped `{ recording }`, or a bare session; a session for another recording is no answer. */
function sessionTimeline(payload: unknown, recordingId: string): unknown[] | undefined {
  const outer = record(payload);
  const session = record(outer?.recording) ?? record(record(outer?.payload)?.recording) ?? outer;
  if (typeof session?.recordingId === "string" && session.recordingId !== recordingId) return undefined;
  return Array.isArray(session?.timeline) ? session.timeline : undefined;
}

/** Core's `recordingEntryIsActionLike` (`runtime/service.ts`), which its own summaries count actions with. */
function isActionEntry(entry: unknown): boolean {
  const fields = record(entry);
  if (!fields) return false;
  if (fields.type === "action" || fields.type === "client_action" || fields.type === "recorded_action" || fields.type === "interaction") return true;
  if (typeof fields.actionType === "string" && fields.actionType.trim()) return true;
  return record(fields.action) !== undefined;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

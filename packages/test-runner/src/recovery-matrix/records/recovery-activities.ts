// The recovery rows Core's live activity stream said about a run, in closed
// words.
//
// A recovery that settled on a run step is announced as one `step` activity
// carrying a closed `recovery` detail (`ClientGatewayActivityRecovery`: kind,
// subject, outcome), the row the extension's chat draws its recovery card from
// (Core `runtime/activity/step/recovery.ts`). A stale target found again (t786)
// is one such row, of kind `reacquire`. The stream is not stored: Core's
// `get-activity` answers the last few events of a project from memory, so a
// case collects them while its run is in flight (`../run/activity-watch.ts`)
// and this reads each snapshot. The subject is Core's own words, naming an
// authored step label at most, never page text; it is kept bounded.

import { attemptNodeId } from "../../flow-lane/index.js";

export type MatrixRecoveryActivity = Readonly<{
  /** Core's sequence number for the event, strictly increasing in its process. */
  sequence: number;
  /** The unit of work the event belongs to: `run` or `build`, and its id. */
  subjectKind: "run" | "build";
  subjectId: string | null;
  /** The node the recovery was about. */
  nodeId: string | null;
  kind: "handler" | "entry" | "route" | "alternative" | "interference" | "reacquire";
  outcome: "succeeded" | "failed" | "refused";
  subject: string;
}>;

const KINDS = new Set(["handler", "entry", "route", "alternative", "interference", "reacquire"]);
const OUTCOMES = new Set(["succeeded", "failed", "refused"]);
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
/** The bound Core puts on an activity title (`AUTOMATION_STUDIO_ACTIVITY_LIMITS.title`). */
const SUBJECT_LIMIT = 160;

/** Every recovery row of a `get-activity` snapshot (`{ current, recent }`), in sequence order, each once. */
export function matrixRecoveryActivities(snapshot: unknown): MatrixRecoveryActivity[] {
  const answer = record(snapshot);
  const events = [...(Array.isArray(answer?.recent) ? answer.recent : []), answer?.current];
  const bySequence = new Map<number, MatrixRecoveryActivity>();
  for (const value of events) {
    const activity = recoveryOf(value);
    if (activity) bySequence.set(activity.sequence, activity);
  }
  return [...bySequence.values()].sort((left, right) => left.sequence - right.sequence);
}

function recoveryOf(value: unknown): MatrixRecoveryActivity | undefined {
  const event = record(value);
  const detail = record(event?.detail);
  const recovery = record(detail?.recovery);
  const subject = record(event?.subject);
  if (!event || !detail || detail.kind !== "step" || !recovery || !subject) return undefined;
  if (typeof event.sequence !== "number" || !Number.isInteger(event.sequence)) return undefined;
  if (subject.kind !== "run" && subject.kind !== "build") return undefined;
  if (typeof recovery.kind !== "string" || !KINDS.has(recovery.kind) || typeof recovery.outcome !== "string" || !OUTCOMES.has(recovery.outcome)) return undefined;
  return {
    sequence: event.sequence,
    subjectKind: subject.kind,
    subjectId: typeof subject.id === "string" && RUN_ID.test(subject.id) ? subject.id : null,
    nodeId: typeof detail.ref === "string" ? attemptNodeId(detail.ref) : null,
    kind: recovery.kind as MatrixRecoveryActivity["kind"],
    outcome: recovery.outcome as MatrixRecoveryActivity["outcome"],
    subject: typeof recovery.subject === "string" ? recovery.subject.replace(/\s+/gu, " ").trim().slice(0, SUBJECT_LIMIT) : "",
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

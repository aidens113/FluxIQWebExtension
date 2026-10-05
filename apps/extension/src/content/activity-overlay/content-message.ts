// Reads the background's `ActivityContentMessage` off an untyped runtime
// message. A message that is not one, or is malformed, is `undefined`, and the
// handler moves on to the next kind of message.
//
// The overlay draws `display`, the background's paced status, and nothing
// else; `activity`, the raw event, rides along for the record and is checked
// only as far as it is read.

import {
  ACTIVITY_MESSAGES,
  type ActivityContentMessage,
  type ActivityDisplay,
  type ActivityOverlayPreference,
  type ClientGatewayActivity
} from "../../shared/activity";

const PREFERENCES: ReadonlySet<unknown> = new Set<ActivityOverlayPreference>(["expanded", "collapsed", "hidden"]);
const SUBJECT_KINDS: ReadonlySet<unknown> = new Set<ActivityDisplay["subjectKind"]>(["build", "run"]);
const OUTCOMES: ReadonlySet<unknown> = new Set<ActivityDisplay["outcome"]>(["done", "failed", "waiting", null]);
const KINDS: ReadonlySet<unknown> = new Set<ActivityDisplay["kind"]>(["action", "thought", "starting", undefined]);

/** The activity message `message` is, or `undefined` when it is some other message or not a well-formed one. */
export function activityContentMessage(message: unknown): ActivityContentMessage | undefined {
  if (!message || typeof message !== "object") return undefined;
  const candidate = message as { type?: unknown; activity?: unknown; display?: unknown; overlay?: unknown };
  if (candidate.type !== ACTIVITY_MESSAGES.content) return undefined;
  if (!PREFERENCES.has(candidate.overlay)) return undefined;
  const activity = candidate.activity ?? null;
  if (activity !== null && !isActivity(activity)) return undefined;
  const display = candidate.display ?? null;
  if (display !== null && !isDisplay(display)) return undefined;
  return {
    type: ACTIVITY_MESSAGES.content,
    activity,
    display,
    overlay: candidate.overlay as ActivityOverlayPreference,
    topFrameOnly: true
  };
}

/** The fields of the raw event anything here reads, checked; the rest is Core's and passes through. */
function isActivity(value: unknown): value is ClientGatewayActivity {
  if (!value || typeof value !== "object") return false;
  const activity = value as { phase?: unknown; label?: unknown };
  return typeof activity.phase === "string" && typeof activity.label === "string";
}

/** Every field the overlay draws from, checked: a display is the background's own shape, so nothing in it is optional but `kind`, which reads as `action` when absent. */
function isDisplay(value: unknown): value is ActivityDisplay {
  if (!value || typeof value !== "object") return false;
  const display = value as Partial<Record<keyof ActivityDisplay, unknown>>;
  return typeof display.activityId === "string"
    && SUBJECT_KINDS.has(display.subjectKind)
    && typeof display.phase === "string"
    && typeof display.headline === "string"
    && (display.detail === null || typeof display.detail === "string")
    && (display.step === null || isStep(display.step))
    && typeof display.working === "boolean"
    && OUTCOMES.has(display.outcome)
    && typeof display.sequence === "number"
    && KINDS.has(display.kind);
}

function isStep(value: unknown): value is NonNullable<ActivityDisplay["step"]> {
  if (!value || typeof value !== "object") return false;
  const step = value as { index?: unknown; count?: unknown };
  return typeof step.index === "number" && Number.isFinite(step.index) && typeof step.count === "number" && Number.isFinite(step.count);
}

// What the overlay shows for one activity message, decided without a DOM so it
// can be tested in Node.
//
// Every word comes from the event: Core's own status sentence, its step
// numbers, and the latest detail row's title. Nothing is inferred and nothing
// is timed -- the overlay says what the last event said until the next event
// says otherwise (decision D5, and the brief's "never from a guess or a
// timer"). The one timer in this directory is the display fade after a final
// event, which changes how long the last status stays up, not what it says.

import type { ActivityOverlayPreference, ClientGatewayActivity } from "../../shared/activity";
import { ACTIVITY_PHASE_APPEARANCE, UNKNOWN_PHASE_APPEARANCE, type ActivityPhaseMark } from "./phase-appearance";

/** The most characters of one line the overlay renders. Core already truncates; this bounds a misbehaving sender. */
const MAX_LINE = 160;

export type ActivityOverlayView = {
  mode: "expanded" | "collapsed";
  /** The phase as a person reads it, e.g. "Running". */
  phaseName: string;
  accent: string;
  mark: ActivityPhaseMark;
  /** Core's status sentence. */
  label: string;
  /** "Step 2 of 5", or "Step 7" when a loop has run past the flow's count. */
  step?: string;
  /** The pill's short form of `step`: "2/5", or "7". */
  stepShort?: string;
  /** The latest detail row's title. */
  detail?: string;
  /** The last event of its unit of work: the overlay fades after showing it. */
  final: boolean;
};

/** The view for this activity under this preference, or `null` when the overlay should not be in the page. */
export function activityOverlayView(activity: ClientGatewayActivity | null, preference: ActivityOverlayPreference): ActivityOverlayView | null {
  if (!activity || preference === "hidden") return null;
  const appearance = Object.prototype.hasOwnProperty.call(ACTIVITY_PHASE_APPEARANCE, activity.phase)
    ? ACTIVITY_PHASE_APPEARANCE[activity.phase]
    : UNKNOWN_PHASE_APPEARANCE;
  const view: ActivityOverlayView = {
    mode: preference === "collapsed" ? "collapsed" : "expanded",
    phaseName: appearance.name,
    accent: appearance.accent,
    mark: appearance.mark,
    label: bounded(activity.label) ?? appearance.name,
    final: activity.final === true
  };
  const steps = stepText(activity.step);
  if (steps) {
    view.step = steps.long;
    view.stepShort = steps.short;
  }
  const detail = bounded(activity.detail?.title);
  if (detail) view.detail = detail;
  return view;
}

/**
 * "Step N of M", read as Core speaks it: `index` is the ordinal a person reads
 * ("step 2" is the second). When a loop takes N past M, or M is not a count,
 * the step is said plainly rather than as a fraction that cannot be true.
 */
function stepText(step: ClientGatewayActivity["step"]): { long: string; short: string } | undefined {
  if (!step || !Number.isFinite(step.index) || step.index < 1) return undefined;
  const index = Math.floor(step.index);
  const count = Number.isFinite(step.count) ? Math.floor(step.count) : 0;
  if (count >= 1 && index <= count) return { long: `Step ${index} of ${count}`, short: `${index}/${count}` };
  return { long: `Step ${index}`, short: `${index}` };
}

function bounded(text: string | undefined): string | undefined {
  if (typeof text !== "string") return undefined;
  const collapsed = text.replace(/\s+/gu, " ").trim();
  if (!collapsed) return undefined;
  return collapsed.length > MAX_LINE ? `${collapsed.slice(0, MAX_LINE - 1)}…` : collapsed;
}

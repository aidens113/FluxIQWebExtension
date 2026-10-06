// What the overlay shows for one paced display, decided without a DOM so it
// can be tested in Node.
//
// Every word comes from the background's `ActivityDisplay`, which is already
// paced (`background/activity/pacer.ts`): the headline names the unit
// of work, the detail is Core's latest event in a person's words (never a tool
// id or result code) at a readable pace, the step
// is the run's. Nothing is inferred or timed here. The one timer in this
// directory is the fade after a finished display, which changes how long the
// last status stays up, not what it says. Only "done" fades (U8 of the t174
// live lane's UI review): a failure stays on the page until new work starts
// or the person hides the overlay, and waiting for the person never fades.
// A detail that only repeats the headline is not drawn (U2, `isHeadlineEcho`).
//
// The mark and its colour follow the headline, not Core's phase: a build is
// amber and a run blue for as long as it works, and only settling changes
// them. Core's phase flips between thinking and exploring every second or two
// during a build, and a mark that flipped with it would be the flicker the
// pacing exists to remove.

import { cutAtWord, isHeadlineEcho, type ActivityDisplay, type ActivityOverlayPreference } from "../../shared/activity";
import { ACTIVITY_PHASE_APPEARANCE, type ActivityPhaseAppearance, type ActivityPhaseMark } from "./phase-appearance";

/** The most characters of one line the overlay renders, cut where a word ends. The background already bounds it; this bounds a misbehaving sender. */
const MAX_LINE = 160;

export type ActivityOverlayView = {
  mode: "expanded" | "collapsed";
  mark: ActivityPhaseMark;
  accent: string;
  headline: string;
  /** The latest event in a person's words; "" when there is none. */
  detail: string;
  /** "Step 2 of 5", or "Step 7" when a loop has run past the flow's count; "" when there is no step. */
  step: string;
  /** The work finished well: the overlay fades after showing it. A failure, and waiting for the person, stay up. */
  fades: boolean;
};

/** The view for this display under this preference, or `null` when the overlay should not be in the page. */
export function activityOverlayView(display: ActivityDisplay | null, preference: ActivityOverlayPreference): ActivityOverlayView | null {
  if (!display || preference === "hidden") return null;
  const appearance = appearanceOf(display);
  const headline = bounded(display.headline) || appearance.name;
  const detail = bounded(display.detail);
  return {
    mode: preference === "collapsed" ? "collapsed" : "expanded",
    mark: appearance.mark,
    accent: appearance.accent,
    headline,
    detail: isHeadlineEcho(headline, detail) ? "" : detail,
    step: display.working ? stepText(display.step) : "",
    fades: !display.working && display.outcome === "done"
  };
}

function appearanceOf(display: ActivityDisplay): ActivityPhaseAppearance {
  if (display.outcome === "failed") return ACTIVITY_PHASE_APPEARANCE.failed;
  if (display.outcome === "waiting") return ACTIVITY_PHASE_APPEARANCE.waiting_permission;
  if (display.outcome === "done") return ACTIVITY_PHASE_APPEARANCE.done;
  return display.subjectKind === "run" ? ACTIVITY_PHASE_APPEARANCE.running : ACTIVITY_PHASE_APPEARANCE.building;
}

/**
 * "Step N of M", read as Core speaks it: `index` is the ordinal a person reads
 * ("step 2" is the second). When a loop takes N past M, or M is not a count,
 * the step is said plainly rather than as a fraction that cannot be true.
 */
function stepText(step: ActivityDisplay["step"]): string {
  if (!step || !Number.isFinite(step.index) || step.index < 1) return "";
  const index = Math.floor(step.index);
  const count = Number.isFinite(step.count) ? Math.floor(step.count) : 0;
  return count >= 1 && index <= count ? `Step ${index} of ${count}` : `Step ${index}`;
}

function bounded(text: string | null): string {
  if (typeof text !== "string") return "";
  const collapsed = text.replace(/\s+/gu, " ").trim();
  return cutAtWord(collapsed, MAX_LINE);
}

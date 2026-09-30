import type { ActivityOverlayPreference } from "../../shared/activity/index";

const PREFERENCES: ReadonlySet<unknown> = new Set<ActivityOverlayPreference>(["expanded", "collapsed", "hidden"]);

/** Whether a value read from storage or sent by a panel is an overlay preference. */
export function isActivityOverlayPreference(value: unknown): value is ActivityOverlayPreference {
  return PREFERENCES.has(value);
}

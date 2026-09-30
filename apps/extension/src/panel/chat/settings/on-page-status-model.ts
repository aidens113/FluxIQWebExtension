// What the on-page status setting shows: how FluxIQ's status appears on the
// page itself (a full card, a small pill, or nothing), from the activity
// feed. The choice is off until the background's relay has answered, while a
// change is on its way, and for good when this build has no relay. No DOM.

import type { ActivityOverlayPreference } from "../../../shared/activity/index";
import type { ActivityFeedSnapshot } from "../feed";

/** One choice of the setting. */
export type OnPageStatusOption = { value: ActivityOverlayPreference; label: string; selected: boolean };

/** Everything the setting renders. */
export type OnPageStatusModel = { options: OnPageStatusOption[]; disabled: boolean; error: string | undefined };

const LABELS: ReadonlyArray<[ActivityOverlayPreference, string]> = [
  ["expanded", "Full"],
  ["collapsed", "Small"],
  ["hidden", "Off"]
];

/** The setting for `feed`. */
export function onPageStatusModel(feed: ActivityFeedSnapshot): OnPageStatusModel {
  return {
    options: LABELS.map(([value, label]) => ({ value, label, selected: feed.state.overlay === value })),
    disabled: feed.reach !== "ready" || feed.overlaySaving,
    error: feed.overlayError
  };
}

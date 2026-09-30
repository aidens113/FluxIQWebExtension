// What the chat's status header shows, from the activity feed and whether the
// extension is connected to FluxIQ. No DOM.
//
//   chip      the current phase in its colour, or "Idle" when nothing has
//             been reported since the worker started (`current: null`)
//   label     Core's own status sentence
//   step      "Step N of M" (see step-text.ts)
//   live      the dot: green while a gateway session is ready and the relay
//             answers, grey otherwise, with the reason in words
//   overlay   the on-page status control; off when the relay is unsupported
//             or the relay has not answered yet

import type { ActivityOverlayPreference } from "../../../shared/activity/index";
import type { ActivityFeedSnapshot } from "../feed";
import { PHASE_COPY, type ChatPhase, type ChatTone } from "./phase-copy";
import { stepText } from "./step-text";

/** One choice of the on-page status control. */
export type OverlayOption = { value: ActivityOverlayPreference; label: string; selected: boolean };

/** Everything the header renders. */
export type ChatHeaderModel = {
  phase: ChatPhase;
  phaseLabel: string;
  tone: ChatTone;
  label: string;
  step: string | undefined;
  live: boolean;
  liveLabel: string;
  overlay: { options: OverlayOption[]; disabled: boolean; error: string | undefined };
};

const OVERLAY_LABELS: ReadonlyArray<[ActivityOverlayPreference, string]> = [
  ["expanded", "Full"],
  ["collapsed", "Small"],
  ["hidden", "Off"]
];

const IDLE_LABEL = "Nothing running right now.";

/** The header for `feed`, given whether the extension is connected to FluxIQ. */
export function chatHeaderModel(feed: ActivityFeedSnapshot, connected: boolean): ChatHeaderModel {
  const current = feed.state.current;
  const phase: ChatPhase = current !== null && Object.hasOwn(PHASE_COPY, current.phase) ? current.phase : "idle";
  const copy = PHASE_COPY[phase];
  const live = feed.reach === "ready" && feed.state.live && connected;
  const disabled = feed.reach !== "ready" || feed.overlaySaving;
  return {
    phase,
    phaseLabel: copy.label,
    tone: copy.tone,
    label: current === null ? IDLE_LABEL : current.label.trim() || copy.label,
    step: current === null ? undefined : stepText(current.step),
    live,
    liveLabel: liveLabel(feed, connected, live),
    overlay: {
      options: OVERLAY_LABELS.map(([value, label]) => ({ value, label, selected: feed.state.overlay === value })),
      disabled,
      error: feed.overlayError
    }
  };
}

function liveLabel(feed: ActivityFeedSnapshot, connected: boolean, live: boolean): string {
  if (live) return "Live";
  if (feed.reach === "unsupported") return "Offline: this extension build has no live activity";
  if (feed.reach === "failed") return `Offline: ${feed.readError ?? "the extension did not answer"}`;
  if (feed.reach === "loading") return "Connecting";
  if (!connected) return "Offline: not connected to FluxIQ";
  return "Offline: FluxIQ is not streaming activity";
}

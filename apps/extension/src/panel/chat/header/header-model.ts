// What the chat's one-line header shows, from the activity feed and whether
// the extension is connected to FluxIQ. No DOM.
//
//   status    the paced display's headline (`ExtensionActivityState.display`),
//             never a raw event, so it moves only as fast as the background's
//             pacer lets it; empty before the first unit of work. While the
//             work waits for the person it is what Core asks of them -- "FluxIQ
//             needs you: complete the check on this page, then press
//             Continue." -- because "Waiting for you" says nothing of what to
//             do, and this one line is all the header shows
//   tone      the headline's colour: accent while working, then the outcome's
//   live      the dot: green while a gateway session is ready and the relay
//             answers, grey otherwise, with the reason in words
//   overlay   the on-page status control; off when the relay is unsupported
//             or the relay has not answered yet

import type { ActivityDisplay, ActivityOverlayPreference } from "../../../shared/activity/index";
import type { ActivityFeedSnapshot } from "../feed";
import { PHASE_COPY, type ChatTone } from "./phase-copy";

/** One choice of the on-page status control. */
export type OverlayOption = { value: ActivityOverlayPreference; label: string; selected: boolean };

/** Everything the header renders. */
export type ChatHeaderModel = {
  status: string;
  tone: ChatTone;
  working: boolean;
  live: boolean;
  liveLabel: string;
  overlay: { options: OverlayOption[]; disabled: boolean; error: string | undefined };
};

const OVERLAY_LABELS: ReadonlyArray<[ActivityOverlayPreference, string]> = [
  ["expanded", "Full"],
  ["collapsed", "Small"],
  ["hidden", "Off"]
];

const OUTCOME_TONES: Readonly<Record<NonNullable<ActivityDisplay["outcome"]>, ChatTone>> = {
  done: "success",
  failed: "danger",
  waiting: "warning"
};

/** The header for `feed`, given whether the extension is connected to FluxIQ. */
export function chatHeaderModel(feed: ActivityFeedSnapshot, connected: boolean): ChatHeaderModel {
  const display = feed.state.display ?? null;
  const live = feed.reach === "ready" && feed.state.live && connected;
  const disabled = feed.reach !== "ready" || feed.overlaySaving;
  return {
    status: display ? statusOf(display) : "",
    tone: displayTone(display),
    working: display?.working === true,
    live,
    liveLabel: liveLabel(feed, connected, live),
    overlay: {
      options: OVERLAY_LABELS.map(([value, label]) => ({ value, label, selected: feed.state.overlay === value })),
      disabled,
      error: feed.overlayError
    }
  };
}

/** The headline, or, while the work waits for the person, what Core asked of them when it said. */
function statusOf(display: ActivityDisplay): string {
  const asked = display.outcome === "waiting" ? display.detail?.trim() : undefined;
  return asked ? asked : display.headline.trim();
}

function displayTone(display: ActivityDisplay | null): ChatTone {
  if (display === null) return "neutral";
  if (!display.working && display.outcome !== null) return OUTCOME_TONES[display.outcome] ?? "neutral";
  return Object.hasOwn(PHASE_COPY, display.phase) ? PHASE_COPY[display.phase].tone : "accent";
}

function liveLabel(feed: ActivityFeedSnapshot, connected: boolean, live: boolean): string {
  if (live) return "Live";
  if (feed.reach === "unsupported") return "Offline: this extension build has no live activity";
  if (feed.reach === "failed") return `Offline: ${feed.readError ?? "the extension did not answer"}`;
  if (feed.reach === "loading") return "Connecting";
  if (!connected) return "Offline: not connected to FluxIQ";
  return "Offline: FluxIQ is not streaming activity";
}

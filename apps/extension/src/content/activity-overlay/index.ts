// The on-page activity overlay: what FluxIQ is doing now, shown on the page it
// is automating (decision D5 of the live-activity plan).
//
// `message-handler.ts` is the only consumer. It reads a message with
// `activityContentMessage`, applies the top-frame rule, and hands the message
// to `showActivityOverlay`. What the overlay says -- the background's paced
// display, nothing guessed -- is in `overlay-view.ts`; how long each line
// stays up before the next replaces it, in `status-dwell.ts`; how it is drawn
// in place and stays out of the page's way, in `status-pill.ts`; where on the
// page it sits, in `placement/`.

export { activityContentMessage } from "./content-message";
export { showActivityOverlay } from "./overlay";
export { STATUS_DWELL_MS, StatusDwell } from "./status-dwell";
export { StatusPill } from "./status-pill";
export { activityOverlayView, type ActivityOverlayView } from "./overlay-view";
export { ACTIVITY_PHASE_APPEARANCE, type ActivityPhaseAppearance, type ActivityPhaseMark } from "./phase-appearance";
export { PhaseMark } from "./phase-mark";
export { anchorStyle, choosePlacement, PlacementKeeper, type OverlayAnchor, type OverlayPlacement, type PointCover } from "./placement";

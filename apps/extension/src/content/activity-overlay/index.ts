// The on-page activity overlay: what FluxIQ is doing now, shown on the page it
// is automating (decision D5 of the live-activity plan).
//
// `message-handler.ts` is the only consumer. It reads a message with
// `activityContentMessage`, applies the top-frame rule, and hands the message
// to `showActivityOverlay`. What the overlay says -- the background's paced
// display, nothing guessed -- is in `overlay-view.ts`; how it is drawn in
// place and stays out of the page's way, in `status-pill.ts`.

export { activityContentMessage } from "./content-message";
export { showActivityOverlay } from "./overlay";
export { StatusPill } from "./status-pill";
export { activityOverlayView, type ActivityOverlayView } from "./overlay-view";
export { ACTIVITY_PHASE_APPEARANCE, type ActivityPhaseAppearance, type ActivityPhaseMark } from "./phase-appearance";
export { PhaseMark } from "./phase-mark";

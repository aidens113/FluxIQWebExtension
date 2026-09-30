// The on-page activity overlay: what FluxIQ is doing now, shown on the page it
// is automating (decision D5 of the live-activity plan).
//
// `message-handler.ts` is the only consumer. It reads a message with
// `activityContentMessage`, applies the top-frame rule, and hands the message
// to `showActivityOverlay`. How the overlay stays out of the page's way is in
// `overlay.ts`; what it says, and why nothing there is guessed, in
// `overlay-view.ts`.

export { activityContentMessage } from "./content-message";
export { showActivityOverlay } from "./overlay";
export { activityOverlayView, type ActivityOverlayView } from "./overlay-view";
export { ACTIVITY_PHASE_APPEARANCE, UNKNOWN_PHASE_APPEARANCE, type ActivityPhaseAppearance, type ActivityPhaseMark } from "./phase-appearance";

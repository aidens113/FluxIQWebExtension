// Wire-visible names for FluxIQ's live activity inside the extension. Core
// pushes `server.activity` over the gateway; the background worker keeps the
// latest state and fans it out under these names. Changing a string here
// silently breaks the other side, so all of them live in one place.

export const ACTIVITY_MESSAGES = {
  /** Background -> panel pages: the activity state changed. Payload `{ state: ExtensionActivityState }`. */
  changed: "fluxiq.activity.changed",
  /** Panel -> background: read the current activity state. Answers `{ ok: true, state }`. */
  read: "fluxiq.panel.activityRead",
  /** Panel -> background: set how the on-page overlay shows. Payload `{ overlay: ActivityOverlayPreference }`. */
  setOverlay: "fluxiq.panel.activityOverlay",
  /** Background -> content script (top frame): show this activity. Payload is `ActivityContentMessage`. */
  content: "fluxiq.activity.overlay"
} as const;

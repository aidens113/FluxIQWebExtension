import type { ClientGatewayActivity } from "@fluxiq/client-gateway-websocket";
import type { ActivityDisplay } from "./activity-display.js";

/** How the on-page overlay shows: a full status card, a small pill, or nothing. */
export type ActivityOverlayPreference = "expanded" | "collapsed" | "hidden";

/** The most events the background keeps for the chat stream. */
export const ACTIVITY_RECENT_LIMIT = 60;

/**
 * What the background knows about FluxIQ's live activity. `current` is the
 * latest event of the most recent unit of work, or null when nothing has
 * been reported since the worker started. `recent` holds the last
 * `ACTIVITY_RECENT_LIMIT` events, oldest first, for the chat stream.
 */
export type ExtensionActivityState = {
  current: ClientGatewayActivity | null;
  /** The paced status the overlay and the chat header show; null before the first event. */
  display: ActivityDisplay | null;
  recent: ClientGatewayActivity[];
  overlay: ActivityOverlayPreference;
  /** Whether the connected Core advertised the stream (a session is ready). */
  live: boolean;
};

/** Background -> content script, top frame only. */
export type ActivityContentMessage = {
  type: "fluxiq.activity.overlay";
  activity: ClientGatewayActivity | null;
  /** What the overlay draws. */
  display: ActivityDisplay | null;
  overlay: ActivityOverlayPreference;
  topFrameOnly: true;
};

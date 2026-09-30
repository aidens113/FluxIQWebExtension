import type { ClientGatewayActivity } from "@fluxiq/client-gateway-websocket";

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
  recent: ClientGatewayActivity[];
  overlay: ActivityOverlayPreference;
  /** Whether the connected Core advertised the stream (a session is ready). */
  live: boolean;
};

/** Background -> content script, top frame only. */
export type ActivityContentMessage = {
  type: "fluxiq.activity.overlay";
  activity: ClientGatewayActivity | null;
  overlay: ActivityOverlayPreference;
  topFrameOnly: true;
};

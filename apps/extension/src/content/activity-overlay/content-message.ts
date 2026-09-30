// Reads the background's `ActivityContentMessage` off an untyped runtime
// message. A message that is not one, or is malformed, is `undefined`, and the
// handler moves on to the next kind of message.

import { ACTIVITY_MESSAGES, type ActivityContentMessage, type ActivityOverlayPreference, type ClientGatewayActivity } from "../../shared/activity";

const PREFERENCES: ReadonlySet<string> = new Set<ActivityOverlayPreference>(["expanded", "collapsed", "hidden"]);

/** The activity message `message` is, or `undefined` when it is some other message or not a well-formed one. */
export function activityContentMessage(message: unknown): ActivityContentMessage | undefined {
  if (!message || typeof message !== "object") return undefined;
  const candidate = message as { type?: unknown; activity?: unknown; overlay?: unknown };
  if (candidate.type !== ACTIVITY_MESSAGES.content) return undefined;
  if (typeof candidate.overlay !== "string" || !PREFERENCES.has(candidate.overlay)) return undefined;
  const activity = candidate.activity ?? null;
  if (activity !== null && !isActivity(activity)) return undefined;
  return {
    type: ACTIVITY_MESSAGES.content,
    activity,
    overlay: candidate.overlay as ActivityOverlayPreference,
    topFrameOnly: true
  };
}

/** The fields the overlay reads, checked; the rest of the event is Core's and passes through. */
function isActivity(value: unknown): value is ClientGatewayActivity {
  if (!value || typeof value !== "object") return false;
  const activity = value as { phase?: unknown; label?: unknown };
  return typeof activity.phase === "string" && typeof activity.label === "string";
}

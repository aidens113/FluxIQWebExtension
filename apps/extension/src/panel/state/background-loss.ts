// Whether a fresh read of the status says the background lost the wait the
// panel was showing.
//
// A Manifest V3 worker can be stopped at any moment (a crash, an update, the
// browser's own kill). It sends no push when it goes, so the panel learns of it
// only by asking again: the ask itself starts a fresh worker, which holds no
// socket and no pairing, and answers disconnected. A pairing it lost has a code
// FluxIQ withdrew with the session, so the panel must stop showing it (t707 P1).
//
// `next` is undefined when the background gave no answer at all.

import type { ConnectionState, ExtensionStatus } from "../../shared/protocol";

/** The wait the background lost: a pairing (its code expired) or a connection under way. */
export type BackgroundLoss = "pairing" | "connecting";

const WAITING: ReadonlySet<ConnectionState> = new Set(["connecting", "pairing", "reconnecting"]);
const DOWN: ReadonlySet<ConnectionState> = new Set(["disconnected", "error"]);

/** The loss `next` reveals after `previous`, or undefined when nothing was lost. */
export function backgroundLoss(previous: ExtensionStatus | undefined, next: ExtensionStatus | undefined): BackgroundLoss | undefined {
  if (previous === undefined || !WAITING.has(previous.connectionState)) return undefined;
  if (next !== undefined && !DOWN.has(next.connectionState)) return undefined;
  return previous.connectionState === "pairing" ? "pairing" : "connecting";
}

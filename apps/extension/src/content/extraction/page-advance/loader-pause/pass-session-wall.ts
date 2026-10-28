// A list whose page stopped to check the session has not ended either (t765).
// photo-social's grid answers a third screen with "Your session needs a quick
// check before we load more" and a "Continue as <name>" control; a scroll that
// found the list unchanged under it answered `ended: scrolled_to_end`.
//
// The wall is an interruption, handled like the dialog and rate-limit defences
// handle theirs (`../../../action-runtime/interference/`):
//
// - **a plain way on** (`sessionWallOf`: one Continue, nothing to type) is
//   pressed, and the move goes on. It types no credential and spends, deletes
//   and sends nothing; it is the page's own "carry on as you were".
// - **a wall only a person can answer** (a password, a code, a robot check, or
//   no single way on) throws `PageMovePersonCheck` with a person-only sighting,
//   so the step answers that a person is needed, never that the list ended.
//
// The move is a node: the first wall and `SESSION_PASSES` more are passed, and a
// page that keeps asking after them is handed to the person too.

import { waitUntil } from "../../list-wait";
import { sessionWallOf } from "../../read-coverage";
import { PageMovePersonCheck } from "../person-check";
import type { PaginationProgress } from "../types";

/** How many walls follow the first one that a move passes: the node's three retries. */
export const SESSION_PASSES = 3;
/** How long a pressed Continue has to take the wall away. */
const GONE_WINDOW_MS = 3_000;
const POLL_MS = 50;

/** What passing came to: no wall up, the wall pressed through, or the command's time gone. */
export type SessionPass = "clear" | "passed" | "timed_out";

/** Passes the session check under the list once, `passes` being how many this move has passed; see the header. */
export async function passSessionWall(progress: PaginationProgress, passes: number): Promise<SessionPass> {
  const items = (): Element[] => {
    const now = Array.from(document.querySelectorAll(progress.item));
    return now.length > 0 ? now : [...progress.shown];
  };
  const wall = sessionWallOf(items());
  if (wall === undefined) return "clear";
  if (wall.wayOn === undefined || passes > SESSION_PASSES) {
    throw new PageMovePersonCheck({ outcome: "person_only", afterMs: 0, waitedMs: 0 });
  }
  wall.wayOn.click();
  const over = await waitUntil(() => sessionWallOf(items())?.element !== wall.element, GONE_WINDOW_MS, POLL_MS, progress.deadline);
  return over === "timed_out" ? "timed_out" : "passed";
}

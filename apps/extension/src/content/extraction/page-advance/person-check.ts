// A list move that reached a robot check has moved; it must never reload the
// check as a missing list or repeat the pager press. Only a person clears a
// person-only check. A self-clearing one keeps the ordinary wait first.
import { robotCheckIn, type RobotCheckSighting } from "../../action-runtime/robot-check";
import { waitUntil } from "../list-wait";

const SELF_CLEARING_WAIT_MS = 15_000;
const CHECK_POLL_MS = 50;

/** An already-dispatched list move whose landing only a person can finish. */
export class PageMovePersonCheck extends Error {
  readonly sighting: RobotCheckSighting;

  constructor(sighting: RobotCheckSighting) {
    super("The list move reached a robot check that only a person can answer.");
    this.name = "PageMovePersonCheck";
    this.sighting = sighting;
  }

  /** Called only after moving, including every poll before another fallback. */
  static assertClear(startedAt: number): void {
    if (document.body && robotCheckIn(document.body, "page") === "person_only") {
      throw new PageMovePersonCheck({ outcome: "person_only", afterMs: Math.max(0, Date.now() - startedAt), waitedMs: 0 });
    }
  }

  /** Wait out a self-clearing check before interpreting HTTP status or reloading. */
  static async awaitClear(startedAt: number, deadline: number | undefined): Promise<void> {
    PageMovePersonCheck.assertClear(startedAt);
    if (!document.body || robotCheckIn(document.body, "page") !== "self_clearing") return;
    const seenAt = Date.now();
    const outcome = await waitUntil(() => {
      PageMovePersonCheck.assertClear(startedAt);
      return !document.body || robotCheckIn(document.body, "page") !== "self_clearing";
    }, SELF_CLEARING_WAIT_MS, CHECK_POLL_MS, deadline);
    if (outcome !== "changed") throw new PageMovePersonCheck({ outcome: "not_cleared", afterMs: Math.max(0, seenAt - startedAt), waitedMs: Math.max(0, Date.now() - seenAt) });
  }
}

// What one unit of work is in the middle of, beyond its latest event: whether
// Core is repairing the Flow, and whether the page is waiting on a check only
// the person can answer. Both last across events -- a repair spans many model
// calls and page steps, and a robot check stays on the page while the build
// keeps deciding what to do -- so the headline they choose cannot be read off
// one event alone (`headline.ts`).
//
// Every event of the unit passes through `observe`, whether or not the pacer
// shows it, so a repair or a check that begins inside a paced interval still
// changes the headline at once.
//
// What Core reports, and nothing guessed:
//
// - A repair begins with a `repairing` event: a run's "Recovering from a failed
//   step", a build's "Repairing the Flow: the result check refuted its
//   answer". For a run it ends when the run reports its next step; for a build
//   it lasts until the build settles, since Core sends no "repair finished".
// - A check needs the person when a page action's result code is the
//   extension's `web.intervention.required` (`domain/src/runtime/failure/
//   codes.ts`: the page asks for what only a person can give -- a robot check,
//   a code prompt). Core has no event of its own for this; the result code on
//   the build's tool event is the one signal there is. It ends when a later
//   page action succeeds or a run reports its next step.

import type { ClientGatewayActivity } from "../../shared/activity/index";

/** The extension's result code for a page that only a person can get past. */
const INTERVENTION_CODE = /\bweb\.intervention\.[a-z_.]+|\buser_intervention_required\b/u;

export type UnitState = {
  readonly repairing: boolean;
  readonly check: boolean;
  /** This very event is the one that reported the check. */
  readonly checkReportedNow: boolean;
};

export class UnitSituation {
  private activityId: string | undefined;
  private repairing = false;
  private check = false;

  /** Folds `event` in and answers the unit's state after it. */
  observe(event: ClientGatewayActivity): UnitState {
    if (event.activityId !== this.activityId) {
      this.activityId = event.activityId;
      this.repairing = false;
      this.check = false;
    }
    if (event.phase === "repairing") this.repairing = true;
    const runMovedOn = event.phase === "running" && event.step !== undefined;
    if (runMovedOn) this.repairing = false;
    const reported = asksForPerson(event);
    if (reported) this.check = true;
    else if (runMovedOn || pageActionSucceeded(event)) this.check = false;
    return { repairing: this.repairing, check: this.check, checkReportedNow: reported };
  }
}

/** The event's page action reported that only a person can get past the page. */
function asksForPerson(event: ClientGatewayActivity): boolean {
  return INTERVENTION_CODE.test(event.detail?.text ?? "") || INTERVENTION_CODE.test(event.label);
}

/** A page action that ended well: the page let FluxIQ through, so no check stands in the way now. */
function pageActionSucceeded(event: ClientGatewayActivity): boolean {
  if (event.detail?.kind !== "tool" || event.detail.status !== "succeeded") return false;
  const code = /^Result:\s*(\S+)/u.exec(event.detail.text ?? "")?.[1];
  return code === undefined || /\.(?:succeeded|ok|done)$/u.test(code);
}

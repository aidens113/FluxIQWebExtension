// Which work a settling row ends, as Core's own words for it say.
//
// The headline a unit of work settles on is chosen by its kind: a failed run
// whose repair was under way reads "Couldn't fix your Flow", a failed build
// "Build failed" (`headline.ts`). The kind comes from the event's subject.
// Run A of live round 1 (`run-muw60unq-591e23bd`, U4) ended a creation build
// on "Couldn't fix your Flow · Build stopped: the Flow is not finished yet":
// the row was the build's own ending, yet its headline was a run's. Neither
// the extension nor Core's emission (`runtime/activity/build.ts`, which ends
// every build under its build scope) shows how that row came to read as a
// run's -- the Lab keeps no record of the events the extension received, so
// the cause is not established (t276 report, item 3).
//
// Core's ending rows name the work they end, and that name is the stronger
// signal: "Build failed", "Build stopped: ...", "Not doable: ..." and "Build
// finished" end a build (`build.ts`'s titles); "Run failed", "Run cancelled"
// and "Run finished" end a run (`run.ts`). So a settling row's own title picks
// the headline's kind, and the subject only when the title names neither.

import type { ActivityDisplay, ClientGatewayActivity } from "../../shared/activity/index";

const BUILD_ENDING = /^(?:Build (?:failed|stopped|finished)|Not doable)\b/u;
const RUN_ENDING = /^Run (?:failed|cancelled|finished)\b/u;

/** The kind of work `event`'s settling row says it ends; undefined for any other row. */
export function endingKindOf(event: ClientGatewayActivity): ActivityDisplay["subjectKind"] | undefined {
  const detail = event.detail;
  if (detail?.kind !== "step" || (event.final !== true && event.phase !== "failed" && event.phase !== "done")) return undefined;
  if (BUILD_ENDING.test(detail.title)) return "build";
  if (RUN_ENDING.test(detail.title)) return "run";
  return undefined;
}

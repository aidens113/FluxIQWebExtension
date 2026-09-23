// Where a Flow starts, which is the difference between measuring a Flow and
// measuring the harness.
//
// The runner loads the fixture's entry point before every Flow run
// (`prepareFlowPage` in `run-scenario.ts`). For a task whose instruction begins
// by going somewhere, that is the one step the Flow is being measured on:
// `run-mudwci8d-de88aa32` (2026-09-23) built a seven-node Flow with
// `navigationNodes: 0` and no URL anywhere in it, and its first action -- a
// click on the store's home page -- only resolved because the harness had just
// loaded that page. t097 made such a Flow fail on the fact
// (`flow_lane.flow_does_not_reach_its_page`); this stops the harness supplying
// the page at all, so the Flow fails where a person would watch it fail: on the
// blank tab a browser opens on.
//
// Not every task, and the exception is not a concession. The rule that decides
// whether a Flow must reach its own page decides whether the harness may
// present one, and it is imported from `own-page.ts` rather than restated, so
// the two cannot drift into failing a task that was handed its page or passing
// a Flow the harness carried. A `form` task is given its page by the person who
// asked -- they are looking at it -- so blanking the tab would start it
// somewhere no user ever is.
//
// The build is not blanked. FluxIQ explores the page the lane presents before
// it proposes anything, so exploring from a blank tab would change what the
// model sees and therefore which Flow it writes: a measurement change to decide
// deliberately, not a harness fix. It is also the likelier cause of a missing
// navigation node -- a model handed the page never has to run a navigate node,
// and a Flow is assembled from the nodes that ran -- and is recorded as an open
// question rather than changed here.

import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { createdFlowMustReachItsOwnPage, type LiveInstructionTask } from "../flow-lane/index.js";

/**
 * What the tab shows when a Flow starts.
 *
 * - `scenario-start-page`: the harness loads the fixture's entry point and
 *   leaves the Flow on it.
 * - `blank-tab`: the harness leaves the Flow the blank tab a browser opens on,
 *   so reaching the page is the Flow's own first step.
 * - `blank-tab-after-proving-the-arming`: the same, with the armed rendering
 *   loaded and checked first, because only a loaded page can prove the fixture
 *   armed as declared. The Flow still starts blank, and pays for the proof with
 *   one extra load of the entry point before its own.
 */
export type FlowStartPage = "scenario-start-page" | "blank-tab" | "blank-tab-after-proving-the-arming";

/**
 * Where this preparation leaves the tab.
 *
 * `moment` is the lane's: `"build"` presents the page FluxIQ explores, and
 * anything else -- `"playback"`, or the repair lane's unnamed preparation --
 * presents the page a Flow is about to run from. `task` is absent on the
 * recorded-Flow lane, whose Flow replays a script that began on the page it was
 * recorded from, so there is no instruction that says it should have gone
 * anywhere.
 */
export function flowStartPage(input: {
  task: Pick<LiveInstructionTask, "kind"> | undefined;
  moment: "build" | "playback" | undefined;
  armedFacts: readonly ExpectedFact[];
}): FlowStartPage {
  if (input.moment === "build" || !input.task || !createdFlowMustReachItsOwnPage(input.task)) return "scenario-start-page";
  return input.armedFacts.length > 0 ? "blank-tab-after-proving-the-arming" : "blank-tab";
}

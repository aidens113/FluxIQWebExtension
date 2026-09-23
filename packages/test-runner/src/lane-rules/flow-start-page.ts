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
// **The build is blanked too, and that is where the missing node came from.**
// A Flow is assembled from the steps that ran, so a model standing on the
// store's home page never runs the step that reaches it and cannot write one
// into the Flow it proposes. Blanking playback alone would only have made every
// such Flow fail honestly; blanking the build is what lets one be built that
// does not.
//
// It could not be blanked while the destination existed nowhere the model could
// read it: no instruction in the catalog names an address, and the fixture's
// origin is a loopback port drawn per run, so nothing written down beforehand
// could carry one. That is what t103 supplied -- the run tells Core where the
// Flow starts, Core shows the model and tells the domain, and the domain
// refuses every call until the Flow has got there
// (`AS/runtime/flow-bootstrap/start-location.ts`). The address the harness
// would have opened and the address Core is told are one expression here, so
// the two cannot name different pages.

import type { ExpectedFact, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { createdFlowMustReachItsOwnPage, type LiveInstructionTask } from "../flow-lane/index.js";

/**
 * The fixture's entry point: the page the harness opens for a Flow it is
 * carrying, and the page it tells Core a Flow that must carry itself starts at.
 *
 * One expression, used by both, because the harness loading one address while
 * Core names another is a difference nothing would report -- the Flow would
 * simply be judged for not reaching a page it was never told about.
 */
export function scenarioStartUrl(scenarioOrigin: string, scenario: Pick<WebScenario, "startPath">): string {
  return `${scenarioOrigin}${scenario.startPath}`;
}

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
 *
 * The moment no longer changes the answer for a task that must reach its own
 * page: the build and the run both start blank, and both are told where to go.
 * It is still read, because it is what the caller has and what a future rule
 * would turn on, and because dropping the parameter would let a caller stop
 * passing it without anything saying so.
 */
export function flowStartPage(input: {
  task: Pick<LiveInstructionTask, "kind"> | undefined;
  moment: "build" | "playback" | undefined;
  armedFacts: readonly ExpectedFact[];
}): FlowStartPage {
  if (!input.task || !createdFlowMustReachItsOwnPage(input.task)) return "scenario-start-page";
  return input.armedFacts.length > 0 ? "blank-tab-after-proving-the-arming" : "blank-tab";
}

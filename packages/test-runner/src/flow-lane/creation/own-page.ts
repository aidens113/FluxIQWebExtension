// Whether the created Flow can reach the page it works on, or whether the
// harness reached it for the Flow.
//
// The lane used to present the task's page before every run -- `prepareFlowPage`
// "loads the scenario's start page", after the fixture reset and before the
// Flow starts (`lane.ts`). For a task whose instruction begins by going
// somewhere, that handed the Flow the one step it is being measured on. A Flow
// with no navigation node then played back as though it had one, and the
// measurement over-stated what it can do by exactly the amount the harness
// supplied.
//
// Measured on `run-mudwci8d-de88aa32` (2026-09-23): a `navigate-and-extract`
// task produced a seven-node Flow with `navigationNodes: 0` and no URL
// anywhere in it. It clicked "Not now", accepted cookies, typed a search and
// read a list -- all of which only mean anything on the store's home page,
// which the harness had just loaded. Run from a blank tab it would click "Not
// now" on whatever happened to be there. The campaign scored it on twelve
// wrong records; what it should have said first is that the Flow cannot get to
// the page those records came from.
//
// This states the fact and holds the run to it. Since t101 the harness no
// longer supplies the page either: whoever supplies `prepareFlowPage` leaves
// exactly these tasks on a blank tab, by the rule below
// (`lane-rules/flow-start-page.ts`), so such a Flow now fails on the page as
// well as on the record. The build still explores the page the lane presents.

import { RunnerFailure } from "../../failure.js";
import type { CreatedFlowShape } from "./flow-shape.js";
import type { LiveInstructionTask } from "./instruction-task.js";

/**
 * The task kinds whose instruction is to go somewhere and then work there, so
 * the Flow must carry the going.
 *
 * `form` and `extract` are the other two, and they are not here on purpose: a
 * person asking for a form to be filled in, or for the page in front of them
 * to be read, starts on that page, so a Flow for one of those tasks is right
 * to have no navigation node. The distinction is the task's, never the Flow's.
 */
const KINDS_THAT_MUST_REACH_THEIR_PAGE: ReadonlySet<LiveInstructionTask["kind"]> = new Set(["navigate", "navigate-and-extract"]);

/**
 * Whether a task of this kind must carry its own navigation.
 *
 * Exported because the harness asks the same question before the run: it leaves
 * exactly these tasks the blank tab a browser opens on, and presents the page
 * for the rest (`lane-rules/flow-start-page.ts`). Two copies of the rule would
 * either fail a task that was handed its page or pass a Flow the harness
 * carried, so there is one.
 */
export function createdFlowMustReachItsOwnPage(task: Pick<LiveInstructionTask, "kind">): boolean {
  return KINDS_THAT_MUST_REACH_THEIR_PAGE.has(task.kind);
}

/** Whether this Flow has to reach its own page, and whether it can. */
export type CreatedFlowOwnPage = Readonly<{
  /** Whether the task's kind means the Flow must carry its own navigation. */
  required: boolean;
  /** Navigation nodes the built Flow holds (`CreatedFlowShape.navigationNodes`). */
  navigationNodes: number;
  /** False only when one was required and the Flow holds none. */
  reached: boolean;
}>;

export function createdFlowOwnPage(task: LiveInstructionTask, shape: CreatedFlowShape): CreatedFlowOwnPage {
  const required = createdFlowMustReachItsOwnPage(task);
  return Object.freeze({ required, navigationNodes: shape.navigationNodes, reached: !required || shape.navigationNodes > 0 });
}

/**
 * Fails a run whose Flow could not have started without the harness.
 *
 * It runs before the dataset judgement, because a Flow that cannot reach its
 * own page produced its records from a page somebody else opened, so what those
 * records match or miss is not evidence about the Flow. Saying "the records
 * were wrong" first would report a symptom of a page the Flow never chose.
 *
 * Counts and closed names only: the task's kind, and how many navigation nodes
 * the Flow holds. The Flow's URLs and selectors stay where they are.
 */
export function assertCreatedFlowReachesItsOwnPage(ownPage: CreatedFlowOwnPage, context: { flowId: string; taskId: string; taskKind: LiveInstructionTask["kind"] }): void {
  if (ownPage.reached) return;
  throw new RunnerFailure(
    "runtime.behavior",
    `The created Flow holds no node that reaches its own page, so a ${context.taskKind} task ran only because the harness had already loaded the page for it`,
    { details: { code: "flow_lane.flow_does_not_reach_its_page", taskId: context.taskId, taskKind: context.taskKind, navigationNodes: ownPage.navigationNodes, flowId: context.flowId } },
  );
}

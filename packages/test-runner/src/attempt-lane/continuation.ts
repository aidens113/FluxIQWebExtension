import type { AttemptContinuation } from "@fluxiq-web-extension/test-contracts";
import type { AttemptOutcome } from "./driver.js";

/**
 * Whether `later` began from what `earlier` saved, on one workspace. Each piece must
 * hold by itself, and each that does not is named, because a claim that a second
 * attempt was cheaper for its first's sake is the claim this lane exists to test: a
 * repeat that happened to spend less is refused here.
 *
 * - One task and one project, consecutive ordinals.
 * - The earlier attempt saved something with steps.
 * - The later one found exactly that saved, by digest, before it began.
 * - It went down a path that uses it, and on the Flow it saved.
 */
export function proveContinuation(earlier: AttemptOutcome, later: AttemptOutcome): AttemptContinuation {
  const refused: string[] = [];
  if (later.record.taskId !== earlier.record.taskId) refused.push("other_task");
  if (later.record.projectId !== earlier.record.projectId) refused.push("other_workspace");
  if (later.record.ordinal !== earlier.record.ordinal + 1) refused.push("not_consecutive");
  if (earlier.saved === null || earlier.saved.flowId === undefined) refused.push("first_saved_nothing");
  if (later.startedFrom === null) refused.push("second_found_nothing_saved");
  else if (earlier.saved?.draftDigest === null || later.startedFrom.draftDigest !== earlier.saved?.draftDigest) refused.push("second_found_something_else");
  if (later.record.path === "explore") refused.push("second_explored_from_blank");
  else if (later.record.flowId !== earlier.saved?.flowId) refused.push("second_ran_another_flow");
  return { fromAttempt: earlier.record.ordinal, toAttempt: later.record.ordinal, held: refused.length === 0, refused };
}

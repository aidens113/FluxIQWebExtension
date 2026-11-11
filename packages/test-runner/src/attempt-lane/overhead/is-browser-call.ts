import type { StepRecord } from "./step-record.js";

/**
 * Whether a step folder reached the domain, that is the browser: a tool step the domain answered (`web.*`) or one that
 * replayed a node (`core.replay.*`). A describe, a recall, a written draft step and a refusal (`answer_first.*`) did not.
 */
export function isBrowserCall(record: StepRecord): boolean {
  return record.kind === "tool" && record.resultCode !== null && (record.resultCode.startsWith("web.") || record.resultCode.startsWith("core.replay."));
}

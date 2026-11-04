import { ACTIVITY_MESSAGES } from "../../../../../shared/activity/index";
import { asRecord } from "../../reply";
import type { FinishedRun } from "./finished-run";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * The run an activity push says reached its final `done`, or undefined for any
 * other message: not a push, not a run, not final, failed, or stopped.
 */
export function finishedRunOf(message: unknown): FinishedRun | undefined {
  const pushed = asRecord(message);
  if (pushed?.type !== ACTIVITY_MESSAGES.changed) {
    return undefined;
  }
  const current = asRecord(asRecord(pushed.state)?.current);
  const subject = asRecord(current?.subject);
  if (current === undefined || subject?.kind !== "run" || current.final !== true || current.phase !== "done" || current.stopped === true) {
    return undefined;
  }
  const runId = text(subject.id);
  const projectId = text(subject.projectId);
  if (runId === undefined || projectId === undefined) {
    return undefined;
  }
  const flowId = text(subject.flowId);
  const conversationId = text(current.conversationId);
  return { runId, projectId, ...(flowId === undefined ? {} : { flowId }), ...(conversationId === undefined ? {} : { conversationId }) };
}

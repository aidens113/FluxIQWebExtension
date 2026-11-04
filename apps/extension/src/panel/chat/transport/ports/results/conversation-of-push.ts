import { ACTIVITY_MESSAGES } from "../../../../../shared/activity/index";
import { asRecord } from "../../reply";

/** The project and conversation any activity push names, so a run with no conversation can be placed in the latest one. */
export function conversationOfPush(message: unknown): { projectId: string; conversationId: string } | undefined {
  const pushed = asRecord(message);
  if (pushed?.type !== ACTIVITY_MESSAGES.changed) {
    return undefined;
  }
  const current = asRecord(asRecord(pushed.state)?.current);
  const projectId = asRecord(current?.subject)?.projectId;
  const conversationId = current?.conversationId;
  return typeof projectId === "string" && projectId !== "" && typeof conversationId === "string" && conversationId !== ""
    ? { projectId, conversationId }
    : undefined;
}

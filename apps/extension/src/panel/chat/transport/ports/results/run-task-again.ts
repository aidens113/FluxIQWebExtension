import type { ChatResult, ChatRunAgainQuery } from "@fluxiq/ui-components";
import { AUTOMATION_PANEL_MESSAGES } from "../../../../../shared/protocol";
import type { PanelStore } from "../../../../state";
import { payloadOf, refusalOf } from "../../reply";

const UNREADABLE = "FluxIQ's answer to running this again could not be read.";

/**
 * A person's press of Run again on an attempt's answer, through Core's `run-task-again`: a new attempt at
 * the task with an empty act record, which is what that press means and what nothing else can say
 * (`answer-first/run-again/` in Core). It names the project and the task and nothing else, so the press
 * carries the person's choice and no field a model could set. Core answers the new attempt at once, and
 * the chat reads it back as any attempt. A refusal is Core's own sentence, and an answer that is not
 * what the contract says is a failed request, never a guess.
 */
export async function runTaskAgain(request: PanelStore["request"], query: ChatRunAgainQuery): Promise<ChatResult<{ attemptId: string }>> {
  const reply = await request({ type: AUTOMATION_PANEL_MESSAGES.runTaskAgain, projectId: query.projectId, taskId: query.taskId });
  const refused = refusalOf(reply);
  if (refused !== undefined) {
    return refused;
  }
  const payload = payloadOf(reply);
  if (!payload.ok) {
    return payload;
  }
  const { attemptId } = payload.value;
  return typeof attemptId === "string" && attemptId ? { ok: true, value: { attemptId } } : { ok: false, sentence: UNREADABLE };
}

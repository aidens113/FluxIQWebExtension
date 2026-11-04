import type { ChatAddBudgetQuery, ChatResult } from "@fluxiq/ui-components";
import { AUTOMATION_PANEL_MESSAGES } from "../../../../../shared/protocol";
import type { PanelStore } from "../../../../state";
import { payloadOf, refusalOf } from "../../reply";

const UNREADABLE = "FluxIQ's answer to carrying this on could not be read.";

/**
 * Carries an attempt on as the same attempt, through Core's `carry-on-task-attempt`: `addUsd` above
 * zero for one that ran out, zero for one a restart cut off. Core answers at once and the attempt goes on
 * after the answer, so this never waits for it; the chat reads it back as it reads any attempt. A refusal
 * comes back as Core's own sentence, and an answer that is not what the contract says is a failed
 * request, never a guess.
 */
export async function carryOnAttempt(request: PanelStore["request"], query: ChatAddBudgetQuery): Promise<ChatResult<{ attemptId: string; budgetUsd: number }>> {
  const reply = await request({ type: AUTOMATION_PANEL_MESSAGES.carryOnTaskAttempt, projectId: query.projectId, attemptId: query.attemptId, addUsd: query.addUsd });
  const refused = refusalOf(reply);
  if (refused !== undefined) {
    return refused;
  }
  const payload = payloadOf(reply);
  if (!payload.ok) {
    return payload;
  }
  const { attemptId, budgetUsd } = payload.value;
  if (typeof attemptId !== "string" || !attemptId || typeof budgetUsd !== "number" || !Number.isFinite(budgetUsd)) {
    return { ok: false, sentence: UNREADABLE };
  }
  return { ok: true, value: { attemptId, budgetUsd } };
}

import type { ChatResult, ChatTaskOutcome } from "@fluxiq/ui-components";
import { AUTOMATION_PANEL_MESSAGES } from "../../../../../shared/protocol";
import type { PanelStore } from "../../../../state";
import { payloadOf, refusalOf } from "../../reply";
import { readTaskOutcome } from "./read-task-outcome";

const UNREADABLE = "FluxIQ's account of this task could not be read.";

/** One read outcome, or a failed read when it is not what Core's contract says or is not of the project asked about. */
function outcomeOfProject(value: unknown, projectId: string): ChatTaskOutcome | undefined {
  const outcome = readTaskOutcome(value);
  return outcome?.attempt.projectId === projectId ? outcome : undefined;
}

/** A thread's attempts as Core keeps them, oldest first, read through the contract. None is an empty list; any record that fails fails the read. */
export async function readThreadAttempts(request: PanelStore["request"], query: { projectId: string; conversationId: string }): Promise<ChatResult<ChatTaskOutcome[]>> {
  const reply = await request({ type: AUTOMATION_PANEL_MESSAGES.taskOutcomes, projectId: query.projectId, conversationId: query.conversationId });
  const refused = refusalOf(reply);
  if (refused !== undefined) {
    return refused;
  }
  const payload = payloadOf(reply);
  const listed = payload.ok ? payload.value.outcomes : undefined;
  if (!Array.isArray(listed)) {
    return { ok: false, sentence: UNREADABLE };
  }
  const outcomes: ChatTaskOutcome[] = [];
  for (const value of listed) {
    const outcome = outcomeOfProject(value, query.projectId);
    if (outcome === undefined) {
      return { ok: false, sentence: UNREADABLE };
    }
    outcomes.push(outcome);
  }
  return { ok: true, value: outcomes };
}

/** One attempt as Core keeps it, read through the contract. One Core cannot find, or cannot read, comes back in Core's own words. */
export async function readOneAttempt(request: PanelStore["request"], query: { projectId: string; attemptId: string }): Promise<ChatResult<ChatTaskOutcome>> {
  const reply = await request({ type: AUTOMATION_PANEL_MESSAGES.taskOutcomes, projectId: query.projectId, attemptId: query.attemptId });
  const refused = refusalOf(reply);
  if (refused !== undefined) {
    return refused;
  }
  const payload = payloadOf(reply);
  const outcome = payload.ok ? outcomeOfProject(payload.value.outcome, query.projectId) : undefined;
  return outcome === undefined ? { ok: false, sentence: UNREADABLE } : { ok: true, value: outcome };
}

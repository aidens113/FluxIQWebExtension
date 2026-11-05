import type { AttemptPath } from "@fluxiq-web-extension/test-contracts";
import { LAB_PROJECT_DOMAIN_ID } from "../../../flow-lane/index.js";

/** The attempt as Core's route answers it (`AutomationStudioTaskAttempt`), restated to what the Lab reads because this package does not depend on the contracts package. */
export type AttemptOutcomeRecord = {
  taskId: string;
  attemptId: string;
  ordinal: number;
  projectId: string;
  flowId?: string;
  runId?: string;
  path: AttemptPath;
  status: "working" | "achieved" | "finished_unchecked" | "budget_out" | "stopped_by_person" | "waiting_for_person";
  waitingFor?: string;
  spend: { calls: number; inputTokens: number; outputTokens: number; usd: number; ms: number };
  budget: { usd: number };
  liveSteps: number;
  simulation?: { verdict: "passed" | "failed" | "inconclusive" | "not_run"; flags: number };
  loopsCaught: Record<string, { steered: number; refused: number; changeApproach: number; askPerson: number }>;
  /** Lasting acts Core could not tie to a row (a known limit it measures); absent reads as zero. */
  actsWithNoRow?: number;
  startedAtMs: number;
  endedAtMs?: number;
};

/** What the route says of its rows and acts. Which dataset to read, and how many rows the store holds; what was shown is read from the panel. */
export type AttemptResultRecord = {
  attemptId: string;
  kind: "rows" | "done_on_site" | "plain_answer" | "partial";
  rows?: { runId: string; datasetId: string; totalRows: number; truncated: boolean; columns: readonly { id: string; label: string }[] };
  acts: readonly { state: string }[];
};

/** `get-task-attempt`'s and `list-conversation-task-attempts`' one outcome, the read the extension uses. */
export type AttemptOutcomeRead = {
  attempt: AttemptOutcomeRecord;
  result?: AttemptResultRecord;
  saved?: { state: "ready" | "partly_works" | "notes_only" | "needs_you"; flowId?: string };
};

/** The one Core call these reads make; `ExistingFluxIQControlClient` satisfies it. */
export type AttemptReadControl = { automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: { timeoutMs?: number }, domainId?: string): Promise<unknown> };

/** One attempt, or a refusal Core gave for it thrown as its sentence. */
export async function readTaskAttempt(control: AttemptReadControl, projectId: string, attemptId: string): Promise<AttemptOutcomeRead> {
  const answer = await control.automationStudioCall("get-task-attempt", { projectId, attemptId }, {}, LAB_PROJECT_DOMAIN_ID) as { outcome?: AttemptOutcomeRead };
  if (!answer.outcome) throw new Error(`Core answered get-task-attempt with no outcome for ${attemptId}`);
  return answer.outcome;
}

/** A thread's attempts, oldest first. */
export async function readThreadAttempts(control: AttemptReadControl, projectId: string, conversationId: string): Promise<readonly AttemptOutcomeRead[]> {
  const answer = await control.automationStudioCall("list-conversation-task-attempts", { projectId, conversationId }, {}, LAB_PROJECT_DOMAIN_ID) as { outcomes?: readonly AttemptOutcomeRead[] };
  return answer.outcomes ?? [];
}

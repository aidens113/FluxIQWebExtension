import type { ChatTaskOutcome } from "@fluxiq/ui-components";
import type { FinishedRun } from "./finished-run";

/** One finished run's outcome, once read, beside where the feed placed it. */
export type ThreadOutcome = { run: FinishedRun; outcome: ChatTaskOutcome };

/** The outcomes this panel session has seen, oldest first, and the latest conversation each project spoke in. */
export type ThreadOutcomes = {
  add(entry: ThreadOutcome): void;
  /** Notes that a project spoke in a conversation, for runs that name none. */
  noteConversation(projectId: string, conversationId: string): void;
  inThread(projectId: string, conversationId: string): ChatTaskOutcome[];
  byTask(projectId: string, taskId: string): ChatTaskOutcome | undefined;
  byAttempt(projectId: string, attemptId: string): ChatTaskOutcome | undefined;
};

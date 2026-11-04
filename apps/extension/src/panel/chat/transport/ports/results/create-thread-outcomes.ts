import type { ThreadOutcome, ThreadOutcomes } from "./thread-outcomes";

/** Holds a panel session's outcomes in memory only: recorded page data is never written anywhere. */
export function createThreadOutcomes(): ThreadOutcomes {
  const entries: ThreadOutcome[] = [];
  const latestConversation = new Map<string, string>();
  return {
    add(entry) {
      const at = entries.findIndex((held) => held.outcome.attempt.attemptId === entry.outcome.attempt.attemptId);
      if (at >= 0) {
        entries[at] = entry;
      } else {
        entries.push(entry);
      }
    },
    noteConversation(projectId, conversationId) {
      latestConversation.set(projectId, conversationId);
    },
    inThread(projectId, conversationId) {
      return entries
        .filter(({ run }) => run.projectId === projectId && (run.conversationId ?? latestConversation.get(projectId)) === conversationId)
        .map(({ outcome }) => outcome);
    },
    byTask(projectId, taskId) {
      return [...entries].reverse().find(({ outcome }) => outcome.attempt.projectId === projectId && outcome.attempt.taskId === taskId)?.outcome;
    },
    byAttempt(projectId, attemptId) {
      return entries.find(({ outcome }) => outcome.attempt.projectId === projectId && outcome.attempt.attemptId === attemptId)?.outcome;
    }
  };
}

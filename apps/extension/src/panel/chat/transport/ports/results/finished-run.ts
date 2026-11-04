/** A run the activity feed reported finished and done, with what the feed said about where it belongs. */
export type FinishedRun = {
  runId: string;
  projectId: string;
  flowId?: string;
  /** Absent when the feed named none: the run belongs to its project's latest thread. */
  conversationId?: string;
};

/** One moment Core wants the page's state digested at, named by the action it brackets. */
export type WebLlmStateDigestRequest = {
  projectId: string;
  flowId: string;
  /** The exploration step's call id, the same one its trace entry carries. */
  callId: string;
  toolId: string;
  /** Whether the action is about to run, or has just run. */
  phase: "before" | "after";
  /**
   * Where the Flow being built starts, when the build was told
   * (`AS/runtime/flow-bootstrap/start-location.ts`). Present, nothing was
   * opened for this build, so before its first step there is no page to digest.
   */
  startLocation?: string;
  signal?: AbortSignal;
};

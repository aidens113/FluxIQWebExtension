/** Safe measured evidence. Credentials, key values and request bodies never enter this record. */
export type ApprovedClientAccessObservation = {
  steps: Array<{ name: string; readiness: string; panelHasUnlockPrompt: boolean }>;
  probes: Array<{ name: string; bearer: boolean; status: number; modelCalls: number; stubReceivedProbe: boolean; pairedReadReturnedReply: boolean }>;
  revokedRequestStatus: number;
  /** A turn the panel wrote reaching the open extension chat; measured times only. */
  panelTurnPush?: { conversationId: string; quietBeforeWriteMs: number; arrivedAfterMs: number | null; readsAfterWrite: number };
  /** A panel page held open across the Core restart; stream answers and rows only. */
  panelStream?: { openingsBeforeRestart: number; openingsAfterRestart: number; caughtUpAfterReopen: boolean; changeShownAfterMs: number | null };
  checks: Record<string, boolean>;
};

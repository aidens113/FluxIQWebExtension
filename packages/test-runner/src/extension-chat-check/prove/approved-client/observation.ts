/** Safe measured evidence. Credentials, key values and request bodies never enter this record. */
export type ApprovedClientAccessObservation = {
  steps: Array<{ name: string; readiness: string; panelHasUnlockPrompt: boolean }>;
  probes: Array<{ name: string; bearer: boolean; status: number; modelCalls: number; stubReceivedProbe: boolean; pairedReadReturnedReply: boolean }>;
  revokedRequestStatus: number;
  checks: Record<string, boolean>;
};

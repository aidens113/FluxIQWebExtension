// What a completed creation run is allowed to report. Each of these is the
// narrowed, frozen shape a caller receives: the proposal checkpoint that a
// provider-free exploration stops at, the accounting of the one paid call,
// and the topology an applied proposal actually built.

import { type LlmModel } from "@fluxiq-web-extension/test-contracts";
export type EvidenceGuidedCreationCheckpoint = Readonly<{
  adaptationId: string; status: "proposed"; provider: "deepseek"; model: LlmModel;
  providerCallCount: number; toolCallCount: number; evidenceBytes: number; toolIds: string[];
  inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number;
}>;

export type LiveCreationGeneration = Readonly<{
  adaptationId: string; baseExecutionDigest: string; proposalDigest: string; requestId: string;
  provider: "deepseek"; model: LlmModel; promptSchemaVersion: string;
  inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number; latencyMs: number;
}>;

export type LiveCreationTopology = Readonly<{
  resultingExecutionDigest: string; routerId: string; routerSubflowId: string; ownedSubflowId: string;
  graphFlowId: string; nodeCount: number; edgeCount: number; executableNodeCount: number;
  overlappingPositionCount: 0; recordingProvenanceAbsent: true;
}>;

import type { FluxIQ, RunOutcome } from "@fluxiq/sdk";

type SavedFlow = Awaited<ReturnType<FluxIQ["exportFlow"]>>;

/** Checks the exact saved predecessor and actual decision counts, not the provider bill. */
export function hostProofContinuation(input: {
  predecessor: Pick<SavedFlow, "flowId" | "stepsDigest" | "flowVersion">;
  before: Pick<SavedFlow, "flowId" | "stepsDigest" | "flowVersion">;
  result: Pick<RunOutcome<unknown>, "flowId" | "path" | "cost" | "status">;
  scriptedRequests: number;
}): boolean {
  return input.predecessor.stepsDigest !== undefined && input.before.stepsDigest === input.predecessor.stepsDigest
    && input.before.flowVersion === input.predecessor.flowVersion && input.before.flowId === input.predecessor.flowId
    && input.result.flowId === input.predecessor.flowId && input.result.path === "replayed" && input.result.status === "achieved"
    && input.result.cost.calls === 0 && input.scriptedRequests === 0;
}

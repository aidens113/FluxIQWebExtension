// What Core recorded about a repair it checked without running it. Since Core
// `a2de143` a proposal-only target override carries no validation result -- a
// validation entry means it ran and was compared -- and the check that did
// happen is written to the adaptation's metadata instead. The control client
// does not carry that metadata, so the lanes read the two facts they judge
// here: how the target resolved, and each structural check's status.

import type { ExistingFluxIQControlClient } from "../../existing-fluxiq-control.js";

export type TargetProposalStructure = Readonly<{
  targetResolution?: string;
  structuralCheckStatuses: readonly string[];
}>;

const STATUS = /^[a-z_]{1,32}$/u;

export async function readTargetProposalStructure(
  control: Pick<ExistingFluxIQControlClient, "automationStudioCall">,
  projectId: string,
  flowId: string,
  adaptationId: string,
): Promise<TargetProposalStructure> {
  const payload = await control.automationStudioCall("get-flow-adaptation", { projectId, flowId, adaptationId });
  const metadata = record(record(payload)?.adaptation)?.metadata;
  const fields = record(metadata);
  const resolution = fields?.targetResolution;
  const checks = Array.isArray(fields?.structuralChecks) ? fields.structuralChecks : [];
  return Object.freeze({
    ...(typeof resolution === "string" && STATUS.test(resolution) ? { targetResolution: resolution } : {}),
    structuralCheckStatuses: Object.freeze(checks.slice(0, 16).map(check => {
      const status = record(check)?.status;
      return typeof status === "string" && STATUS.test(status) ? status : "invalid";
    })),
  });
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

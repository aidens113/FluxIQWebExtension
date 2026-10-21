// The trial ports an offline trial runs with: the ports a live whole-candidate
// trial of a build gets, made from the host's own Automation Studio service by
// Core's exported seam (`automationStudioServiceWholeTrialPorts`), which is the
// build's own composition -- the registry and resolution for the parent Flow's
// scope, the trial environment from the service's collaborators, the whole
// ports with the bound domain's trial reads.
//
// Two members differ from a live build's, both by design and both Core's:
// - `judge` is the experiment's (`../not-judged-judge.ts`): no model is called;
// - there is no `prepareStart`: the offline runner runs no start hook and no
//   site reset for a trace environment (Decision 6).

import { automationStudioServiceWholeTrialPorts, type AutomationStudioCandidateTrialPorts, type AutomationStudioService } from "fluxiq/automation-studio";

/** The candidate trial's ports, as Core's runner takes them. */
export type OfflineTrialPorts = AutomationStudioCandidateTrialPorts;

export async function offlineTrialPorts(input: {
  service: AutomationStudioService;
  projectId: string;
  flowId: string;
  sourceInstructionIds: readonly string[];
  startLocation: string;
  judge: OfflineTrialPorts["judge"];
}): Promise<OfflineTrialPorts> {
  const { service, ...request } = input;
  return await automationStudioServiceWholeTrialPorts(service, request);
}

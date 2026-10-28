import type { ScenarioDemonstrationDetour } from "@fluxiq-web-extension/test-contracts";
import {
  assertGenerationInstructionLinksRecording, assertNoDetourCopied, assertRecordingSetChangedByExactly, readCreatedFlowGraph,
  type InstructionListingControl,
} from "../../flow-lane/index.js";

type FactsControl = InstructionListingControl & Parameters<typeof readCreatedFlowGraph>[0] & { listRecordings(projectId: string): Promise<unknown> };

/**
 * What must hold after a recorded-evidence build created its Flow, each a named fact a failure
 * quotes: the project's recordings changed by exactly the demonstration's recording, finalized and
 * described (`recording.set`, `recording.finalized`, `recording.described`); the Flow's saved
 * generation instruction links that recording and no other (`instruction.linked`); and the Flow
 * carries out no act of the demonstration's detours (`detour.copied`).
 */
export async function assertRecordedEvidenceFacts(control: FactsControl, input: Readonly<{
  projectId: string; flowId: string; domainId: string;
  recorded: Readonly<{ recordingId: string; description: string; before: ReadonlySet<string> }>;
  detours: readonly ScenarioDemonstrationDetour[];
}>): Promise<void> {
  assertRecordingSetChangedByExactly(input.recorded.before, await control.listRecordings(input.projectId), input.recorded);
  await assertGenerationInstructionLinksRecording(control, { projectId: input.projectId, flowId: input.flowId, domainId: input.domainId }, input.recorded.recordingId);
  assertNoDetourCopied(await readCreatedFlowGraph(control, { projectId: input.projectId, flowId: input.flowId }), input.detours);
}

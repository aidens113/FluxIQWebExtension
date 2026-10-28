import { RunnerFailure } from "../../../failure.js";

/** The one Core call this reads through; the lane's control satisfies it. */
export type InstructionListingControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: { timeoutMs?: number }, domainId?: string): Promise<unknown>;
};

/**
 * The Flow's saved generation instruction links the demonstration's recording and no other: Core's
 * `save-flow-generation-instruction` stores `linkedRecordingIds` on the instruction the chat's
 * `flow.createHere` saved, and it is the only place the attachment can be read back from. Read
 * through `get-flow-instruction-set`, the same listing the judgement and repair read.
 */
export async function assertGenerationInstructionLinksRecording(control: InstructionListingControl, scope: Readonly<{ projectId: string; flowId: string; domainId: string }>, recordingId: string): Promise<void> {
  const answer = await control.automationStudioCall("get-flow-instruction-set", { projectId: scope.projectId, flowId: scope.flowId }, { timeoutMs: 15_000 }, scope.domainId);
  assertLinks(answer, recordingId);
}

/** The judgement itself, over Core's answer. */
export function assertLinks(answer: unknown, recordingId: string): void {
  const payload = answer !== null && typeof answer === "object" ? (answer as { instructions?: unknown; payload?: { instructions?: unknown } }) : {};
  const listed = payload.payload?.instructions ?? payload.instructions;
  const instructions = Array.isArray(listed) ? listed.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object") : [];
  const generation = instructions.filter((item) => Array.isArray(item.tags) && item.tags.includes("generation") && (item.scope as { kind?: unknown } | undefined)?.kind === "flow");
  if (generation.length !== 1) {
    throw new RunnerFailure("runtime.behavior", `The Flow holds ${generation.length} saved generation instructions; the recorded-evidence lane expects exactly one`, { details: { fact: "instruction.linked", generationInstructions: generation.length } });
  }
  const linked = generation[0]!.linkedRecordingIds;
  if (!Array.isArray(linked) || linked.length !== 1 || linked[0] !== recordingId) {
    throw new RunnerFailure("runtime.behavior", `The Flow's saved generation instruction links ${Array.isArray(linked) ? linked.length : 0} recording(s), not exactly the demonstration's ${recordingId}`, { details: { fact: "instruction.linked", linkedCount: Array.isArray(linked) ? linked.length : null } });
  }
}

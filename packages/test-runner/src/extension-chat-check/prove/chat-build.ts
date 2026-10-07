import { failedCreatedFlowBuild, buildCreatedFlowFromChat, LAB_PROJECT_DOMAIN_ID, type CreatedFlowChatBuild } from "../../flow-lane/index.js";
import type { ExistingFluxIQControlClient } from "../../existing-fluxiq-control.js";
import type { ChatCheckContext } from "../types.js";

/**
 * What a person types to have FluxIQ build an automation: what the automation
 * should do, said so that FluxIQ can tell it is a request to build even with no
 * model to read it (`create a flow that` is one of `flow.createHere`'s own
 * phrases in Core), which is the only reading this provider-free check has.
 */
export const CHAT_BUILD_MESSAGE = "Create a flow that lists the name and price of the first three wireless earbuds in the search results";

export type ChatBuildObservation = {
  message: string;
  result: CreatedFlowChatBuild;
  /** The instruction Core saved on the Flow the chat made, as Core holds it. */
  savedInstruction: string | null;
  checks: Record<string, boolean>;
};

/**
 * Claim 4: the created-Flow lane's chat stage (`flow-lane/creation/chat/`)
 * drives the real panel, and a build starts from what was typed.
 *
 * The stage types the message into the chat the person sees and follows what
 * FluxIQ made of it through Core. With no model key in this check, Core's chat
 * reads the words itself, takes them as `flow.createHere` with the message as
 * its instruction, creates the Flow and saves the instruction, and the build
 * then stops because the person's model key is locked -- which the stage must
 * report as a failed build of the Flow it made, with FluxIQ's own account of
 * how far it got, and never as anything that could pass.
 */
export async function proveChatBuild(context: ChatCheckContext, input: { control: Pick<ExistingFluxIQControlClient, "automationStudioCall" | "listFlowAdaptations" | "getFlowAdaptation">; screenshot: (name: string) => Promise<unknown> }): Promise<ChatBuildObservation> {
  // Qualification cannot safely send a paid build while verification is unsupported.
  void context; void input;
  return { message: CHAT_BUILD_MESSAGE, result: { build: failedCreatedFlowBuild({ code: "lab.candidate_verification_unavailable", stage: "before_provider", httpStatus: null }, "not_attempted", 0), flowId: null, applied: null, said: "Created-Flow qualification is unavailable; no chat build was sent." }, savedInstruction: null,
    checks: { qualificationAvailable: false, noBuildDispatched: true, noFlowApplied: true } };
}

/** The Flow's active generation instruction, as Core holds it. */
async function activeInstruction(control: Pick<ExistingFluxIQControlClient, "automationStudioCall">, projectId: string, flowId: string): Promise<string | null> {
  const listed = await control.automationStudioCall("list-flow-instructions", { projectId, flowId, status: "active" }, {}, LAB_PROJECT_DOMAIN_ID) as { instructions?: Array<{ instructionId?: unknown; body?: unknown }> };
  const first = listed.instructions?.[0];
  if (typeof first?.body === "string") return first.body;
  if (typeof first?.instructionId !== "string") return null;
  const read = await control.automationStudioCall("get-flow-instruction", { projectId, instructionId: first.instructionId }, {}, LAB_PROJECT_DOMAIN_ID) as { instruction?: { body?: unknown } };
  return typeof read.instruction?.body === "string" ? read.instruction.body : null;
}

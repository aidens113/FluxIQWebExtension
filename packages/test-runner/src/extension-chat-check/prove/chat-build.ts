import type { AutomationStudioAuthoringMode } from "fluxiq/automation-studio";
import { createdFlowVerificationReady, failedCreatedFlowBuild, buildCreatedFlowFromChat, LAB_PROJECT_DOMAIN_ID, type CreatedFlowChatBuild } from "../../flow-lane/index.js";
import { labAuthoringModeValue } from "../../live-llm/index.js";
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
 *
 * That is Core's legacy authoring mode, the default. `authoringMode` is the mode
 * the check's Core was started in (its `--authoring-mode`, read the way
 * `buildFluxIQEnvironment` read it); in candidate mode qualification is
 * unavailable, so nothing is typed, read or pictured and no build is sent.
 */
export async function proveChatBuild(context: ChatCheckContext, input: { control: Pick<ExistingFluxIQControlClient, "automationStudioCall" | "listFlowAdaptations" | "getFlowAdaptation">; screenshot: (name: string) => Promise<unknown>; authoringMode?: AutomationStudioAuthoringMode }): Promise<ChatBuildObservation> {
  const authoringMode = input.authoringMode ?? labAuthoringModeValue();
  if (!createdFlowVerificationReady(authoringMode)) {
    return { message: CHAT_BUILD_MESSAGE, result: { build: failedCreatedFlowBuild({ code: "lab.candidate_verification_unavailable", stage: "before_provider", httpStatus: null }, "not_attempted", 0), flowId: null, applied: null, said: "Created-Flow qualification is unavailable in candidate authoring mode; no chat build was sent." }, savedInstruction: null,
      checks: { qualificationAvailable: false, noBuildDispatched: true, noFlowApplied: true } };
  }
  const panel = context.session.panel;
  if (!panel) throw new Error("The chat is not open, so there is nowhere to type");
  const result = await buildCreatedFlowFromChat(input.control, {
    panelInput: panel.input,
    type: text => panel.send(text),
    shows: () => panel.text(),
    picture: async moment => { await input.screenshot(`chat-build-${moment}`).catch(/* best-effort: a picture never decides the claim */ () => undefined); },
  }, { projectId: context.projectId, domainId: LAB_PROJECT_DOMAIN_ID, instruction: CHAT_BUILD_MESSAGE, authoringMode }, { startMs: 30_000, deadlineMs: 180_000 });
  context.log(`[chat-check] chat build: became ${result.build.chat?.became}, ending ${result.build.chat?.ending}, flow ${result.flowId ? "made" : "none"}, failure ${result.build.failure?.code ?? "none"}`);
  const savedInstruction = result.flowId ? await activeInstruction(input.control, context.projectId, result.flowId) : null;
  const chat = result.build.chat;
  return {
    message: CHAT_BUILD_MESSAGE,
    result,
    savedInstruction,
    checks: {
      stageFoundThePersonTurn: chat !== undefined && chat.personTurn > 0,
      fluxiqStartedABuild: chat?.became === "build",
      fluxiqMadeTheFlow: result.flowId !== null,
      theMessageIsTheInstruction: savedInstruction === CHAT_BUILD_MESSAGE,
      theBuildEndedInTheThread: chat?.resultTurn !== null && chat?.resultTurn !== undefined,
      noModelMeansNoFlowIsApplied: result.applied === null && result.build.outcome === "failed",
      fluxiqSaidWhy: typeof result.said === "string" && /model key is locked/u.test(result.said),
    },
  };
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

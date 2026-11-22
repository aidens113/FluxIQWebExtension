import { sendChatMessage, type ChatCheckContext } from "../../extension-chat-check/index.js";
import type { ExistingFluxIQControlClient } from "../../existing-fluxiq-control.js";
import { saveOfflinePreflightProbe } from "./save-probe.js";

/** A real extension chat run, a real person confirmation, and a successful domain read. */
export async function proveOfflinePreflightRead(input: { context: ChatCheckContext; control: ExistingFluxIQControlClient; authorizationPin: string }) {
  const { context, control } = input;
  const probe = await saveOfflinePreflightProbe(control, { projectId: context.projectId, authorizationPin: input.authorizationPin });
  const { call, conversationId } = await sendChatMessage(context, `Run the ${probe.name} flow`);
  const started = (call.response as { payload?: { response?: { execution?: { capabilityId?: string; status?: string } } } } | null)?.payload?.response?.execution;
  const pending = await context.reader.waitFor(conversationId, "the generic read probe confirmation", (turns) => turns.find((turn) => turn.ask?.kind === "confirm" && turn.ask.status === "pending"));
  const askId = pending.ask!.askId;
  await context.session.panel!.press("Yes", 30_000);
  const settled = await context.reader.waitFor(conversationId, "the generic read probe answer", (turns) => turns.find((turn) => turn.ask?.askId === askId && turn.ask.status === "answered"));
  await context.reader.waitFor(conversationId, "the generic read probe result", (turns) => turns.find((turn) => turn.ordinal > pending.ordinal && turn.attachment?.kind === "panel-capability-result" && turn.attachment.ref === "run.execute"));
  const runs = await control.listFlowRuns(context.projectId, probe.flowId);
  const run = runs[0];
  const actions = run ? await control.listRunActions(context.projectId, run.runId) : [];
  return {
    chatStarted: started?.capabilityId === "run.execute" && started.status === "started",
    personAnswered: settled.ask?.answer?.kind === "grant",
    readSucceeded: run?.status === "succeeded" && actions.some((action) => action.nodeId.endsWith("read-page") && action.status === "succeeded"),
    probeFlowId: probe.flowId,
    probeRunId: run?.runId ?? null,
    askId,
  };
}

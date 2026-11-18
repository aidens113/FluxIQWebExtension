import { runtimeMessage } from "../../../run-lifecycle/index.js";
import type { ChatCheckContext } from "../../types.js";
import type { ApprovedClientAccessObservation } from "./observation.js";

/** An actual paired request must reach the stub and its answer must be readable with paired authority. */
export async function probeApprovedClientModel(context: ChatCheckContext, name: string, fixture: { calls(): readonly { answered: boolean }[]; receipts(): readonly string[] }): Promise<ApprovedClientAccessObservation["probes"][number]> {
  const beforeCalls = fixture.calls().length;
  const beforeReceipts = fixture.receipts().length;
  const beforeRequests = context.coreCalls().length;
  const text = `Check approved client access: ${name}`;
  // The real background chooses its paired credential. No operator cookie or test resolver participates.
  await runtimeMessage(context.session.control, { type: "fluxiq.panel.conversationSend", projectId: context.projectId, text });
  const call = context.coreCalls().slice(beforeRequests).find((candidate) => candidate.endpoint === "append-turn" && (candidate.request as { text?: unknown } | null)?.text === text);
  const conversationId = (call?.request as { conversationId?: unknown } | undefined)?.conversationId;
  if (!call || typeof conversationId !== "string") throw new Error("The paired model probe recorded no matching conversation request.");
  const reply = await runtimeMessage(context.session.control, { type: "fluxiq.panel.conversationRead", kind: "get", projectId: context.projectId, conversationId, limit: 200 }) as { payload?: { conversation?: { turns?: Array<{ author?: string; text?: string }> } } };
  const calls = fixture.calls().slice(beforeCalls);
  return {
    name,
    bearer: call.bearer,
    status: call.status,
    modelCalls: calls.length,
    stubReceivedProbe: calls.length > 0 && calls.every((entry) => entry.answered) && fixture.receipts().slice(beforeReceipts).includes(name),
    pairedReadReturnedReply: (reply.payload?.conversation?.turns ?? []).some((turn) => turn.author === "automation" && turn.text === `Approved client access confirmed: ${name}`)
  };
}

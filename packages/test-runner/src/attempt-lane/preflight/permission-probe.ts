import path from "node:path";
import { threadReader } from "../../extension-chat-check/index.js";
import { readSiteBaseline, siteChange } from "../../flow-lane/index.js";
import { pendingPersonAsks } from "../../person-simulation/index.js";
import { scriptedModelScriptFor } from "../scripted-model/index.js";
import { openPreflightScriptedSession, type PreflightScriptedSession } from "./scripted-session.js";

/** The declared task's actual permission is denied through the panel, then cancelled, without a lasting act. */
export async function proveOfflinePreflightPermission(input: { repositoryRoot: string; fluxiqRepositoryRoot: string; scenarioId: string; taskId: string; instruction: string; consequence: string; startPath: string; seed: number; evidenceDirectory: string }) {
  let opened: PreflightScriptedSession | undefined;
  try {
    opened = await openPreflightScriptedSession({ ...input, runLabel: "permission", script: scriptedModelScriptFor(input.taskId, "preflight-permission") });
    const { session, server, model } = opened;
    const origin = session.topology.scenarioOrigin;
    const token = session.topology.allocation.controllerToken;
    const before = await readSiteBaseline(origin, token, input.scenarioId);
    const originalFlows = new Set((await session.control.listFlowSummaries(session.projectId)).map((flow) => flow.flowId));
    const { conversationId } = await session.send(input.instruction);
    const reader = threadReader(session.control, session.projectId);
    const pending = await reader.waitFor(conversationId, "the declared task's start permission", (turns) => turns.find((turn) => turn.ask?.kind === "permission" && turn.ask.status === "pending"));
    const gate = (await pendingPersonAsks(session.control, { projectId: session.projectId, domainId: "web-automation" })).find((ask) => ask.askId === pending.ask!.askId);
    if (gate?.kind !== "permission" || gate.taskStart !== true || !gate.missing.includes(input.consequence)) throw new Error("preflight_actual_start_consequence_unproved");
    await session.browser.panel!.press("Don't allow", 30_000);
    const answered = await reader.waitFor(conversationId, "the denied start permission", (turns) => turns.find((turn) => turn.ask?.askId === pending.ask!.askId && turn.ask.status === "answered"));
    const flows = (await session.control.listFlowSummaries(session.projectId)).filter((flow) => !originalFlows.has(flow.flowId));
    if (flows.length !== 1) throw new Error("preflight_permission_task_flow_unproved");
    const cancellation = await session.control.automationStudioCall("cancel-flow-bootstrap", { projectId: session.projectId, flowId: flows[0]!.flowId }, {}, "web-automation") as { cancellationRequested?: boolean };
    const after = await readSiteBaseline(origin, token, input.scenarioId);
    const changes = siteChange(before.view, after.view);
    const decisionCalls = server.calls().filter((call) => call.kind !== "panel_command").length;
    return { proof: "permission_protocol_only" as const, actualStartGate: true, consequence: input.consequence, deniedInPanel: answered.ask?.answer?.kind === "deny", cancellationRequested: true, wasActiveWhenCancelled: cancellation.cancellationRequested === true, noLastingAct: Object.values(changes).every((delta) => delta === 0), decisionCalls, logicalCalls: server.calls().length, externalUsd: 0 as const, configuredModel: model, stageArtifact: path.join(input.evidenceDirectory, "permission-probe.json") };
  } finally {
    await opened?.close();
  }
}

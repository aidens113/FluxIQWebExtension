// The panel's Stop: ends a FluxIQ run through Core's `cancel-runtime-session`.
//
// The command a run sends the extension carries no run ID (a gateway
// `execute_action` names a step, not the run it belongs to), so the panel often
// cannot say which run to stop. Given a run, this stops that run. Given none,
// it asks Core which of the project's runs have not ended and stops each of
// them: a person pressing Stop means "stop what FluxIQ is doing here", and a
// project runs one adaptive run at a time. Stopping removes nothing, so no
// permission is asked (Core registers it as `authoring`).
//
// Take over and Hand back hold a live run with the page handed to the person
// (`pause-runtime-session`, `takeControl: true`) and let it go on from where it
// stopped (`resume-runtime-session`, `afterManualAction: true`). Both need the
// run named: unlike Stop there is no "every run" reading, because handing the
// page over is about one run the person is watching. Only the named fields are
// sent; anything else in the panel's message stays here.

import type { PanelHandBackRunRequest, PanelRelayResponse, PanelStopRunRequest, PanelTakeOverRunRequest } from "../../shared/protocol";
import type { PanelRelayContext } from "./relay-context";
import { relayFailure } from "./relay-failure";

/** The runs Core is asked about when no run is named: the most recently updated first. */
const ACTIVE_RUN_SCAN_LIMIT = 25;

/** A run in one of these states is over; anything else is still going, or waiting to. */
const ENDED_RUN_STATES = new Set(["succeeded", "failed", "cancelled"]);

const STOP_REASON = "Stopped from the browser extension.";

export async function stopRun(message: Partial<PanelStopRunRequest>, context: PanelRelayContext): Promise<PanelRelayResponse> {
  const projectId = text(message.projectId) ?? text(await context.projectId());
  if (!projectId) return relayFailure("no_project");
  const runId = text(message.runId);
  const flowId = text(message.flowId);
  if (runId && flowId) return { ok: false, code: "failed", error: "Stop must name a run or a build, not both." };
  if (flowId) return context.call("cancel-flow-bootstrap", { projectId, flowId });
  if (runId) return context.call("cancel-runtime-session", { projectId, runId, reason: STOP_REASON });

  const listed = await context.call("list-runtime-sessions", { projectId, summaries: true, limit: ACTIVE_RUN_SCAN_LIMIT });
  if (!listed.ok) return listed;
  const runs = (listed.payload as { runtimeSessions?: unknown } | null)?.runtimeSessions;
  const active = (Array.isArray(runs) ? runs : [])
    .map((run) => run as { runId?: unknown; status?: unknown })
    .filter((run) => typeof run.runId === "string" && typeof run.status === "string" && !ENDED_RUN_STATES.has(run.status))
    .map((run) => run.runId as string);

  const runtimeSessions: unknown[] = [];
  for (const activeRunId of active) {
    const stopped = await context.call("cancel-runtime-session", { projectId, runId: activeRunId, reason: STOP_REASON });
    if (!stopped.ok) return stopped;
    runtimeSessions.push((stopped.payload as { runtimeSession?: unknown } | null)?.runtimeSession ?? null);
  }
  return { ok: true, payload: { runtimeSessions } };
}

export async function takeOverRun(message: Partial<PanelTakeOverRunRequest>, context: PanelRelayContext): Promise<PanelRelayResponse> {
  const target = await runTarget(message, context, "Take over needs the run it is for.");
  if (!target.ok) return target.failure;
  return context.call("pause-runtime-session", { projectId: target.projectId, runId: target.runId, takeControl: true });
}

export async function handBackRun(message: Partial<PanelHandBackRunRequest>, context: PanelRelayContext): Promise<PanelRelayResponse> {
  const target = await runTarget(message, context, "Hand back needs the run it is for.");
  if (!target.ok) return target.failure;
  return context.call("resume-runtime-session", { projectId: target.projectId, runId: target.runId, afterManualAction: true });
}

type RunTarget = { ok: true; projectId: string; runId: string } | { ok: false; failure: PanelRelayResponse };

/** The run a hold names, refused before Core is called when the run or the project is missing. */
async function runTarget(message: { projectId?: unknown; runId?: unknown }, context: PanelRelayContext, missingRun: string): Promise<RunTarget> {
  const runId = text(message.runId);
  if (!runId) return { ok: false, failure: relayFailure("invalid_request", missingRun) };
  const projectId = text(message.projectId) ?? text(await context.projectId());
  if (!projectId) return { ok: false, failure: relayFailure("no_project") };
  return { ok: true, projectId, runId };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

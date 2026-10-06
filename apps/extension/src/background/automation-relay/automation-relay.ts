// Automation panel's relays (`AUTOMATION_PANEL_MESSAGES`): saved automations and their
// runs, running one, a run's facts, a dataset's export, whether an AI model key
// is set, and turning the last recording into an automation.
//
// Shaped like `panel/panel-control.ts`: only the side panel or the popup may
// ask (`control-page.ts`), and each relay sends Core exactly the fields named
// below -- never the panel's message spread into a request -- so a panel cannot
// widen what the pairing token asks for. Core narrows the same requests again
// on its side (`apps/web/src/lib/program-route.ts` in FluxIQ Core), and the two
// checks are meant to both hold.
//
// A reply carries Core's payload as Core returned it, with one exception: the
// AI-key snapshot is cut to each key's kind, provider and enabled flag here as
// well as in Core, so an older Core that answered whole summaries still puts
// no key name or metadata in the panel.

import { AUTOMATION_PANEL_MESSAGES, type PanelRelayResponse, type AutomationPanelRequest } from "../../shared/protocol";

export type AutomationRelayDeps = {
  readonly isControlPage: (sender: chrome.runtime.MessageSender) => boolean;
  /** A Core program call carrying the pairing token (`callCoreProgram`). */
  readonly call: (endpoint: string, payload: Record<string, unknown>, programId?: string) => Promise<PanelRelayResponse>;
  /** The project this browser's session belongs to. */
  readonly projectId: () => string | null | undefined;
  readonly lastStoppedRecordingId: () => string | undefined;
  readonly removeRecordedStep: (activityId: string) => Promise<PanelRelayResponse>;
};

type ControlResult = { readonly handled: false } | { readonly handled: true; readonly response: PanelRelayResponse };

/** How many runs the automations list reads; the panel joins each Flow to its newest. */
export const AUTOMATION_RUN_LIST_LIMIT = 50;

const MESSAGES: ReadonlySet<string> = new Set(Object.values(AUTOMATION_PANEL_MESSAGES));

export async function handleAutomationRelay(
  message: { type?: unknown } & AutomationPanelRequest,
  sender: chrome.runtime.MessageSender,
  deps: AutomationRelayDeps
): Promise<ControlResult> {
  if (typeof message.type !== "string" || !MESSAGES.has(message.type)) return { handled: false };
  if (!deps.isControlPage(sender)) return { handled: true, response: failure("forbidden", "Only the FluxIQ panel can do that.") };
  return { handled: true, response: await respond(message.type, message, deps) };
}

async function respond(type: string, message: AutomationPanelRequest, deps: AutomationRelayDeps): Promise<PanelRelayResponse> {
  if (type === AUTOMATION_PANEL_MESSAGES.removeRecordingStep) {
    const entryId = text(message.entryId);
    return entryId ? deps.removeRecordedStep(entryId) : missing("entryId");
  }
  if (type === AUTOMATION_PANEL_MESSAGES.modelReadiness) return modelReadiness(deps);

  const projectId = text(message.projectId) ?? text(deps.projectId());
  if (!projectId) return failure("no_project", "FluxIQ has not said which project this browser belongs to yet. Connect, then try again.");

  switch (type) {
    case AUTOMATION_PANEL_MESSAGES.listAutomations:
      return listAutomations(projectId, deps);
    case AUTOMATION_PANEL_MESSAGES.runAutomation: {
      // A saved automation the person runs may be repaired with their own model
      // key when the page has changed since it was built.
      const flowId = text(message.flowId);
      return flowId ? deps.call("run-runtime-session", { projectId, flowId, runIntent: "explore_and_adapt" }) : missing("flowId");
    }
    case AUTOMATION_PANEL_MESSAGES.testGeneratedAutomation: {
      // A test of a Flow just generated from a recording runs as generated:
      // repairing it would hide what the recording got wrong.
      const flowId = text(message.flowId);
      return flowId ? deps.call("run-runtime-session", { projectId, flowId }) : missing("flowId");
    }
    case AUTOMATION_PANEL_MESSAGES.runDetail: {
      const runId = text(message.runId);
      return runId ? runDetail(projectId, runId, deps) : missing("runId");
    }
    case AUTOMATION_PANEL_MESSAGES.exportDataset: {
      const runId = text(message.runId);
      const datasetId = text(message.datasetId);
      const format = text(message.format);
      if (!runId) return missing("runId");
      if (!datasetId) return missing("datasetId");
      if (!format) return missing("format");
      return deps.call("export-run-dataset", { projectId, runId, datasetId, format });
    }
    case AUTOMATION_PANEL_MESSAGES.generateFromRecording: {
      const recordingId = deps.lastStoppedRecordingId();
      if (!recordingId) return failure("invalid_request", "There is no finished recording to turn into an automation. Record one, then try again.");
      return deps.call("generate-recording-proposal", { projectId, recordingId, mode: "direct" });
    }
    case AUTOMATION_PANEL_MESSAGES.saveGeneratedAutomation: {
      const proposalId = text(message.proposalId);
      return proposalId ? deps.call("review-recording-flow-proposal", { projectId, proposalId, decision: "approved" }) : missing("proposalId");
    }
    default:
      return failure("invalid_request", "That request is not one FluxIQ knows.");
  }
}

async function listAutomations(projectId: string, deps: AutomationRelayDeps): Promise<PanelRelayResponse> {
  const flows = await deps.call("list-flow-summaries", { projectId });
  if (!flows.ok) return flows;
  const runs = await deps.call("list-flow-runs", { projectId, sort: "updated", direction: "desc", limit: AUTOMATION_RUN_LIST_LIMIT });
  if (!runs.ok) return runs;
  return { ok: true, payload: { flows: field(flows.payload, "flows") ?? [], runs: field(runs.payload, "runs") ?? [] } };
}

async function runDetail(projectId: string, runId: string, deps: AutomationRelayDeps): Promise<PanelRelayResponse> {
  const detail = await deps.call("get-flow-run-detail", { projectId, runId, compact: true });
  if (!detail.ok) return detail;
  const runDetailValue = field(detail.payload, "runDetail") ?? null;
  const flowId = text(field(runDetailValue, "flowId")) ?? text(field(field(runDetailValue, "summary"), "flowId"));
  if (!flowId) return { ok: true, payload: { runDetail: runDetailValue, adaptations: [] } };
  const adaptations = await deps.call("list-flow-adaptations", { projectId, flowId });
  if (!adaptations.ok) return adaptations;
  return { ok: true, payload: { runDetail: runDetailValue, adaptations: field(adaptations.payload, "adaptations") ?? field(adaptations.payload, "items") ?? [] } };
}

async function modelReadiness(deps: AutomationRelayDeps): Promise<PanelRelayResponse> {
  const snapshot = await deps.call("snapshot", {}, "secret-keys");
  if (!snapshot.ok) return snapshot;
  const listed = field(snapshot.payload, "keys");
  const keys = (Array.isArray(listed) ? listed : []).map((key) => {
    const kind = text(field(key, "kind"));
    const provider = text(field(key, "provider"));
    return { ...(kind ? { kind } : {}), ...(provider ? { provider } : {}), enabled: field(key, "enabled") === true };
  });
  return { ok: true, payload: { keys } };
}

function field(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)[key] : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function missing(name: string): PanelRelayResponse {
  return failure("invalid_request", `That request is missing its ${name}.`);
}

function failure(code: Extract<PanelRelayResponse, { ok: false }>["code"], error: string): PanelRelayResponse {
  return { ok: false, code, error };
}

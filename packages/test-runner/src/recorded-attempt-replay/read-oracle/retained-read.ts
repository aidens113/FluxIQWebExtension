import type { JsonObject, JsonValue } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, webOfflineReadDynamicContent, WEB_LLM_DETECT_STRUCTURE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationActionCommand, type WebAutomationActionResult, type WebPageSnapshot, type WebSnapshotPage, type WebSnapshotSandboxObservations } from "@fluxiq-web-extension/domain/node";
import type { ClientGatewayTraceRecordedPayload } from "fluxiq/client-gateway";
import { recordedSnapshotGateway } from "./snapshot-gateway.js";

const SESSION = "recorded-oracle-snapshot";
const READ_ACTION = "web.dom.extract_list";

/** What today's production reader made of one recorded read: the domain's own detection and node run over its snapshot. */
export type RetainedRecordedRead = {
  detection: { resultCode: string | null; handle: string | null; fieldKeys: string[]; itemCount: number | null };
  /** The detected column keys the recorded call named, and how many of them today's detection still names. */
  namedKeys: { named: number; detected: number };
  /** The domain's tool execution for the node run, exactly as the runtime answered it; `null` when detection refused first. */
  execution: JsonObject | null;
  /** Whether the read today's resolution dispatched read the same item selector as the recorded command; `null` when none was dispatched. */
  itemMatches: boolean | null;
  /** The domain's differential rule (D37) over the changed read and the recorded control; `null` when none was dispatched. */
  dynamicContent: boolean | null;
  commands: { actionType: string; status: string }[];
  observations: WebSnapshotSandboxObservations;
};

/**
 * One recorded read through today's production reader, with no provider: a fresh web evidence runtime whose only
 * client is the read's own recorded page (`./snapshot-gateway.ts`) detects the page's list as the model's detection
 * call does, then runs the recorded node call -- the model's own written input, its list handle renamed to the
 * handle this detection issued -- through the domain's resolution, dispatch and read shaping. A saved Flow's pass is
 * the saved step Core asked the domain to replay, run by the domain's own replay of it. Every safe detected
 * field is retained by that resolution (P1); nothing here selects, renames or fills a field.
 */
export async function runRetainedRecordedRead(input: {
  page: WebSnapshotPage;
  snapshot: WebPageSnapshot;
  scope: { projectId: string; flowId: string };
  call: { callId: string; value: JsonObject };
  control: { action: WebAutomationActionCommand; result: WebAutomationActionResult; observations: WebSnapshotSandboxObservations };
  recordedResult: ClientGatewayTraceRecordedPayload;
}): Promise<RetainedRecordedRead> {
  const { gateway, commands } = recordedSnapshotGateway({ page: input.page, snapshot: input.snapshot, sessionId: SESSION });
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const detected = await runtime.executeTool({ ...input.scope, callId: `${input.call.callId}.detect`, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} }) as unknown as JsonObject;
  const packet = record(detected.evidence);
  const handle = typeof packet?.extraction === "string" ? packet.extraction : null;
  const fieldKeys = Array.isArray(packet?.fields) ? packet.fields.flatMap((field) => typeof record(field)?.key === "string" ? [record(field)!.key as string] : []) : [];
  const named = namedKeys(input.call.value);
  const base = {
    detection: { resultCode: typeof detected.resultCode === "string" ? detected.resultCode : null, handle, fieldKeys, itemCount: typeof packet?.itemCount === "number" ? packet.itemCount : null },
    namedKeys: { named: named.length, detected: named.filter((key) => fieldKeys.includes(key)).length },
  };
  if (handle === null) return { ...base, execution: null, itemMatches: null, dynamicContent: null, commands: summary(commands), observations: observed(commands) };
  // A saved Flow's step holds what its handle stands for (`extractionBinding`), and the domain replays it as the Flow
  // runs it; only a model-written read names a handle this detection reissues.
  const recordedHandle = typeof input.call.value.replay === "string" ? undefined : handleOf(input.call.value);
  const value = recordedHandle === undefined ? input.call.value : renamedHandle(input.call.value, recordedHandle, handle) as JsonObject;
  const execution = await runtime.executeTool({ ...input.scope, callId: input.call.callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value }) as unknown as JsonObject;
  const read = commands.find((command) => command.action.actionType === READ_ACTION && command.evaluation.status === "evaluated");
  const itemMatches = read === undefined ? null : itemOf(read.action) !== undefined && itemOf(read.action) === itemOf(input.control.action);
  const dynamicContent = read === undefined || read.evaluation.status !== "evaluated" ? null : webOfflineReadDynamicContent({
    changed: { result: read.evaluation.result, observations: read.evaluation.observations },
    control: { result: input.control.result, observations: input.control.observations },
    changedAction: read.action, controlAction: input.control.action, recordedResult: input.recordedResult,
  });
  return { ...base, execution, itemMatches, dynamicContent, commands: summary(commands), observations: observed(commands) };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function extractListOf(value: JsonObject): Record<string, unknown> | undefined {
  return record(record(value.parameters)?.extractList);
}

function handleOf(value: JsonObject): string | undefined {
  const handle = extractListOf(value)?.handle;
  return typeof handle === "string" ? handle : undefined;
}

/** The detected column keys a call's `fields` or `columns` name, an `@attribute` suffix aside. */
function namedKeys(value: JsonObject): string[] {
  const list = extractListOf(value);
  const fields = list?.fields ?? list?.columns;
  const entries = Array.isArray(fields) ? fields : record(fields) ? Object.values(record(fields)!) : [];
  return [...new Set(entries.flatMap((entry) => typeof entry === "string" ? [entry.split("@")[0]!] : []))];
}

/** The call with every `handle` member naming the recorded list renamed to today's handle for the same list. */
function renamedHandle(value: JsonValue, from: string, to: string): JsonValue {
  if (Array.isArray(value)) return value.map((entry) => renamedHandle(entry, from, to));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, key === "handle" && entry === from ? to : renamedHandle(entry, from, to)]));
}

function itemOf(action: WebAutomationActionCommand): string | undefined {
  const item = record((action as unknown as Record<string, unknown>).extractList)?.item;
  return typeof item === "string" ? item : undefined;
}

function summary(commands: ReturnType<typeof recordedSnapshotGateway>["commands"]): { actionType: string; status: string }[] {
  return commands.map((command) => ({ actionType: command.action.actionType, status: command.evaluation.status === "evaluated" ? command.evaluation.result.status : command.evaluation.reason }));
}

function observed(commands: ReturnType<typeof recordedSnapshotGateway>["commands"]): WebSnapshotSandboxObservations {
  const total = { scriptsRan: 0, requestsLeaked: 0, navigationsHeld: 0, requestsRefused: 0, scrollsPastEnd: 0 };
  for (const command of commands) {
    if (command.evaluation.status !== "evaluated") continue;
    for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += command.evaluation.observations[key];
  }
  return total;
}

// One Flow's or one task's own humanness: reading a Flow's level
// (`get-flow-metadata-detail`), and setting or clearing a Flow's
// (`update-flow-settings`) or a task's (`update-task-settings`). A task's level
// is read from its `list-project-tasks` row, which the automation relay's
// `listTasks` already reads, so there is no task read here.
//
// Each message is one Core call, and each body is written key by key against
// its contract (`present`), never spread from the message: a settings patch
// carries the humanness and nothing else, so this message cannot rename a Flow
// or change any other of its settings.
//
// Core judges the level. The relay checks only that it is a number or `null`
// (clear), so it can travel as JSON; a level out of range, or not whole, is
// refused by Core in its own words, and that refusal comes back as Core gave it
// (`core-api.ts` keeps Core's sentence and its code).
//
// Each answers `{ humanness? }`: the own level Core now holds, absent when it
// holds none. A Flow's detail and settings carry a good deal more; only the
// level crosses to the panel.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import { present } from "../../shared/present";
import type { CoreFlowHumannessReadBody, CoreFlowHumannessSetBody, CoreTaskHumannessSetBody, PanelHumannessReply, PanelRelayResponse } from "../../shared/protocol";
import type { PanelRelayContext } from "./relay-context";
import { relayFailure } from "./relay-failure";

type HumannessMessage = { readonly type?: string; readonly [key: string]: unknown };

/** The messages this relay answers. */
export const HUMANNESS_MESSAGES: readonly string[] = [
  RUNTIME_MESSAGES.panelFlowHumannessRead,
  RUNTIME_MESSAGES.panelFlowHumannessSet,
  RUNTIME_MESSAGES.panelTaskHumannessSet
];

const NO_LEVEL = "Say what humanness to use, from 0 to 100, or clear it.";

/** Relays a Flow's read, or a Flow's or a task's set or clear. Undefined for any other message type. */
export async function relayHumanness(message: HumannessMessage, context: PanelRelayContext): Promise<PanelRelayResponse<PanelHumannessReply> | undefined> {
  if (!HUMANNESS_MESSAGES.includes(message.type ?? "")) return undefined;
  const isTask = message.type === RUNTIME_MESSAGES.panelTaskHumannessSet;
  const subjectId = text(isTask ? message.taskId : message.flowId);
  if (!subjectId) return relayFailure("invalid_request", isTask ? "Say which task to change." : "Say which Flow this is for.");
  const reading = message.type === RUNTIME_MESSAGES.panelFlowHumannessRead;
  const humanness = message.humanness;
  if (!reading && !isLevel(humanness)) return relayFailure("invalid_request", NO_LEVEL);
  const projectId = text(message.projectId) ?? text(await context.projectId());
  if (!projectId) return relayFailure("no_project");
  if (reading) {
    const read = await context.call("get-flow-metadata-detail", present<CoreFlowHumannessReadBody>({ projectId, flowId: subjectId }));
    return read.ok ? held(field(field(field(read.payload, "flow"), "metadata"), "humanness")) : read;
  }
  const level = humanness as number | null;
  if (isTask) {
    const set = await context.call("update-task-settings", present<CoreTaskHumannessSetBody>({ projectId, taskId: subjectId, humanness: level }));
    return set.ok ? held(field(set.payload, "humanness")) : set;
  }
  const set = await context.call("update-flow-settings", present<CoreFlowHumannessSetBody>({ projectId, flowId: subjectId, flow: { flowId: subjectId, metadata: { humanness: level } } }));
  return set.ok ? held(field(field(field(set.payload, "flow"), "metadata"), "humanness")) : set;
}

/** The level Core holds as the panel's reply: a number, or absent for anything else (`null` once cleared). */
function held(value: unknown): PanelRelayResponse<PanelHumannessReply> {
  return { ok: true, payload: present<PanelHumannessReply>({ humanness: typeof value === "number" && Number.isFinite(value) ? value : undefined }) };
}

/** A level that can travel to Core as JSON, or `null` to clear. Core judges its range. */
function isLevel(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)[key] : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

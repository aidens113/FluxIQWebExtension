import { list, record, text } from "./values";

/** Each Flow's name by its id, from the automations list (`listAutomations`' `payload.flows`). A flow without both is left out. */
export function readFlowNames(payload: unknown): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const item of list(record(payload)?.flows)) {
    const flow = record(item);
    const flowId = text(flow?.flowId);
    const name = text(flow?.name);
    if (flowId !== undefined && name !== undefined) names.set(flowId, name.trim());
  }
  return names;
}

import type { ScriptedModelCall } from "../attempt-lane/scripted-model/index.js";

/** Reconciles every received request, including requests no completed run can own. */
export function hostProofProviderCalls(calls: readonly ScriptedModelCall[], runIds: readonly string[]): {
  total: number; byRun: Record<string, number>; unattributed: number; unknown: number; distinctRuns: boolean;
} {
  const byRun = new Map(runIds.map((id) => [id, 0]));
  let unattributed = 0;
  let unknown = 0;
  for (const call of calls) {
    if (call.correlationId === undefined) unattributed++;
    else if (!byRun.has(call.correlationId)) unknown++;
    else byRun.set(call.correlationId, byRun.get(call.correlationId)! + 1);
  }
  return { total: calls.length, byRun: Object.fromEntries(byRun), unattributed, unknown, distinctRuns: byRun.size === runIds.length };
}

// How many model provider calls Core says a run made, from the run's own record.
//
// Core counts a run's calls in its model gate's `costAccounting`
// (`metadata.llmGate`). A run that never reached for a model carries either a
// zero accounting (a run whose result check settled, Core
// `result-verification/zero-provider-run.ts`) or the gate's own refusal: a
// failed deterministic run's recovery asks the gate, which declines with
// `invoked: false` and a code (`llm.gate.training_mode` when the run's settings
// allow no model) and counts nothing because nothing was called. Both say zero,
// in Core's words. A run with no gate record at all, or one whose gate was
// invoked without an accounting, has no count: that is unknown, never zero.

import type { ExistingRunDetail } from "../../index.js";

export type MatrixModelCalls = Readonly<{
  /** The calls Core counted; `null` when its record does not say. */
  calls: number | null;
  /** Where the count came from: Core's accounting, the gate's refusal, or nothing. */
  source: "cost-accounting" | "gate-declined" | "none";
  /** The gate's refusal code, when that is the source. */
  gateCode: string | null;
  interventions: number;
  /** Itemized provider calls Core listed or left out; any is a call. */
  itemizedCalls: number;
}>;

export function matrixModelCalls(detail: Pick<ExistingRunDetail, "providerCallCount" | "llmGate" | "interventions" | "providerCalls" | "providerCallsOmitted">): MatrixModelCalls {
  const interventions = detail.interventions?.length ?? 0;
  const itemizedCalls = (detail.providerCalls?.length ?? 0) + (detail.providerCallsOmitted ?? 0);
  if (detail.providerCallCount !== undefined) return { calls: Math.max(detail.providerCallCount, itemizedCalls), source: "cost-accounting", gateCode: null, interventions, itemizedCalls };
  const gate = detail.llmGate;
  if (gate && gate.invoked === false && itemizedCalls === 0) return { calls: 0, source: "gate-declined", gateCode: typeof gate.code === "string" ? gate.code : null, interventions, itemizedCalls };
  return { calls: itemizedCalls > 0 ? itemizedCalls : null, source: "none", gateCode: null, interventions, itemizedCalls };
}

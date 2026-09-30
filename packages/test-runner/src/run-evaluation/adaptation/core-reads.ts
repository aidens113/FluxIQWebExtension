// Reading, from Core, what `measureRunAdaptations` measures. Core deletes an
// isolated run's workspace when the run ends, so a lane calls this while the
// Flow and its adaptations are still there, and writes the result to the
// bundle's `snapshots/adaptation.json` (`RUN_ADAPTATION_SNAPSHOT`).

import type { RunAdaptationMeasurements } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { adaptationIdsToRead, measureRunAdaptations, type RunAdaptationFacts } from "./measure.js";

type JsonRecord = Record<string, unknown>;

/** The one Core call this needs; `ExistingFluxIQControl` satisfies it. */
export type AdaptationReadControl = { automationStudioCall(endpoint: string, payload: JsonRecord): Promise<unknown> };

/** Which run: the project, the Flow it ran, and Core's run id. */
export type AdaptationReadScope = { projectId: string; flowId: string; runId: string };

/**
 * Core's payloads for one finished run: its detail, the Flow document and the
 * graph of each Subflow it entered, and every adaptation it created, trialled,
 * or executed a stamp of. A read that fails, or a payload that is not the
 * shape Core documents, throws: a partial read is never measured as a whole one.
 */
export async function readRunAdaptationFacts(control: AdaptationReadControl, scope: AdaptationReadScope): Promise<RunAdaptationFacts> {
  const runDetail = member(await control.automationStudioCall("get-flow-run-detail", { projectId: scope.projectId, runId: scope.runId }), "runDetail");
  const summary = member(runDetail, "summary");
  if (summary.runId !== scope.runId || summary.projectId !== scope.projectId) throw new RunnerFailure("runtime.behavior", "Core's run detail did not describe the requested run", { details: { reasonCode: "adaptation.run_detail_mismatch" } });
  const graphFlowIds = [scope.flowId, ...new Set(list(runDetail.subflows).map((entry) => (isRecord(entry) ? entry.graphFlowId : undefined)).filter((id): id is string => typeof id === "string" && id.length > 0 && id !== scope.flowId))];
  const graphs: JsonRecord[] = [];
  for (const flowId of graphFlowIds) graphs.push(member(await control.automationStudioCall("get-flow", { projectId: scope.projectId, flowId }), "flow"));
  const adaptations = new Map<string, JsonRecord>();
  for (const adaptationId of adaptationIdsToRead(runDetail, graphs)) {
    adaptations.set(adaptationId, member(await control.automationStudioCall("get-flow-adaptation", { projectId: scope.projectId, flowId: scope.flowId, adaptationId }), "adaptation"));
  }
  return { runDetail, graphs, adaptations };
}

/** The run's four Week 2 measurements, read from Core now. Throws as `readRunAdaptationFacts` does. */
export async function readRunAdaptationMeasurements(control: AdaptationReadControl, scope: AdaptationReadScope): Promise<RunAdaptationMeasurements> {
  return measureRunAdaptations(await readRunAdaptationFacts(control, scope));
}

function member(payload: unknown, key: string): JsonRecord {
  const value = isRecord(payload) ? payload[key] : undefined;
  if (!isRecord(value)) throw new RunnerFailure("runtime.behavior", `Core's payload carried no ${key} record`, { details: { reasonCode: "adaptation.payload_malformed", member: key } });
  return value;
}

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

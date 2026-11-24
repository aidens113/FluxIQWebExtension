import type { AutomationStudioFlowDraftStep, AutomationStudioLlmEvidenceToolExecutionResult } from "fluxiq/automation";
import { automationStudioAnswerFirstResultFeed, automationStudioAnswerFirstRowSink, automationStudioAnswerFirstTaskProcessing, type AutomationStudioAnswerFirstRowsStored } from "fluxiq/automation/answer-first-data";
import type { JsonObject } from "fluxiq/core";

const RUN = "recorded-oracle";
const READ_ROWS_KEY = "read.extracted";
const RUN_NODE = "core.run_node";

/** One admitted read's node call and the domain's answer to it, in capture order. */
export type RecordedOracleRead = { callId: string; value: JsonObject; execution: JsonObject };

/**
 * The answer Core forms from the reads, with no provider: each answer stored by Core's own row sink as a live
 * attempt's call chain stores it, then told to Core's own result feed as a read the draft added, so the feed's ledger
 * joins the pages of one list and its data stage applies the task's processing declaration, bound to the retained
 * schema, at the given processing reference time. A saved Flow's pass (a replayed step) is told as the pass of its
 * saved read step. Which reads are the answer's pages is the caller's selection.
 */
export async function collectRecordedOracleAnswer(input: { instructionText: string; process: JsonObject; referenceTimeMs: number; reads: readonly RecordedOracleRead[] }) {
  const processing = automationStudioAnswerFirstTaskProcessing({ instructionText: input.instructionText, declared: { process: input.process }, kept: undefined, legacy: false });
  const sink = automationStudioAnswerFirstRowSink({
    runId: RUN, readRowsKey: READ_ROWS_KEY, instructionText: input.instructionText,
    onRecordBatch: async (batch) => ({ runId: RUN, datasetId: batch.datasetId, nodeIds: [batch.nodeId], schemaDigest: "sha256:recorded-oracle", recordCount: batch.rows.length, invalidCount: batch.invalidCount, truncated: batch.truncated, updatedAt: 0 }),
  });
  const feed = automationStudioAnswerFirstResultFeed({ instructionText: input.instructionText, readRowsKey: READ_ROWS_KEY, processing, processingReferenceTimeMs: input.referenceTimeMs, requiresDataOutput: true });
  const steps: AutomationStudioFlowDraftStep[] = [];
  const saved = new Map<string, AutomationStudioFlowDraftStep>();
  const stored: { callId: string; rows: number; invalidCount: number; schemaFields: string[]; failure: string | null }[] = [];
  for (const read of input.reads) {
    const call = { callId: read.callId, toolId: RUN_NODE, value: read.value };
    const answer = read.execution as unknown as AutomationStudioLlmEvidenceToolExecutionResult;
    const kept: AutomationStudioAnswerFirstRowsStored | undefined = await sink.fromCall(call, answer);
    stored.push({ callId: read.callId, rows: kept?.rows.length ?? 0, invalidCount: kept?.invalidCount ?? 0, schemaFields: kept?.schema?.fields.map((field) => field.id) ?? [], failure: kept === undefined ? "no_rows_in_answer" : kept.failure?.code ?? null });
    if (typeof read.value.replay === "string") {
      // A saved Flow's pass: the feed holds the read the call stored and records it as a page of the saved read step
      // when the run reports that step's pass, as a live forward run does. Passes of one saved step share that step.
      const input: JsonObject = { node: read.value.node ?? null, parameters: read.value.parameters ?? {}, consequences: read.value.consequences ?? [] };
      const key = JSON.stringify([input.node, input.parameters]);
      let step = saved.get(key);
      if (step === undefined) {
        step = { id: `saved.${saved.size + 1}`, position: steps.length + 1, disposition: "kept", proposes: true, effect: "observe", input, toolId: RUN_NODE, actionId: typeof input.node === "string" ? input.node : RUN_NODE } as AutomationStudioFlowDraftStep;
        saved.set(key, step);
        steps.push(step);
        feed.draft(steps);
      }
      feed.called(call, answer, kept);
      feed.passed(step, steps, answer);
      continue;
    }
    const draft = record(read.execution.draft);
    const step = { id: read.callId, callId: read.callId, position: steps.length + 1, disposition: "kept", proposes: true, effect: "observe", input: read.value, toolId: RUN_NODE, ...(typeof draft?.actionId === "string" ? { actionId: draft.actionId } : {}) } as AutomationStudioFlowDraftStep;
    steps.push(step);
    feed.expect({ kind: "add", position: step.position, intermediate: false });
    feed.called(call, answer, kept);
    feed.draft(steps);
  }
  const rows = feed.rows();
  return { stored, readiness: feed.readiness(), answer: { columns: rows.columns, rows: rows.rows, schemaFields: rows.schema?.fields.map((field) => field.id) ?? [] }, processing: feed.evidence().processing ?? null, bound: feed.boundProcessing() ?? null, collected: feed.collected() };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

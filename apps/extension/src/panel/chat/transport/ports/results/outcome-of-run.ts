import type { ChatResult, ChatTaskOutcome, ChatTaskResultRows } from "@fluxiq/ui-components";
import { AUTOMATION_PANEL_MESSAGES } from "../../../../../shared/protocol";
import type { PanelStore } from "../../../../state";
import { readRunReplies } from "../../../../automations";
import { asRecord, refusalOf } from "../../reply";
import { datasetRows, type DatasetRows } from "./dataset-rows";
import type { FinishedRun } from "./finished-run";
import { readExport } from "./read-export";

const NO_LOOP = { steered: 0, refused: 0, changeApproach: 0, askPerson: 0 };

/**
 * The outcome of a finished run, from what the background can say of it: the run's
 * status, times and datasets, and its first dataset's rows. `{ ok: true, value:
 * undefined }` when there is nothing to show (not a succeeded run, or no dataset);
 * a failed result when the background could not be read. Nothing is invented: a
 * row is a row the dataset holds, the label is `unverified` unless the run's own
 * summary says a result check confirmed it, and the spend is zeros because this
 * path has no attempt record to read it from (the outcome says so with `spendUnknown`).
 */
export async function outcomeOfRun(request: PanelStore["request"], run: FinishedRun, now: () => number): Promise<ChatResult<ChatTaskOutcome | undefined>> {
  const reply = await request({ type: AUTOMATION_PANEL_MESSAGES.runDetail, runId: run.runId });
  const refused = refusalOf(reply);
  if (refused !== undefined) {
    return refused;
  }
  const detail = readRunReplies.detail(reply.ok ? reply.value : undefined);
  const summary = detail?.run;
  if (detail === undefined || summary === undefined) {
    return { ok: false, sentence: "FluxIQ's account of the run could not be read." };
  }
  if (summary.status !== "succeeded") {
    return { ok: true, value: undefined };
  }
  const dataset = detail.datasets.find((candidate) => candidate.recordCount !== 0) ?? detail.datasets[0];
  if (dataset === undefined) {
    return { ok: true, value: undefined };
  }

  const exported = await readExport(request, { runId: run.runId, datasetId: dataset.datasetId, format: "json" });
  if (!exported.ok) {
    return exported;
  }
  let rows: ChatTaskResultRows;
  if (exported.value.tooLarge) {
    rows = { runId: run.runId, datasetId: dataset.datasetId, totalRows: dataset.recordCount ?? 0, truncated: true, columns: [], previewRows: [] };
  } else {
    let read: DatasetRows;
    try {
      read = datasetRows(exported.value.body);
    } catch {
      return { ok: false, sentence: "FluxIQ's rows could not be read." };
    }
    rows = { runId: run.runId, datasetId: dataset.datasetId, totalRows: Math.max(read.rowCount, dataset.recordCount ?? 0), truncated: read.truncated, columns: read.columns, previewRows: read.previewRows };
  }

  const startedAtMs = summary.startedAt ?? now();
  const endedAtMs = summary.finishedAt ?? startedAtMs;
  const rawSummary = asRecord(asRecord(asRecord(reply.ok ? asRecord(reply.value)?.payload : undefined)?.runDetail)?.summary);
  const checked = asRecord(rawSummary?.resultCheck)?.status === "confirmed";
  const attemptId = `attempt-${run.runId}`;
  return {
    ok: true,
    value: {
      spendUnknown: true,
      attempt: {
        taskId: `task-${run.runId}`,
        attemptId,
        ordinal: 1,
        projectId: run.projectId,
        ...(summary.flowId === "" ? {} : { flowId: summary.flowId }),
        runId: run.runId,
        path: "run_flow",
        // Never `achieved` for a run nothing confirmed: the contract refuses it. A confirmed run is achieved.
        status: checked ? "achieved" : "finished_unchecked",
        spend: { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0, ms: Math.max(0, endedAtMs - startedAtMs) },
        budget: { usd: 0 },
        liveSteps: 0,
        loopsCaught: { exact_repeat: { ...NO_LOOP }, near_repeat: { ...NO_LOOP }, cycle: { ...NO_LOOP }, no_progress: { ...NO_LOOP }, same_fix: { ...NO_LOOP }, same_act: { ...NO_LOOP } },
        startedAtMs,
        endedAtMs
      },
      result: { attemptId, kind: "rows", label: checked ? "confirmed" : "unverified", timesChecked: checked ? 1 : 0, source: "flow", rows, acts: [] }
    }
  };
}

import path from "node:path";
import type { ChartOutput } from "../chart/index.js";
import { completionOutcomeWords } from "./completion-outcome.js";
import { listFolder } from "./list-folder.js";
import { readJsonFile } from "./read-json-file.js";
import { redactChartText } from "../redact-chart-text.js";

type CompletionCheck = {
  toolId?: string;
  value?: { code?: string; instruction?: string; resultHolds?: { totalRows?: number; columns?: string[]; rowsInOrder?: Record<string, unknown>[] } };
};

/**
 * The newest completion the model offered that the run's step files show the check answering: the `core.completion_check`
 * feedback in the newest `answer-*` step's result. Its rows are the ones the check read (`resultHolds`), labelled "offered,
 * not accepted" with the check's outcome in plain words. `undefined` when the model never offered one.
 */
export async function readOfferedCompletion(stepsDirectory: string): Promise<ChartOutput | undefined> {
  const folders = (await listFolder(stepsDirectory)).filter((name) => /^\d+-answer-/u.test(name)).sort().reverse();
  for (const folder of folders) {
    const result = await readJsonFile<{ feedback?: CompletionCheck[] }>(path.join(stepsDirectory, folder, "result.json"));
    const check = result?.feedback?.find((entry) => entry.toolId === "core.completion_check")?.value;
    if (check?.code === undefined) continue;
    const held = check.resultHolds;
    const columns = held?.columns ?? [];
    const rows = (held?.rowsInOrder ?? []).map((row) => columns.map((column) => redactChartText(String(row[column] ?? ""))));
    return { kind: "rows", source: "offered, not accepted", headline: "", columns, rows, total: held?.totalRows ?? rows.length, check: completionOutcomeWords(check.code, check.instruction) };
  }
  return undefined;
}

// What "Report a problem" does with the background's answer, without a DOM:
// the report as text to copy, the file name to save it under, or the sentence
// to show when there is none. The report itself is built and redacted by the
// background (`background/diagnostics/`); the panel only carries it to the person.

import type { ProblemReport } from "../../../shared/protocol";
import type { PanelResult } from "../../state";

export type ProblemReportOutcome =
  | { readonly ok: true; readonly text: string; readonly fileName: string }
  | { readonly ok: false; readonly sentence: string; readonly detail?: string | undefined };

/** What the section says after a report is copied or saved. */
export const PROBLEM_REPORT_COPIED = "Problem report copied. It holds versions, ids and recent failures, never page data or your pairing.";
export const PROBLEM_REPORT_SAVE_ONLY = "Couldn't copy the report here. Use Save report to keep it as a file.";

export function problemReportOutcome(result: PanelResult<{ report?: unknown }>): ProblemReportOutcome {
  if (!result.ok) {
    if (result.unsupported) return { ok: false, sentence: "This version of the extension can't make a problem report yet." };
    return { ok: false, sentence: result.sentence, detail: result.detail };
  }
  const report = result.value?.report as Partial<ProblemReport> | undefined;
  if (!report || report.schema !== "fluxiq.problem-report/1") return { ok: false, sentence: "The extension answered without a problem report." };
  const stamp = typeof report.createdAt === "string" ? report.createdAt.replace(/[^0-9T]/g, "").slice(0, 15) : "report";
  return { ok: true, text: JSON.stringify(report, null, 2), fileName: `fluxiq-problem-report-${stamp}.json` };
}

import type { AttemptOverhead } from "./attempt-overhead.js";
import { overheadWords } from "./overhead-words.js";

/** One attempt's overhead as a line for `attempt-report.txt`. */
export function attemptOverheadLine(overhead: AttemptOverhead): string {
  const { decisions } = overhead;
  const flow = overhead.flowBrowserCalls === null ? "no replay of the saved Flow in this run" : `the saved Flow runs ${overhead.flowBrowserCalls}`;
  const ratio = overhead.liveBrowserCalls === 0 ? "none (no live browser calls)" : overhead.overhead === null ? "not worked out (nothing to compare with)" : overheadWords(overhead);
  return `attempt ${overhead.attempt} overhead: ${overhead.liveBrowserCalls} live browser calls, ${flow}, overhead ${ratio}; ${overhead.repeatedCalls} repeated calls; ${overhead.wholeFlowRuns} whole-Flow runs from step 1; decisions: ${decisions.describe} describe, ${decisions.providerFormatError} provider-format error, ${decisions.refused} refused, ${decisions.look} look, ${decisions.step} step`;
}

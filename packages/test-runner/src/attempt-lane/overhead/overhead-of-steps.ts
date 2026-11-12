import type { AttemptOverhead } from "./attempt-overhead.js";
import { countDecisions } from "./count-decisions.js";
import { isBrowserCall } from "./is-browser-call.js";
import { repeatedCallCount } from "./repeated-calls.js";
import { splitAttempts } from "./split-attempts.js";
import type { StepRecord } from "./step-record.js";

const isControl = (record: StepRecord): boolean => (record.toolId ?? "").startsWith("builtin.control.");

/** The browser nodes of the first block of replayed Flow steps in the run, control nodes left out; `null` when no Flow replayed. */
function firstReplayCalls(attempts: readonly StepRecord[][]): number | null {
  for (const attempt of attempts) {
    const start = attempt.findIndex((record) => record.kind === "flow");
    if (start === -1) continue;
    let calls = 0;
    for (const record of attempt.slice(start)) {
      if (record.kind !== "flow") break;
      if (!isControl(record)) calls += 1;
    }
    return calls;
  }
  return null;
}

/** Each attempt's overhead, in attempt order, from a run's step records. */
export function overheadOfSteps(records: readonly StepRecord[]): AttemptOverhead[] {
  const attempts = splitAttempts([...records].sort((left, right) => left.step - right.step));
  const flowBrowserCalls = firstReplayCalls(attempts);
  return attempts.map((steps, index) => {
    const liveBrowserCalls = steps.filter(isBrowserCall).length;
    return {
      attempt: index + 1,
      liveBrowserCalls,
      flowBrowserCalls,
      overhead: liveBrowserCalls > 0 && flowBrowserCalls !== null && flowBrowserCalls > 0 ? liveBrowserCalls / flowBrowserCalls : null,
      repeatedCalls: repeatedCallCount(steps),
      wholeFlowRuns: steps.filter((record) => record.kind === "decide" && record.summary === "tool_call core.run_flow" && record.runFrom === 1).length,
      decisions: countDecisions(steps),
    };
  });
}

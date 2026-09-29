// Summary copy (plan 3.9): a run's facts as the short plain lines a person
// reads under an automation -- "Completed in 14.2s", "AI activated once",
// "Learned 1 new page variation", "Future runs updated". Never an id, a
// selector or a trace (plan 3.1, "Do Not Expose"); a fact that is unknown
// gets no line rather than a guess.

import type { RunFacts } from "./types";

/** The lines that describe a run, in reading order. */
export function runSummaryLines(facts: RunFacts): string[] {
  const lines: string[] = [];
  const took = facts.durationMs === undefined ? undefined : duration(facts.durationMs);
  if (facts.outcome === "running") lines.push("Running...");
  else if (facts.outcome === "completed") lines.push(took === undefined ? "Completed" : `Completed in ${took}`);
  else if (facts.outcome === "failed") lines.push(took === undefined ? "Failed" : `Failed after ${took}`);
  else if (facts.outcome === "stopped") lines.push("Stopped");

  if (facts.aiActivations !== undefined) lines.push(activations(facts.aiActivations));
  if (facts.learned !== undefined && facts.learned > 0) {
    lines.push(`Learned ${facts.learned} new page variation${facts.learned === 1 ? "" : "s"}`);
    if (facts.futureRunsUpdated === true) lines.push("Future runs updated");
    else if (facts.validated === undefined) lines.push("Checking the change...");
    else if (facts.validated === false) lines.push("The change didn't hold up, so future runs stay the same");
  } else if (facts.futureRunsUpdated === true) {
    lines.push("Future runs updated");
  }
  return lines;
}

function activations(count: number): string {
  if (count === 0) return "No AI needed";
  if (count === 1) return "AI activated once";
  return `AI activated ${count} times`;
}

/** 14.2s under a minute, 2m 5s under an hour, 1h 3m after. */
function duration(ms: number): string {
  const tenths = Math.round(ms / 100);
  if (tenths < 600) return `${(tenths / 10).toFixed(1)}s`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

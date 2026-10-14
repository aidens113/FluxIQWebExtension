// Summary copy (plan 3.9): a run's facts as the short plain lines a person
// reads under an automation -- "Completed in 14.2s", "AI activated once",
// whether the run kept a change. Never an id, selector, guessed change kind or
// exact kept count: current adaptation statuses do not prove run attribution.

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
  if (facts.outcome !== "running") {
    if (facts.futureRunsUpdated === true) lines.push("This run kept a change for future runs");
    else if (facts.futureRunsUpdated === false) lines.push("This run did not keep a change for future runs");
    else if (facts.outcome !== undefined || facts.changesTried !== undefined) lines.push("Whether this run kept a change is not available");
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

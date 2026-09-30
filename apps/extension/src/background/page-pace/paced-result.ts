// Puts what the page-load pace did into the command's result: one clause on
// its validation's `actual`, beside the other waits a read already names (the
// wait for the list, a refused page waited out and reloaded). Counts and
// seconds only -- no address and nothing of the page. A command the pace
// neither held nor was told a refusal in is returned unchanged.

import type { BrowserActionResult } from "../../shared/protocol";
import type { PaceTally } from "./pace-tally";

export function withPaceNote(result: BrowserActionResult, tally: PaceTally): BrowserActionResult {
  const note = paceNote(tally);
  if (note === undefined || result.validation === undefined || result.validation.status === "none") return result;
  return { ...result, validation: { ...result.validation, actual: `${result.validation.actual}; ${note}` } };
}

function paceNote(tally: PaceTally): string | undefined {
  if (tally.waits === 0 && tally.refusals === 0) return undefined;
  const parts: string[] = [];
  if (tally.waits > 0) {
    parts.push(`FluxIQ spaced its page loads on this site, waiting before ${tally.waits} of ${plural(tally.loads, "load")} (${seconds(tally.waitedMs)} in all)`);
  }
  if (tally.refusals > 0 && tally.spacingMs !== undefined) {
    parts.push(`the site refused ${plural(tally.refusals, "load")}, so FluxIQ now keeps ${seconds(tally.spacingMs)} between its loads there`);
  }
  return parts.join("; ");
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

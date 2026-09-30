// The quiet line under a step message that says how its action went, in a
// person's words:
//
//   under way   "Working on it", only on the newest message of work that is
//               still running; an action that never said it ended says
//               nothing once the work moved on or settled
//   done        "Done", or "Passed" for a check
//   failed      "Didn't work", or "Didn't pass" for a check
//
// Core's sentence about the action follows, when it has one in words
// ("Didn't work. The button was covered."). No DOM.

import type { StepMessage } from "./messages";

/** The outcome line; `state` drives its mark. */
export type OutcomeWords = { state: "working" | "succeeded" | "failed"; label: string };

/** The outcome line for `message`; `working` is true while its unit of work runs. Null for none. */
export function outcomeWords(message: StepMessage, working: boolean): OutcomeWords | null {
  const outcome = message.outcome;
  if (outcome === null) return null;
  if (outcome.status === "started") return working && message.latest ? { state: "working", label: "Working on it" } : null;
  const check = message.kind === "check";
  const head = outcome.status === "failed" ? (check ? "Didn't pass" : "Didn't work") : check ? "Passed" : "Done";
  const said = outcome.text?.trim();
  return { state: outcome.status, label: said ? `${head}. ${said}` : head };
}

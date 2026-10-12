// Whether Core refused to start a case's run because the Flow requires a
// capability this Core does not offer (contract C10, the requirement gate).
//
// A Flow with handlers declares `flow.handlers@1`, and a Core whose executor
// does not dispatch them refuses the run before any step, with a plain reason
// ("This automation needs handlers for interruptions, which this version of
// FluxIQ doesn't offer yet"). That is the gate working, and the row is not
// proven on this Core: the capability, not the Flow or the site, is missing.
// Only a refusal of the run request itself counts, for a Flow that declared a
// requirement, and only in the gate's own words.

const GATE_REFUSAL = /\bdoesn't offer yet\b|\bdoes not offer\b/u;

/** The requirement the refusal names, when `error` is the gate refusing a Flow that declared requirements; `undefined` otherwise. */
export function requirementRefusal(error: unknown, requires: readonly string[], ranRun: boolean): string | undefined {
  if (ranRun || requires.length === 0) return undefined;
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes("run-runtime-session") || !GATE_REFUSAL.test(message)) return undefined;
  return message.slice(message.indexOf("run-runtime-session")).slice(0, 300);
}

import type { SubflowRefusal, SubflowRefusalCode } from "@fluxiq/ui-components";
import { readClasses } from "./classes";
import { record, text } from "./values";

const CODES: readonly string[] = [
  "part.not_found", "part.wrong_site", "part.not_at_start", "part.input_missing", "part.input_unknown", "part.act_not_allowed", "part.confirm_repeat",
  "part.calls_not_available", "part.repeat_refused", "parts.unavailable", "parts.run_id_refused"
];

/**
 * Core's `{ refused: true, code, message }`, which is an ordinary successful answer and so a value here. A code this
 * panel does not know is read as `parts.unavailable`, so a refusal is never mistaken for data and never invented.
 */
export function readRefusal(value: unknown): SubflowRefusal | undefined {
  const answer = record(value);
  if (answer?.refused !== true) return undefined;
  const code = typeof answer.code === "string" && CODES.includes(answer.code) ? (answer.code as SubflowRefusalCode) : "parts.unavailable";
  const classes = readClasses(answer.classes);
  return { refused: true, code, message: text(answer.message) ?? "", ...(classes.length > 0 ? { classes } : {}) };
}

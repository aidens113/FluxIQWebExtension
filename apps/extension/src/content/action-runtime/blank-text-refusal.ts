// A text expectation that names nothing: one rule for the assert evaluator
// (`assertion-evaluation.ts`) and the text waits (`wait-conditions.ts`).
//
// Missing, empty and whitespace-only text is no claim any page could satisfy or
// contradict, so it is a malformed command rather than a page that was slow:
// refused on the first attempt, never polled and never retried. The two used
// to disagree. A blank assert came back at once as a failed claim, which the
// result builder records as STATE_MISMATCH (not retryable); a blank wait threw
// a bare Error, classified as ACTION_FAILED (retryable), so the same blank wait
// ran three more times -- 2.3-2.6 s against a 2 s bound -- before it failed.
// Both now say the same words from here, and each reaches the same closed,
// non-retryable record: the assert through its failed validation, the wait by
// carrying the record on what it throws.
//
// Any string with a non-space character is an expectation, the literal word
// `null` included; a value that is not a string is not one.

/** What a blank text expectation says it wanted and what the command named instead. */
export function blankTextRefusal(text: unknown, by: "assertion" | "wait"): { expected: string; actual: string } | undefined {
  if (typeof text === "string" && text.trim().length > 0) return undefined;
  return { expected: "a nonblank text expectation", actual: `the ${by} named no meaningful text` };
}

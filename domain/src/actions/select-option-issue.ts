// Why a select command names no option the verb could choose (t1081, bigbox
// `run-mwytbimp-e0c33977` steps 0014 and 0026).
//
// The select verb takes its option from `option` (`{by, value|label|index}`) or
// from the flat `value`. A model that wrote `label` beside the target, or
// `option: {label}` with no `by`, named none: the verb answered "the command
// named none", which became a bare `output_not_observed` that was retried four
// times and said nothing of why. A command that names no option can never
// succeed, so it is refused before dispatch as `INVALID_PARAMETER`, and its
// `actual` leads with one of these closed phrases so the refusal that tells the
// model reads the reason off the phrase, never off a value.

import type { JsonObject } from "fluxiq/core";
import type { WebAutomationOptionSelector } from "./types";

/** The two ways a select command names no option, as closed phrases that lead a refusal's `actual`. */
export const webAutomationSelectOptionIssue = {
  unnamed: "no option: the command named none",
  unreadable: "option not readable: it was sent without a `by` that names value, label or index",

  /** The issue a select command's parameters carry, or nothing when they name an option. `option` is the reader's result. */
  of(parameters: JsonObject, option: WebAutomationOptionSelector | undefined): "unnamed" | "unreadable" | undefined {
    if (option !== undefined || typeof parameters.value === "string") return undefined;
    return parameters.option === undefined || parameters.option === null ? "unnamed" : "unreadable";
  },

  /** The issue a refusal's `actual` leads with, or nothing. */
  readFrom(actual: unknown): "unnamed" | "unreadable" | undefined {
    if (typeof actual !== "string") return undefined;
    return actual.startsWith(this.unnamed) ? "unnamed" : actual.startsWith(this.unreadable) ? "unreadable" : undefined;
  }
} as const;

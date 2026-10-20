import { isAutomationNodeParameterStateBinding as isBinding } from "fluxiq/automation-studio/nodes";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationScrollRequestIssues } from "../../actions/scroll-request-issues";

/** Each code names the key it refuses, since a contract's refusal carries codes alone. */
export type WebAutomationScrollParameterIssueCode =
  | "web.scroll.until_stable_missing_max_scrolls"
  | "web.scroll.until_stable_invalid_max_scrolls";

/**
 * The scroll node's parameter contract, in the shape of Core's
 * `AutomationStudioNodeParameterContract`: Flow Bootstrap asks it about each
 * literal parameter value of a generated plan and refuses the plan with the
 * codes it returns (social r4, `run-mvfq957o-40103539`).
 *
 * The scroll request's schema (`actions/schemas.ts`) already refuses at submit
 * a missing or unknown mode and a key the request does not have, each in
 * Core's own sentence naming the field. What it cannot say is conditional:
 * `untilStable` requires `maxScrolls`, a positive whole number, and Core's
 * schema reader reads no conditional keyword. So this answers that alone, and
 * leaves everything else to the schema -- Core holds a value to the schema only
 * once its contract accepts it, so a code here for anything the schema says
 * would replace a sentence naming the field with a bare code.
 *
 * A bound `maxScrolls` is resolved before the dispatch reads it, so it fits.
 */
export function webAutomationScrollParameterContract(input: { definitionId: string; parameterId: string; value: JsonValue }): readonly string[] {
  if (input.parameterId !== "scroll" || typeof input.value !== "object" || input.value === null || Array.isArray(input.value)) return [];
  const request = input.value as JsonObject;
  if (request.mode !== "untilStable" || isBinding(request.maxScrolls)) return [];
  const issue = webAutomationScrollRequestIssues(request).find((entry) => entry.key === "maxScrolls");
  if (!issue) return [];
  const code: WebAutomationScrollParameterIssueCode = issue.problem === "missing" ? "web.scroll.until_stable_missing_max_scrolls" : "web.scroll.until_stable_invalid_max_scrolls";
  return [code];
}

import type { JsonValue } from "fluxiq/core";
import { webAutomationExtractReadIssues } from "./read-issues";

/**
 * The single-value read node's parameter contract, in the shape of Core's
 * `AutomationStudioNodeParameterContract`: Flow Bootstrap asks it about each
 * literal parameter value of a generated plan, and refuses the plan with the
 * codes it returns, the parameter's grammar and example beside them (t675).
 *
 * Only `extract` has a shape Core cannot check from its declared type (an
 * object); a bare string is already refused by Core's own type check. The
 * legacy `options.mode` is not a parameter of this node and is not checked.
 */
export function webAutomationExtractParameterContract(input: { definitionId: string; parameterId: string; value: JsonValue }): readonly string[] {
  return input.parameterId === "extract" ? webAutomationExtractReadIssues(input.value) : [];
}

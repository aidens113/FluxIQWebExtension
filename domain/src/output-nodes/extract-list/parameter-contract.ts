import type { JsonValue } from "fluxiq/core";
import { webAutomationExtractListIssues } from "./issues";

/**
 * The list extraction node's parameter contract, in the shape of Core's
 * `AutomationStudioNodeParameterContract`: Flow Bootstrap asks it about each
 * literal parameter value of a generated plan, and refuses the plan with the
 * codes it returns.
 *
 * Only `extractList` has a shape Core cannot check from its declared type.
 * `recordOutput` is parsed by Core itself, and every other parameter is a
 * scalar. A nested state binding inside `extractList` is refused, as the
 * dispatch would refuse it unresolved.
 *
 * The input is spelled out rather than imported because the build of Core this
 * package compiles against does not export the type yet; the function is
 * assignable to it as written.
 */
export function webAutomationExtractListParameterContract(input: { definitionId: string; parameterId: string; value: JsonValue }): readonly string[] {
  return input.parameterId === "extractList" ? webAutomationExtractListIssues(input.value) : [];
}

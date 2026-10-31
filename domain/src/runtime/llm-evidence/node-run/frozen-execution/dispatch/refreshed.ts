import type { JsonObject } from "fluxiq/core";
import { webReacquireElement } from "../../../../target-reacquire";
import { isJsonRecord } from "../../../untrusted-json";
import { webNodeFrozenJson } from "../json";
import { webNodeFrozenKey } from "../key";
import { webNodeFrozenSubjectKind } from "../subject";

/** The existing same-subject locator producer may change only the element's address. */
export function webNodeFrozenRefreshedParameters(actionType: string, logical: JsonObject, base: JsonObject, parameters: JsonObject): JsonObject | undefined {
  if (webNodeFrozenSubjectKind(actionType, logical) !== "element" || webNodeFrozenSubjectKind(actionType, parameters) !== "element" || webNodeFrozenKey(withoutAddress(parameters)) !== webNodeFrozenKey(withoutAddress(base)) || typeof parameters.selector !== "string" || !isJsonRecord(parameters.element) || !isJsonRecord(logical.element)
    || webReacquireElement({ stale: logical.element, candidates: [parameters.element] }).outcome !== "found") return undefined;
  return webNodeFrozenJson({ ...logical, selector: parameters.selector, element: parameters.element });
}

function withoutAddress(parameters: JsonObject): JsonObject {
  return Object.fromEntries(Object.entries(parameters).filter(([key]) => key !== "selector" && key !== "element"));
}

import type { JsonObject, JsonValue } from "fluxiq/core";
import { isJsonRecord } from "../../../untrusted-json";
import type { WebNodeFrozenCall } from "../types";

/** State/row-bound operations need their own existing source proof, never a new row binding. */
export function webNodeFrozenSubjectKind(actionType: string, parameters: JsonObject): WebNodeFrozenCall["subjectKind"] | undefined {
  if (stateBound(parameters) || isJsonRecord(parameters.target)) return undefined;
  const element = isJsonRecord(parameters.element) ? parameters.element : undefined;
  const context = isJsonRecord(element?.context) ? element.context : undefined;
  const record = isJsonRecord(context?.record) ? context.record : undefined;
  if (record?.values !== undefined) return undefined;
  if (element !== undefined && typeof parameters.selector === "string") return "element";
  if (actionType === "web.dom.capture_snapshot") return "page";
  if (actionType === "web.dom.extract_list" && isJsonRecord(parameters.extractList) && typeof parameters.extractList.item === "string" && isJsonRecord(parameters.extractList.fields) && !Object.hasOwn(parameters.extractList, "handle")) return "query";
  return undefined;
}

function stateBound(value: JsonValue): boolean {
  if (value === null || typeof value !== "object") return false;
  return Object.hasOwn(value, "$state") || Object.values(value).some(stateBound);
}

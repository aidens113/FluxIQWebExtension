import type { JsonObject, JsonValue } from "fluxiq/core";
import { isJsonRecord } from "../../../untrusted-json";
import type { WebNodeFrozenCall } from "../types";

/** Stable semantic identity excludes the locator/position a trusted refresh replaces. */
export function webNodeFrozenSubjectKey(kind: WebNodeFrozenCall["subjectKind"], parameters: JsonObject): JsonValue {
  if (kind === "page") return {};
  if (kind === "query") return parameters.extractList!;
  const identity = structuredClone(parameters.element) as JsonObject;
  delete identity.selector;
  delete identity.xpath;
  if (isJsonRecord(identity.context)) {
    delete identity.context.listPosition;
    delete identity.context.tablePosition;
    if (isJsonRecord(identity.context.record) && typeof identity.context.record.key === "string" && typeof identity.context.record.keyAttribute === "string") delete identity.context.record.text;
    if (Object.keys(identity.context).length === 0) delete identity.context;
  }
  return identity;
}

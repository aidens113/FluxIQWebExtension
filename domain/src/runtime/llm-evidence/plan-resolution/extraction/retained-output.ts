import type { AutomationStudioRecordSchema } from "fluxiq/automation";
import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebAutomationExtractListRequest } from "../../../../actions/extraction";
import { webAutomationDerivedRecordOutput, webAutomationStoredColumns } from "../../../../output-nodes";
import { present } from "../../present";
import { webLlmUniqueStoredLabels } from "../../structure";

/** The host's full schema and the author's display view, with resolved aliases rebased once. */
export function webPlanRetainedRecordOutput(input: {
  authored: JsonValue | undefined;
  request: JsonObject;
  schema: AutomationStudioRecordSchema;
  requested: readonly string[] | undefined;
  names: readonly { field: string; written: string }[];
}): JsonValue {
  const authored = isObject(input.authored) ? input.authored : undefined;
  if (input.authored !== undefined && input.authored !== null && authored === undefined) return structuredClone(input.authored);
  if (authored && !webAutomationStoredColumns(authored, input.request as unknown as WebAutomationExtractListRequest).ok) return structuredClone(authored);
  const names = new Map(input.names.map((entry) => [entry.field, entry.written]));
  const name = (id: string): string => names.get(id) ?? id;
  const originalFields = isObject(authored?.schema) && Array.isArray(authored.schema.fields) ? authored.schema.fields : [];
  const exclusions = new Set(originalFields.flatMap((field) => isObject(field) && field.handling === "exclude" && typeof field.id === "string" ? [field.id] : []));
  const columns = originalFields.flatMap((field) => isObject(field) && field.handling !== "exclude" && typeof field.id === "string" ? [field.id] : []);
  // A field renamed for the record output keeps its stored label; no label may answer to another field's new id (t997).
  const labels = webLlmUniqueStoredLabels(input.schema.fields.map((field) => ({ id: name(field.id), label: field.label })));
  const schema = present<AutomationStudioRecordSchema>({
    schemaVersion: input.schema.schemaVersion,
    fields: input.schema.fields.map((field, index) => present<AutomationStudioRecordSchema["fields"][number]>({
      id: name(field.id), label: labels[index]!, valueType: field.valueType, semanticType: field.semanticType, mark: field.mark,
      required: field.required, handling: exclusions.has(name(field.id)) ? "exclude" : field.handling
    })),
    primaryKey: input.schema.primaryKey?.map(name)
  });
  // An excluded identity is unavailable, not permission to read the value back.
  if (schema.primaryKey?.some((id) => exclusions.has(id))) delete schema.primaryKey;
  const output = structuredClone(authored ?? webAutomationDerivedRecordOutput(input.request as unknown as WebAutomationExtractListRequest) as unknown as JsonObject);
  const process = isObject(output.process) ? output.process : undefined;
  const shown = columns.length ? columns : input.requested?.map(name);
  output.schema = schema as unknown as JsonObject;
  if (output.purpose === "intermediate") return output;
  if (shown !== undefined && !(process && Object.hasOwn(process, "columns"))) {
    const displayed = structuredClone(process ?? {});
    displayed.columns = [...shown];
    output.process = displayed;
  }
  return output;
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

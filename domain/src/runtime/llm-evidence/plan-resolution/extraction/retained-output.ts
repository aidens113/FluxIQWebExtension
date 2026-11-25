import type { AutomationStudioRecordSchema } from "fluxiq/automation";
import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebAutomationExtractListRequest } from "../../../../actions/extraction";
import { webAutomationDerivedRecordOutput, webAutomationStoredColumns } from "../../../../output-nodes";
import { present } from "../../present";
import { webLlmUniqueStoredLabels } from "../../structure";
import { isWithheldText, screenedPageText } from "../../withheld";

/** The host's full schema and the author's display view, with resolved aliases rebased once. */
export function webPlanRetainedRecordOutput(input: {
  authored: JsonValue | undefined;
  request: JsonObject;
  schema: AutomationStudioRecordSchema;
  requested: readonly string[] | undefined;
  names: readonly { field: string; written: string }[];
  /** The site's names for each renamed column (`./site-names.ts`): a label the author's schema repeats from them is stale, not the author's. */
  siteNames?: Readonly<Record<string, readonly string[]>> | undefined;
}): JsonValue {
  const authored = isObject(input.authored) ? input.authored : undefined;
  if (input.authored !== undefined && input.authored !== null && authored === undefined) return structuredClone(input.authored);
  if (authored && !webAutomationStoredColumns(authored, input.request as unknown as WebAutomationExtractListRequest).ok) return structuredClone(authored);
  const names = new Map(input.names.map((entry) => [entry.field, entry.written]));
  const name = (id: string): string => names.get(id) ?? id;
  const originalFields = isObject(authored?.schema) && Array.isArray(authored.schema.fields) ? authored.schema.fields : [];
  const exclusions = new Set(originalFields.flatMap((field) => isObject(field) && field.handling === "exclude" && typeof field.id === "string" ? [field.id] : []));
  const columns = originalFields.flatMap((field) => isObject(field) && field.handling !== "exclude" && typeof field.id === "string" ? [field.id] : []);
  // A column labelled by its own id (a plan's name for it, `./retained-schema.ts`) takes the label the author wrote for
  // that id, which is its human name; any other keeps the stored label. No label may answer to another field's id (t997).
  const written = authoredLabels(originalFields);
  const folded = (text: string) => text.replace(/[_\-\s]+/gu, " ").trim().toLowerCase();
  const chosen = (id: string): string | undefined => {
    const label = written.get(name(id));
    return label === undefined || input.siteNames?.[id]?.some((site) => folded(site) === folded(label)) ? undefined : label;
  };
  const labels = webLlmUniqueStoredLabels(input.schema.fields.map((field) => ({ id: name(field.id), label: field.label === field.id ? chosen(field.id) ?? field.label : field.label })));
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

/** The label the author wrote for each field id it declared, screened as every page string the domain publishes. */
function authoredLabels(fields: readonly JsonValue[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const field of fields) {
    if (!isObject(field) || typeof field.id !== "string" || typeof field.label !== "string") continue;
    const text = screenedPageText(field.label);
    if (text !== undefined && !isWithheldText(text)) labels.set(field.id, text.slice(0, 200));
  }
  return labels;
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

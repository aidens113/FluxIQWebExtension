import type { AutomationStudioRecordField, AutomationStudioRecordSchema } from "fluxiq/automation";
import { webLlmColumnType, webLlmUniqueStoredLabels, type WebLlmExtractionBinding } from "../../structure";
import { webExtractionColumnReading } from "./column-reading";
import type { WebExtractionColumns } from "./columns";

/**
 * Structural metadata rebased onto the complete read, without copying samples.
 *
 * A field that reads what a detected column reads keeps that column's stored label -- the page's column words, or
 * the detected key (`../../structure/stored-label.ts`) -- under whatever id the read keeps it: a model's own name for
 * the column (`plus` for `brightaisle_plus`) is its id, and its label is still the site's, so a declaration binds it
 * by either (Core binds an exact id, then a unique label). A field that reads something else is labelled by its id.
 */
export function webPlanRetainedExtractionSchema(binding: WebLlmExtractionBinding, columns: Extract<WebExtractionColumns, { ok: true }>): AutomationStudioRecordSchema {
  const known = new Map(binding.recordSchema?.fields.map((field) => [field.id, field]));
  const identities = new Map<string, string>();
  const fields = Object.entries(columns.fields).map(([id, field]): AutomationStudioRecordField => {
    const source = columns.sources[id]!;
    const original = binding.extractList.fields[source];
    const same = original !== undefined && webExtractionColumnReading(original) === webExtractionColumnReading(field);
    const spec = typeof field === "string" ? undefined : field;
    const metadata = same ? known.get(source) : undefined;
    const handling = metadata?.handling === "exclude" || spec?.handling === "exclude" ? "exclude" : spec?.handling ?? metadata?.handling;
    const semanticType = metadata?.semanticType ?? (spec === undefined ? undefined : webLlmColumnType(id, spec, undefined).type);
    if (same && handling !== "exclude" && handling !== "encrypt" && !identities.has(source)) identities.set(source, id);
    // A stored label that is only the detected key (a generated class path) gives way to the column's readable name
    // (`../../structure/column-names.ts`, t1038), so a declaration binds it by that name as well as by its id.
    const readable = metadata?.label === source ? binding.names?.[source] : undefined;
    const label = readable ?? metadata?.label ?? id;
    const retained: AutomationStudioRecordField = { id, label, valueType: "string" };
    if (semanticType !== undefined) retained.semanticType = semanticType;
    const mark = metadata?.mark ?? spec?.mark;
    if (mark !== undefined) retained.mark = mark;
    if (handling !== undefined) retained.handling = handling;
    if (spec?.required !== undefined) retained.required = spec.required;
    return retained;
  });
  // One label per field, none answering to another field's id (`../../structure/stored-labels.ts`).
  const labels = webLlmUniqueStoredLabels(fields);
  for (const [index, field] of fields.entries()) field.label = labels[index]!;
  const primaryKey = binding.recordSchema?.primaryKey;
  const retained: AutomationStudioRecordSchema = { schemaVersion: "0.1", fields };
  if (primaryKey?.length && primaryKey.every((id) => identities.has(id))) retained.primaryKey = primaryKey.map((id) => identities.get(id)!);
  return retained;
}

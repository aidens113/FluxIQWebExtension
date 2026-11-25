import type { AutomationStudioRecordField, AutomationStudioRecordSchema } from "fluxiq/automation";
import { webLlmColumnType, webLlmUniqueStoredLabels, type WebLlmExtractionBinding } from "../../structure";
import { webExtractionColumnReading } from "./column-reading";
import type { WebExtractionColumns } from "./columns";

/**
 * Structural metadata rebased onto the complete read, without copying samples.
 *
 * A field that reads what a detected column reads and keeps the site's name for it keeps that column's stored label --
 * the page's column words, or the detected key (`../../structure/stored-label.ts`). A field the plan renames
 * (`plus` for `brightaisle_plus`), and a field that reads something else, is labelled by its id: the name the person
 * asked for is the column's human name, and a declaration naming the site's word is rewritten to it
 * (`./stored-columns.ts`).
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
    // A column `fields` renames is labelled by the plan's own name, the human column name Core heads an answer with
    // (lead's decision 2026-11-25, which reverses t997); the site's key and readable name bind through the name
    // rewrite (`./stored-columns.ts`). A column kept under the site's name keeps the page's words, or its readable
    // name where the stored label is only the detected key (`../../structure/column-names.ts`, t1038).
    const renamed = id !== source && id !== binding.names?.[source];
    const readable = metadata?.label === source ? binding.names?.[source] : undefined;
    const label = renamed ? id : readable ?? metadata?.label ?? id;
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

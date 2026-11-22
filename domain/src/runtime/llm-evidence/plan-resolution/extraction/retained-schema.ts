import type { AutomationStudioRecordField, AutomationStudioRecordSchema } from "fluxiq/automation";
import { webLlmColumnType, type WebLlmExtractionBinding } from "../../structure";
import { webExtractionColumnReading } from "./column-reading";
import type { WebExtractionColumns } from "./columns";

/** Structural metadata rebased onto the complete read, without copying samples. */
export function webPlanRetainedExtractionSchema(binding: WebLlmExtractionBinding, columns: Extract<WebExtractionColumns, { ok: true }>): AutomationStudioRecordSchema {
  const known = new Map(binding.recordSchema?.fields.map((field) => [field.id, field]));
  const labels = new Set<string>();
  const identities = new Map<string, string>();
  const fields = Object.entries(columns.fields).map(([id, field]): AutomationStudioRecordField => {
    const source = columns.sources[id]!;
    const original = binding.extractList.fields[source];
    const same = original !== undefined && webExtractionColumnReading(original) === webExtractionColumnReading(field);
    const spec = typeof field === "string" ? undefined : field;
    const metadata = same ? known.get(source) : undefined;
    const handling = metadata?.handling === "exclude" || spec?.handling === "exclude" ? "exclude" : spec?.handling ?? metadata?.handling;
    const semanticType = metadata?.semanticType ?? (spec === undefined ? undefined : webLlmColumnType(id, spec, undefined).type);
    const preferred = (metadata?.label ?? id).slice(0, 200);
    let label = preferred;
    for (let suffix = 2; labels.has(label); suffix += 1) label = `${preferred.slice(0, 80)} (${id} ${suffix})`;
    labels.add(label);
    if (same && handling !== "exclude" && handling !== "encrypt" && !identities.has(source)) identities.set(source, id);
    const retained: AutomationStudioRecordField = { id, label, valueType: "string" };
    if (semanticType !== undefined) retained.semanticType = semanticType;
    const mark = metadata?.mark ?? spec?.mark;
    if (mark !== undefined) retained.mark = mark;
    if (handling !== undefined) retained.handling = handling;
    if (spec?.required !== undefined) retained.required = spec.required;
    return retained;
  });
  const primaryKey = binding.recordSchema?.primaryKey;
  const retained: AutomationStudioRecordSchema = { schemaVersion: "0.1", fields };
  if (primaryKey?.length && primaryKey.every((id) => identities.has(id))) retained.primaryKey = primaryKey.map((id) => identities.get(id)!);
  return retained;
}

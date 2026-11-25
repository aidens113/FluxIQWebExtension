// The declared answer is a view over every safe field the read retains.
// Explicit exclusions still prevent the page from reading a value at all.
import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebAutomationExtractField, WebAutomationExtractListRequest } from "../../actions/extraction";

export type WebAutomationDeclaredColumnsRead = {
  request: WebAutomationExtractListRequest;
  /** Every stored safe field, whether the answer displays it or not. */
  columns: ReadonlySet<string>;
  shown?: string[];
  hidden: string[];
  /** Compatibility diagnostic: presentation selection no longer drops fields. */
  dropped: string[];
};

/** Retain the full request; make undisplayed fields optional and honor explicit exclusions. */
export function webAutomationDeclaredColumnsRead(authored: JsonValue | undefined, request: WebAutomationExtractListRequest): WebAutomationDeclaredColumnsRead | undefined {
  if (!isJsonObject(authored)) return undefined;
  const schema = isJsonObject(authored.schema) ? authored.schema : undefined;
  const declared = Array.isArray(schema?.fields) ? schema.fields : [];
  const valid = declared.every((field) => isJsonObject(field) && typeof field.id === "string" && Object.hasOwn(request.fields, field.id));
  if (!valid) return undefined;
  const excluded = new Set(declared.flatMap((field) => isJsonObject(field) && field.handling === "exclude" && typeof field.id === "string" ? [field.id] : []));
  const process = isJsonObject(authored.process) ? authored.process : undefined;
  const selected = Array.isArray(process?.columns) ? process.columns.filter((id): id is string => typeof id === "string")
    : declared.flatMap((field) => isJsonObject(field) && field.handling !== "exclude" && typeof field.id === "string" ? [field.id] : []);
  const fields: Record<string, WebAutomationExtractField> = {};
  for (const [id, field] of Object.entries(request.fields)) {
    fields[id] = excluded.has(id) ? { ...(typeof field === "string" ? { kind: "text" as const, selector: field } : field), handling: "exclude" } : field;
  }
  const columns = new Set(Object.entries(fields).filter(([, field]) => typeof field === "string" || field.handling === undefined || field.handling === "include").map(([id]) => id));
  const answer = new Set(Array.isArray(process?.columns) || selected.length ? selected : columns);
  const hidden = [...columns].filter((id) => !answer.has(id));
  if (!hidden.length && !excluded.size) return undefined;
  for (const id of hidden) {
    const field = fields[id]!;
    if (typeof field !== "string" && field.required !== false) fields[id] = { ...field, required: false };
  }
  return {
    // The shown columns are the asked ones; the rest stay kept only and are never pressed open (t1033).
    request: { ...request, fields, ...(hidden.length ? { askedFields: [...answer].filter((id) => Object.hasOwn(fields, id)) } : {}) }, columns, hidden, dropped: [],
    ...(authored.purpose !== "intermediate" && (process === undefined || !Object.hasOwn(process, "columns")) ? { shown: [...answer] } : {})
  };
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

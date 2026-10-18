// An explicitly deduped excluded link is an identity helper, not an answer
// column. Normalize only that helper; displayed links and raw attributes keep
// their exact read contract.
import type { JsonValue } from "fluxiq/core";
import type { WebAutomationExtractListRequest } from "../../actions/extraction";

/** Opts eligible hidden link helpers into tracking-free identity reads. */
export function webAutomationDedupeLinkIdentity(authored: JsonValue | undefined, request: WebAutomationExtractListRequest): WebAutomationExtractListRequest {
  if (!object(authored) || !object(authored.schema) || !Array.isArray(authored.schema.fields)) return request;
  const process = object(authored.process) ? authored.process : undefined;
  // Without an explicit projection the reconciled schema may display every
  // read field, even a processing helper the authored schema excluded.
  if (!Array.isArray(process?.columns)) return request;
  const dedupe = process && object(process.dedupe) ? process.dedupe : undefined;
  const keys = new Set(request.dedupe?.by ?? (Array.isArray(dedupe?.by) ? dedupe.by.filter((key): key is string => typeof key === "string") : []));
  const shown = new Set(process.columns.filter((key): key is string => typeof key === "string"));
  const excluded = new Set(authored.schema.fields.flatMap((field) => object(field) && field.handling === "exclude" && typeof field.id === "string" ? [field.id] : []));
  let changed = false;
  const fields = Object.fromEntries(Object.entries(request.fields).map(([key, field]) => {
    if (!keys.has(key) || !excluded.has(key) || shown.has(key) || typeof field === "string" || field.kind !== "link" || field.handling === "exclude" || field.identity === "tracking-free") return [key, field];
    changed = true;
    return [key, { ...field, identity: "tracking-free" as const }];
  }));
  return changed ? { ...request, fields } : request;
}

function object(value: unknown): value is Record<string, JsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

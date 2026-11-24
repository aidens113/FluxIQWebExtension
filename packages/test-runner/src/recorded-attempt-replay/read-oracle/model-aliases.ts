import type { JsonObject, JsonValue } from "fluxiq/core";

/**
 * A declaration's field names as the run's own reads named them. A declaration names a column by the site's own
 * detected key (`brightaisle_plus`, `data-ad-id`) or by the instruction's column word; a read whose model wrote its own
 * key for a detected column (`plus: "brightaisle_plus"`) keeps that column under the model's key only, so the name is
 * rewritten to the key every admitted read gave that same detected column. Nothing is guessed: a detected key the
 * reads aliased differently, or not at all, is left as written, and Core's strict binding then decides.
 */
export function declarationInRunTerms(process: JsonObject, calls: readonly JsonObject[]): { process: JsonObject; rewritten: Record<string, string> } {
  const aliases = new Map<string, Set<string>>();
  for (const call of calls) {
    const fields = record(record(record(call.parameters)?.extractList)?.fields);
    for (const [alias, detected] of Object.entries(fields ?? {})) {
      if (typeof detected !== "string") continue;
      const key = detected.split("@")[0]!;
      if (key === alias) continue;
      aliases.set(key, new Set([...(aliases.get(key) ?? []), alias]));
    }
  }
  const rewritten: Record<string, string> = {};
  const name = (field: JsonValue | undefined): JsonValue | undefined => {
    if (typeof field !== "string") return field;
    const named = aliases.get(field);
    if (named === undefined || named.size !== 1 || calls.length === 0) return field;
    const alias = [...named][0]!;
    rewritten[field] = alias;
    return alias;
  };
  const entries = (value: JsonValue | undefined): JsonValue | undefined => Array.isArray(value) ? value.map((entry) => record(entry) ? { ...record(entry)!, field: name(record(entry)!.field as JsonValue) } as JsonObject : entry) : value;
  const next: JsonObject = { ...process };
  if (process.where !== undefined) next.where = entries(process.where)!;
  if (process.sort !== undefined) next.sort = entries(process.sort)!;
  if (Array.isArray(process.columns)) next.columns = process.columns.map((column) => name(column) as JsonValue);
  return { process: next, rewritten };
}

function record(value: unknown): Record<string, JsonValue> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, JsonValue> : undefined;
}

import type { JsonValue } from "fluxiq/core";

/** Canonical private identity; never logged or returned in tool evidence. */
export function webNodeFrozenKey(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(webNodeFrozenKey).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${webNodeFrozenKey(value[key]!)}`).join(",")}}`;
}

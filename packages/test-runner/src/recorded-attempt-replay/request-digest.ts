import { createHash } from "node:crypto";

/** No lossy normalization: task, model, grammar, evidence and array order all participate. */
export function recordedRequestDigest(body: string): string {
  const value: unknown = JSON.parse(body);
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("recorded_request_not_object");
  const canonical = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(canonical);
    if (entry !== null && typeof entry === "object") return Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
    return entry;
  };
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

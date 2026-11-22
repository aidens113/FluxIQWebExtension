import type { WebAutomationExtractField } from "../../../../actions/extraction";

/** The value a field reads, independent of whether it is required or retained. */
export function webExtractionColumnReading(field: WebAutomationExtractField): string {
  const spec = typeof field === "string" ? { kind: "text", selector: field } : field;
  return JSON.stringify(Object.fromEntries(Object.entries(spec)
    .filter(([key]) => key !== "required" && key !== "handling")
    .sort(([a], [b]) => a.localeCompare(b))));
}

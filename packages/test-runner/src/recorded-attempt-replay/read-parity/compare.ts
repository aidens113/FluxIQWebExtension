import { isDeepStrictEqual } from "node:util";
import { parseAutomationStudioRecordSchema, storedAutomationStudioRecordSchema, validateAutomationStudioRecords } from "fluxiq/components/automation";

/** Raw ordered equality is primary. Schema copying/coercion never supplies or replaces a recorded cell. */
export function compareRecordedReadRows(input: { actual: unknown; expected: unknown; currentDerivedSchema?: unknown }) {
  const records = (value: unknown): value is Record<string, unknown>[] => Array.isArray(value) && value.length > 0 && value.every(row => row !== null && typeof row === "object" && !Array.isArray(row));
  const expected = records(input.expected) ? input.expected : undefined;
  const actual = records(input.actual) ? input.actual : undefined;
  const rowsMatch = expected !== undefined && actual !== undefined && isDeepStrictEqual(actual, expected);
  let currentSchema: "unavailable" | "valid" | "invalid" = "unavailable";
  let invalidRecords: number | null = null;
  if (input.currentDerivedSchema !== undefined) {
    const parsed = parseAutomationStudioRecordSchema(input.currentDerivedSchema);
    currentSchema = "invalid";
    if (parsed.ok) {
      const validation = validateAutomationStudioRecords(input.actual, storedAutomationStudioRecordSchema(parsed.schema));
      invalidRecords = validation.invalidCount;
      currentSchema = actual !== undefined && validation.rows.length === actual.length && validation.invalidCount === 0 && !validation.truncated ? "valid" : "invalid";
    }
  }
  return { rowsMatch, contractRowsMatch: rowsMatch && currentSchema === "valid", expectedRecords: expected?.length ?? null, actualRecords: actual?.length ?? null, expectedFieldCounts: expected ? [...new Set(expected.map(row => Object.keys(row).length))] : [], actualFieldCounts: actual ? [...new Set(actual.map(row => Object.keys(row).length))] : [], schemaOrigin: "current_dispatch_derived" as const, currentSchema, invalidRecords };
}

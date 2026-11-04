import type { ChatAttemptProvenance } from "@fluxiq/ui-components";
import { asRecord } from "../../reply";

const KEYS = (record: Record<string, unknown>, names: readonly string[]): boolean => Object.keys(record).length === names.length && names.every((name) => name in record);

/**
 * Where an attempt's steps came from, as Core says it (`AutomationStudioTaskOutcome.provenance`), or
 * undefined for anything that is not exactly that shape. The contract's parsers know nothing of it, so
 * it is checked here field by field: a record that does not read is a failed read, never a guess, and an
 * unknown field never passes silently.
 */
export function readProvenance(value: unknown): ChatAttemptProvenance | undefined {
  const fields = asRecord(value);
  if (fields === undefined || !KEYS(fields, ["route", "startedFrom", "steps"]) || typeof fields.route !== "string" || typeof fields.startedFrom !== "string" || !Array.isArray(fields.steps)) {
    return undefined;
  }
  const steps: ChatAttemptProvenance["steps"] = [];
  for (const each of fields.steps as unknown[]) {
    const step = asRecord(each);
    if (step === undefined || !KEYS(step, ["position", "label", "from", "ran"])) {
      return undefined;
    }
    const { position, label, from, ran } = step;
    if (typeof position !== "number" || !Number.isInteger(position) || position < 0 || typeof label !== "string" || (from !== "saved" && from !== "worked_out") || typeof ran !== "boolean") {
      return undefined;
    }
    steps.push({ position, label, from, ran });
  }
  return { route: fields.route, startedFrom: fields.startedFrom, steps };
}

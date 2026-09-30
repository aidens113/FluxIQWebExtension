// The bundle's record of a run's Week 2 adaptation measurements, and reading it
// back. Both producers of a `RunEvaluation` read the same file, as they do the
// evidence sizes (`flow-lane-evidence-sizes.ts`), so a run and its bench row
// always carry the same measurements.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  validateRunAdaptationCost, validateRunAdaptationPersistence, validateRunAdaptationReuse, validateRunAdaptationValidation,
  type RunAdaptationMeasurements, type ValidationResult,
} from "@fluxiq-web-extension/test-contracts";

/** Where a Flow lane writes `readRunAdaptationMeasurements`' result, relative to the bundle. */
export const RUN_ADAPTATION_SNAPSHOT = path.join("snapshots", "adaptation.json");

/** Nothing measured: every member `null`, which the contract reads as unmeasured, never as zero. */
export const UNMEASURED_ADAPTATION: Readonly<RunAdaptationMeasurements> = Object.freeze({ adaptationReuse: null, adaptationValidation: null, adaptationPersistence: null, adaptationCost: null });

const validators = {
  adaptationReuse: validateRunAdaptationReuse,
  adaptationValidation: validateRunAdaptationValidation,
  adaptationPersistence: validateRunAdaptationPersistence,
  adaptationCost: validateRunAdaptationCost,
} satisfies { [K in keyof RunAdaptationMeasurements]: (input: unknown) => ValidationResult<NonNullable<RunAdaptationMeasurements[K]>> };

/**
 * The measurements in a bundle's `snapshots/adaptation.json`, member by member.
 *
 * An absent file is a run whose lane measured no adaptation -- no Flow ran, or
 * the lane does not read Core's adaptations -- and yields `UNMEASURED_ADAPTATION`.
 * A file that is not JSON, and any member that does not fit its contract, is
 * unmeasured too: this runs after the run has finished and inside a bench, and
 * a record the evaluation would refuse must not end either.
 */
export function flowLaneAdaptationMeasurements(bundlePath: string): RunAdaptationMeasurements {
  const file = path.join(bundlePath, RUN_ADAPTATION_SNAPSHOT);
  if (!existsSync(file)) return { ...UNMEASURED_ADAPTATION };
  const parsed = parsedSnapshot(readFileSync(file, "utf8"));
  const record = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  return {
    adaptationReuse: fitting(record.adaptationReuse, validators.adaptationReuse),
    adaptationValidation: fitting(record.adaptationValidation, validators.adaptationValidation),
    adaptationPersistence: fitting(record.adaptationPersistence, validators.adaptationPersistence),
    adaptationCost: fitting(record.adaptationCost, validators.adaptationCost),
  };
}

/** The snapshot's JSON, or the text itself when it is not JSON: a string fits no member, so every one reads as unmeasured. */
function parsedSnapshot(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) return text;
    throw error;
  }
}

function fitting<T>(value: unknown, validate: (input: unknown) => ValidationResult<T>): T | null {
  if (value === null || value === undefined) return null;
  const checked = validate(value);
  return checked.valid ? checked.value : null;
}

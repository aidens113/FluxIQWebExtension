// A scenario's person-only checks, loaded from the scenario lab build the run
// uses, the way a scenario's declared repair is (`flow-lane/repair/declared-repair.ts`):
// the module sits beside its fixture (`apps/scenario-lab/src/scenarios/<id>/person-check.ts`)
// and exports `PERSON_CHECKS`. This package does not depend on the scenario
// lab's source, so the shape is checked here before anything is played.

import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { personHandOffResponses, type PersonCheck, type PersonCheckStep, type PersonHandOffRow, type ScenarioPersonChecks } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";

const PERSON_MODULE = "person-check.js";
const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
/** The longest the Lab waits for one check to go once the person is done. */
const MAX_CLEAR_MS = 30_000;
/** The longest a person holds a button. */
const MAX_HOLD_MS = 10_000;
const MAX_TEXT = 200;

/**
 * The scenario's `PERSON_CHECKS`, checked, or `null` when it declares none: a
 * scenario with no person-only check has nothing for the Lab to play, and a
 * hand-off there is answered Stop and recorded as such. A module that exports
 * something else refuses the run as `fixture.invalid`, because the fix is to
 * the declaration.
 */
export async function loadPersonChecks(scenarioLabDist: string, scenarioId: string): Promise<ScenarioPersonChecks | null> {
  if (!KEBAB_ID.test(scenarioId)) throw invalid("scenarioId", "must be a kebab-case scenario id");
  const modulePath = path.join(scenarioLabDist, "scenarios", scenarioId, PERSON_MODULE);
  try {
    await access(modulePath);
  } catch (error) {
    // A scenario with no module is the one failure that means none; anything else is the build's, and says so.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const declared = await import(pathToFileURL(modulePath).href) as { PERSON_CHECKS?: unknown };
  return parsePersonChecks(declared.PERSON_CHECKS, scenarioId);
}

/** Every field, checked; a malformed module refuses whole, naming the field and never quoting a value. */
export function parsePersonChecks(value: unknown, scenarioId: string): ScenarioPersonChecks {
  const module = record(value, "PERSON_CHECKS");
  if (module.scenarioId !== scenarioId) throw invalid("PERSON_CHECKS.scenarioId", "must name the scenario the module sits beside");
  if (!Array.isArray(module.checks) || module.checks.length === 0) throw invalid("PERSON_CHECKS.checks", "must be a non-empty array");
  const checks = module.checks.map((check, index) => parseCheck(check, `PERSON_CHECKS.checks[${index}]`));
  if (new Set(checks.map(({ id }) => id)).size !== checks.length) throw invalid("PERSON_CHECKS.checks", "repeats a check id");
  if (!Array.isArray(module.handOffs)) throw invalid("PERSON_CHECKS.handOffs", "must be an array");
  const handOffs = module.handOffs.map((row, index) => parseRow(row, `PERSON_CHECKS.handOffs[${index}]`));
  const answer = optionalFunction(module.answer, "PERSON_CHECKS.answer") as ScenarioPersonChecks["answer"];
  const tampered = optionalFunction(module.tampered, "PERSON_CHECKS.tampered") as ScenarioPersonChecks["tampered"];
  if (!answer && checks.some(({ steps }) => steps.some(({ action }) => action === "type-answer"))) throw invalid("PERSON_CHECKS.answer", "is required by a type-answer step");
  return Object.freeze({ scenarioId, checks: Object.freeze(checks), handOffs: Object.freeze(handOffs), ...(answer ? { answer } : {}), ...(tampered ? { tampered } : {}) });
}

function parseCheck(value: unknown, at: string): PersonCheck {
  const check = record(value, at);
  const id = typeof check.id === "string" && KEBAB_ID.test(check.id) ? check.id : undefined;
  if (!id) throw invalid(`${at}.id`, "must be a kebab-case id");
  if (!Array.isArray(check.steps) || check.steps.length === 0) throw invalid(`${at}.steps`, "must be a non-empty array");
  if (check.clears !== "navigation" && check.clears !== "in-place") throw invalid(`${at}.clears`, "must be navigation or in-place");
  if (!Number.isInteger(check.clearsWithinMs) || Number(check.clearsWithinMs) <= 0 || Number(check.clearsWithinMs) > MAX_CLEAR_MS) throw invalid(`${at}.clearsWithinMs`, `must be an integer from 1 to ${MAX_CLEAR_MS}`);
  return Object.freeze({
    id,
    description: text(check.description, `${at}.description`),
    shows: text(check.shows, `${at}.shows`),
    steps: Object.freeze(check.steps.map((step, index) => parseStep(step, `${at}.steps[${index}]`))),
    clears: check.clears,
    clearsWithinMs: Number(check.clearsWithinMs),
  });
}

function parseStep(value: unknown, at: string): PersonCheckStep {
  const step = record(value, at);
  switch (step.action) {
    case "click": return Object.freeze({ action: "click", text: text(step.text, `${at}.text`) });
    case "type-answer": return Object.freeze({ action: "type-answer", label: text(step.label, `${at}.label`) });
    case "press": return Object.freeze({ action: "press", button: text(step.button, `${at}.button`) });
    case "press-and-hold": {
      if (!Number.isInteger(step.holdMs) || Number(step.holdMs) <= 0 || Number(step.holdMs) > MAX_HOLD_MS) throw invalid(`${at}.holdMs`, `must be an integer from 1 to ${MAX_HOLD_MS}`);
      return Object.freeze({ action: "press-and-hold", text: text(step.text, `${at}.text`), holdMs: Number(step.holdMs) });
    }
    default: throw invalid(`${at}.action`, "must be click, press-and-hold, type-answer or press");
  }
}

function parseRow(value: unknown, at: string): PersonHandOffRow {
  const row = record(value, at);
  if (!(personHandOffResponses as readonly unknown[]).includes(row.person)) throw invalid(`${at}.person`, `must be one of ${personHandOffResponses.join(", ")}`);
  if (typeof row.required !== "boolean") throw invalid(`${at}.required`, "must be true or false");
  for (const field of ["workflowId", "variantId"] as const) {
    if (row[field] !== undefined && (typeof row[field] !== "string" || !KEBAB_ID.test(row[field] as string))) throw invalid(`${at}.${field}`, "must be a kebab-case id when present");
  }
  return Object.freeze({
    person: row.person as PersonHandOffRow["person"],
    required: row.required,
    because: text(row.because, `${at}.because`),
    ...(row.workflowId === undefined ? {} : { workflowId: row.workflowId as string }),
    ...(row.variantId === undefined ? {} : { variantId: row.variantId as string }),
  });
}

function record(value: unknown, at: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(at, "must be an object");
  return value as Record<string, unknown>;
}

function text(value: unknown, at: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > MAX_TEXT) throw invalid(at, `must hold 1 to ${MAX_TEXT} characters`);
  return value;
}

function optionalFunction(value: unknown, at: string): ((state: unknown) => unknown) | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "function") throw invalid(at, "must be a function when present");
  return value as (state: unknown) => unknown;
}

function invalid(at: string, message: string): RunnerFailure {
  return new RunnerFailure("fixture.invalid", `The scenario's person module is malformed: ${at} ${message}`);
}

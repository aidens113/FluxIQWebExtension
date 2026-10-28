import { scenarioStepOperations } from "../scenario.js";
import type { ScenarioDemonstration } from "./types.js";
import type { ValidationIssue, ValidationResult } from "../validation.js";

/** What the task the demonstration belongs to says, so the validator can compare against it. */
export type ScenarioDemonstrationContext = {
  /** The task's written instruction; a description may not equal it. */
  instruction: string;
  /** The task's expectedDatasetId; a non-conflicting demonstration extracts under this step id. */
  expectedDatasetId: string;
  /** Every value of the task's expected records; a description may not name one. */
  recordValues: readonly string[];
};

export const SCENARIO_DEMONSTRATION_DESCRIPTION_MAX = 4000;

const squash = (text: string) => text.replace(/\s+/gu, " ").trim().toLowerCase();

/** Checks a demonstration's shape against the task it belongs to; returns every issue found. */
export function validateScenarioDemonstration(input: ScenarioDemonstration, context: ScenarioDemonstrationContext): ValidationResult<ScenarioDemonstration> {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  for (const key of ["id", "scenarioId", "taskId"] as const) if (!input[key]?.trim()) add(`$.${key}`, "must be a non-empty string");
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!description || description.length > SCENARIO_DEMONSTRATION_DESCRIPTION_MAX) add("$.description", `must be nonblank and at most ${SCENARIO_DEMONSTRATION_DESCRIPTION_MAX} characters`);
  if (description && squash(description) === squash(context.instruction)) add("$.description", "must not be the task instruction");
  const lowered = squash(description);
  for (const value of context.recordValues) {
    if (value.trim().length >= 3 && lowered.includes(squash(value))) add("$.description", `names the expected record value "${value}"`);
  }
  const ids = input.steps.map((step) => step.id);
  if (new Set(ids).size !== ids.length) add("$.steps", "step ids must be unique");
  input.steps.forEach((step, index) => {
    if (!(scenarioStepOperations as readonly string[]).includes(step.operation)) add(`$.steps[${index}].operation`, "is not a step operation");
  });
  const firstExtract = input.steps.findIndex((step) => step.operation === "extract");
  if (firstExtract < 0) add("$.steps", "must contain an extract step");
  if (input.detours.length === 0) add("$.detours", "must hold at least one detour");
  input.detours.forEach((detour, index) => {
    const path = `$.detours[${index}]`;
    if (!detour.why.trim()) add(`${path}.why`, "must be a non-empty string");
    if (detour.acts.length === 0) add(`${path}.acts`, "must describe at least one act a Flow node would carry");
    if (detour.stepIds.length < 2) add(`${path}.stepIds`, "must name at least the step that applies the detour and the step that undoes it");
    for (const id of detour.stepIds) {
      const at = ids.indexOf(id);
      if (at < 0) add(`${path}.stepIds`, `names step "${id}", which is not in steps`);
      else if (firstExtract >= 0 && at >= firstExtract) add(`${path}.stepIds`, `step "${id}" comes at or after the first extract step, so the detour is not undone before extracting`);
    }
  });
  if (!input.conflictsWithInstruction && !input.steps.some((step) => step.operation === "extract" && step.id === context.expectedDatasetId)) {
    add("$.steps", `a non-conflicting demonstration must extract under step id "${context.expectedDatasetId}"`);
  }
  return issues.length === 0 ? { valid: true, value: input } : { valid: false, issues };
}

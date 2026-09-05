import type { ValidationIssue, ValidationResult } from "./validation.js";

export type JsonObject = Record<string, unknown>;
export type Check = (value: unknown, path: string, issues: ValidationIssue[]) => void;
export const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);
export const add = (issues: ValidationIssue[], path: string, message: string): void => { issues.push({ path, message }); };
export function object(value: unknown, path: string, issues: ValidationIssue[]): JsonObject | undefined {
  if (!isObject(value)) { add(issues, path, "must be an object"); return undefined; }
  return value;
}
export function keys(value: JsonObject, allowed: readonly string[], path: string, issues: ValidationIssue[]): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) add(issues, `${path}.${key}`, "unknown property");
}
export function text(value: JsonObject, key: string, path: string, issues: ValidationIssue[]): void {
  if (typeof value[key] !== "string" || value[key].length === 0) add(issues, `${path}.${key}`, "must be a non-empty string");
}
export function optionalText(value: JsonObject, key: string, path: string, issues: ValidationIssue[]): void {
  if (value[key] !== undefined && (typeof value[key] !== "string" || value[key].length === 0)) add(issues, `${path}.${key}`, "must be a non-empty string when provided");
}
export function array(value: unknown, path: string, issues: ValidationIssue[], check: Check): void {
  if (!Array.isArray(value)) { add(issues, path, "must be an array"); return; }
  value.forEach((entry, index) => check(entry, `${path}[${index}]`, issues));
}
export function finite(value: unknown, path: string, issues: ValidationIssue[], minimum = 0, maximum = Number.MAX_SAFE_INTEGER, integer = false): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) add(issues, path, `must be a finite ${integer ? "integer " : "number "}from ${minimum} to ${maximum}`);
}
export function enumeration(value: unknown, allowed: readonly string[], path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !allowed.includes(value)) add(issues, path, `must be one of ${allowed.join(", ")}`);
}
export function date(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/u.test(value) || !Number.isFinite(Date.parse(value))) add(issues, path, "must be a valid ISO date-time");
}
export function sha256(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) add(issues, path, "must be a lowercase SHA-256 digest");
}
export function safeRelativePath(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || value.length === 0 || value.includes("\\") || value.startsWith("/") || /^[A-Za-z]:/u.test(value) || value.split("/").includes("..")) add(issues, path, "must be a normalized relative path without traversal");
}
export function uniqueStrings(values: unknown[], path: string, issues: ValidationIssue[], label: string): void {
  const strings = values.filter((value): value is string => typeof value === "string");
  if (new Set(strings).size !== strings.length) add(issues, path, `${label} must be unique`);
}
export function result<T>(input: unknown, issues: ValidationIssue[]): ValidationResult<T> {
  return issues.length === 0 ? { valid: true, value: input as T } : { valid: false, issues };
}
export function parseJson(json: string, contract: string): unknown {
  try { return JSON.parse(json) as unknown; }
  catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${contract} JSON parse failed: ${detail}`);
  }
}

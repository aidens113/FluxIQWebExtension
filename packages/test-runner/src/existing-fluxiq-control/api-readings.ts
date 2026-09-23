// Reading one value out of a FluxIQ API answer.
//
// Every reader refuses rather than coerces, and every refusal is
// `environment.missing`: a malformed answer is the installation talking, not
// the automation. They take the path they are reading so a refusal names the
// field and the caller never has to guess which one it was.

import { RunnerFailure } from "../failure.js";

export type JsonRecord = Record<string, unknown>;

export function invalid(message: string): never {
  throw new RunnerFailure("environment.missing", `Malformed FluxIQ API response: ${message}`);
}
export function record(value: unknown, at: string): JsonRecord { if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${at} must be an object`); return value as JsonRecord; }
export function optionalRecord(value: unknown, at: string): JsonRecord | undefined { return value === undefined || value === null ? undefined : record(value, at); }
export function array(value: unknown, at: string): unknown[] { if (!Array.isArray(value)) invalid(`${at} must be an array`); return value; }
export function stringArray(value: unknown, at: string): string[] { return array(value, at).map((item, index) => text(item, `${at}[${index}]`)); }
export function text(value: unknown, at: string): string { if (typeof value !== "string" || !value) invalid(`${at} must be a non-empty string`); return value; }
export function nullableText(value: unknown, at: string): string | null { if (value === null || value === undefined) return null; return text(value, at); }
export function finite(value: unknown, at: string): number { if (typeof value !== "number" || !Number.isFinite(value)) invalid(`${at} must be finite`); return value; }
export function integer(value: unknown, at: string): number { const result = finite(value, at); if (!Number.isSafeInteger(result) || result < 0) invalid(`${at} must be a non-negative integer`); return result; }
export function positiveInteger(value: number, at: string): number { if (!Number.isSafeInteger(value) || value < 1) invalid(`${at} must be a positive integer`); return value; }
export function boolean(value: unknown, at: string): boolean { if (typeof value !== "boolean") invalid(`${at} must be a boolean`); return value; }
export function enumeration<const T extends readonly string[]>(value: unknown, allowed: T, at: string): T[number] { if (typeof value !== "string" || !allowed.includes(value)) invalid(`${at} is invalid`); return value as T[number]; }
export function nullableUrl(value: unknown, at: string): string | null { if (value === null || value === undefined) return null; const result = text(value, at); let url: URL; try { url = new URL(result); } catch { invalid(`${at} must be a URL`); } if (url!.protocol !== "ws:" && url!.protocol !== "wss:") invalid(`${at} must use ws or wss`); return url!.toString(); }

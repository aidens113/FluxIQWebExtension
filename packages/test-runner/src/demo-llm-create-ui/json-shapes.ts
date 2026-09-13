// Reading an untrusted JSON body without keeping any of it. Every accessor
// here narrows one value and fails closed, so a malformed or oversized Core
// or provider response becomes a bounded failure instead of leaking through
// into a diagnostic.

import { fail } from "./runner-fail.js";

export function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) fail("Flow bootstrap response was malformed"); return value as Record<string, unknown>; }
export function text(value: unknown): string { if (typeof value !== "string" || !value.trim()) fail("Flow bootstrap response omitted a required string"); return value; }
export function identifier(value: unknown): string { const result = text(value); if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u.test(result)) fail("Flow bootstrap response contained an invalid identifier"); return result; }
export function integer(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 0) fail("Flow bootstrap response omitted finite provider token accounting"); return value as number; }
export function finite(value: unknown): number { if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail("Flow bootstrap response omitted finite provider cost accounting"); return value; }

export function hasExactEnvelope(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every(field => Object.prototype.hasOwnProperty.call(value, field));
}

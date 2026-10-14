import { FACILITY_FAILURE_REFUSAL_MAX_LENGTH } from "./evaluation.js";

/** Anything that is not one printable line: control characters, line and paragraph separators. */
const NOT_ONE_LINE = /[\p{Cc}\p{Zl}\p{Zp}]/u;

/**
 * Text shaped like a credential. The first two are the evidence redaction's own
 * rule (`@fluxiq-web-extension/test-evidence`, `redactText`), which this
 * package cannot import because that package depends on it, widened to a few
 * more credential names; `[REDACTED]` means someone upstream already found a
 * secret here. `LONG_TOKEN` is the runner's long-token rule
 * (`boundedRunnerMessage`): a run of 32 or more identifier characters mixing
 * letters and digits is a key, a hash or an id.
 */
const SECRET_SHAPED = [
  /\bBearer\s+[A-Za-z0-9._~+/-]+/iu,
  /\b(?:password|passwd|pairing[_-]?token|access[_-]?token|secret|cookie|authorization|api[_-]?key)\s*[=:]\s*[^\s,;&]+/iu,
  /\[REDACTED\]/u,
] as const;
const LONG_TOKEN = /[A-Za-z0-9_-]{32,}/gu;

/**
 * Whether `value` may stand as a `core.refused` facility failure's `refusal`:
 * a trimmed, single-line sentence of 1 to `FACILITY_FAILURE_REFUSAL_MAX_LENGTH`
 * characters with nothing shaped like a credential in it. The evaluation
 * validator holds every record to this, and the runner applies it after the
 * evidence redaction, so a refusal that fails is dropped rather than recorded.
 * The runner screens Core's whole sentence with `maxLength` lifted before it
 * bounds it, so a secret the cut would split is never half kept.
 */
export function isScreenedFacilityRefusal(value: unknown, maxLength: number = FACILITY_FAILURE_REFUSAL_MAX_LENGTH): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) return false;
  if (value !== value.trim() || /\s{2}/u.test(value) || NOT_ONE_LINE.test(value)) return false;
  if (SECRET_SHAPED.some((pattern) => pattern.test(value))) return false;
  for (const token of value.match(LONG_TOKEN) ?? []) if (/[0-9]/u.test(token) && /[A-Za-z]/u.test(token)) return false;
  return true;
}

export class RedactionFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedactionFailure";
  }
}

export type RedactionOptions = {
  deniedKeys?: readonly string[];
  secrets?: readonly string[];
  replacement?: string;
};

const DEFAULT_DENIED_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "passwd",
  "pairingtoken",
  "pairing_token",
  "bearertoken",
  "bearer_token",
  "accesstoken",
  "access_token",
  "secret",
] as const;

const SENSITIVE_TEXT = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\b(?:password|passwd|pairing[_-]?token|access[_-]?token)\s*[=:]\s*[^\s,;&]+/gi,
] as const;

function normalizedKey(key: string): string {
  return key.toLowerCase().replaceAll("-", "").replaceAll("_", "");
}

export function redactText(value: string, options: RedactionOptions = {}): string {
  const replacement = options.replacement ?? "[REDACTED]";
  let result = value;
  for (const secret of options.secrets ?? []) {
    if (!secret) throw new RedactionFailure("Redaction secrets must not contain empty strings");
    result = result.split(secret).join(replacement);
  }
  for (const pattern of SENSITIVE_TEXT) result = result.replace(pattern, replacement);
  return result;
}

/**
 * What stands in for the one edge that closes a cycle, so the rest of the
 * evidence still reaches disk.
 */
export const CIRCULAR_REFERENCE_MARKER = "[CIRCULAR]";

/**
 * Walk structured evidence, redacting as it goes.
 *
 * **A repeated reference is not a cycle.** This guard used to be a visited set
 * that was never unwound, so the *second* appearance of any shared object threw
 * -- and the evidence the run existed to record was replaced by a runner error.
 * `flow-lane.json` is exactly that shape: `persisted-flow-run.ts` sets the
 * run-level `failure` to the same object as the first failing action's
 * `failure`, and `run-scenario.ts` writes both. So every Flow-lane run that
 * reported a structured failure lost its evidence and was filed as `unknown`.
 * A shared child appearing twice in a tree is ordinary, serializes fine, and
 * must be redacted at each appearance.
 *
 * The set below therefore tracks the **current path** -- the ancestors of the
 * node being walked -- and unwinds on the way back out. Only an object reached
 * from inside itself is a cycle, and that one back-edge becomes
 * `CIRCULAR_REFERENCE_MARKER` rather than an exception: the ancestor it points
 * at is already being walked and redacted at its own position, so substituting
 * the edge withholds strictly more than it lets through, terminates, and leaves
 * a producer bug visible in the bundle instead of destroying the bundle.
 *
 * Redaction state is not involved in any of this. `denied` and `redactText` are
 * untouched by the path set, every occurrence of a shared object is redacted
 * independently (there is no memo cache that could return an unredacted or
 * once-redacted result), and the marker is a constant that no input reaches.
 */
export function redactStructured<T>(value: T, options: RedactionOptions = {}): T {
  const denied = new Set((options.deniedKeys ?? DEFAULT_DENIED_KEYS).map(normalizedKey));
  const replacement = options.replacement ?? "[REDACTED]";
  const ancestors = new Set<object>();
  const walk = (current: unknown): unknown => {
    if (typeof current === "string") return redactText(current, options);
    if (current === null || typeof current !== "object") return current;
    if (ancestors.has(current)) return CIRCULAR_REFERENCE_MARKER;
    ancestors.add(current);
    try {
      if (Array.isArray(current)) return current.map((entry) => walk(entry));
      const output: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(current)) {
        output[key] = denied.has(normalizedKey(key)) ? replacement : walk(entry);
      }
      return output;
    } finally {
      ancestors.delete(current);
    }
  };
  return walk(value) as T;
}

export function assertNoSensitiveText(value: string, secrets: readonly string[] = []): void {
  for (const secret of secrets) {
    if (secret && value.includes(secret)) throw new RedactionFailure("Evidence contains a configured secret");
  }
  for (const pattern of SENSITIVE_TEXT) {
    pattern.lastIndex = 0;
    if (pattern.test(value)) throw new RedactionFailure("Evidence contains a sensitive token pattern");
  }
}

export function assertVerifiedVisual(value: unknown): asserts value is import("./types.js").VerifiedVisual {
  if (!value || typeof value !== "object" || (value as { redactionVerified?: unknown }).redactionVerified !== true) {
    throw new RedactionFailure("Visual evidence was not explicitly verified by the redaction adapter");
  }
}

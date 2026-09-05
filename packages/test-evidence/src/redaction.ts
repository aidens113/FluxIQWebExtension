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

export function redactStructured<T>(value: T, options: RedactionOptions = {}): T {
  const denied = new Set((options.deniedKeys ?? DEFAULT_DENIED_KEYS).map(normalizedKey));
  const seen = new WeakSet<object>();
  const walk = (current: unknown): unknown => {
    if (typeof current === "string") return redactText(current, options);
    if (current === null || typeof current !== "object") return current;
    if (seen.has(current)) throw new RedactionFailure("Circular structured evidence cannot be safely serialized");
    seen.add(current);
    if (Array.isArray(current)) return current.map(walk);
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(current)) {
      output[key] = denied.has(normalizedKey(key)) ? options.replacement ?? "[REDACTED]" : walk(entry);
    }
    return output;
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

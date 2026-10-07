import type { WebAutomationRequestPolicy, WebAutomationRequestPolicyInput } from "./contracts";

const DEFAULTS: WebAutomationRequestPolicy = Object.freeze({
  enabled: false, allowedOrigins: Object.freeze([]), credentials: "omit", redirects: "reject",
  timeoutMs: 10_000, maxResponseBytes: 262_144
});
const LIMITS = Object.freeze({ minTimeoutMs: 1_000, maxTimeoutMs: 30_000, minResponseBytes: 1_024, maxResponseBytes: 1_048_576, maxOrigins: 32 });
const bound = new WeakMap<object, WebAutomationRequestPolicy>();

function normalize(input: unknown): WebAutomationRequestPolicy {
  if (input === undefined) return DEFAULTS;
  if (!input || typeof input !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error("Request policy must be plain data.");
  const values: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== "string" || !Object.hasOwn(DEFAULTS, key)) throw new Error("Unknown request policy field.");
    const descriptor = Object.getOwnPropertyDescriptor(input, key)!;
    if (!("value" in descriptor) || descriptor.value === undefined) throw new Error("Request policy fields must contain defined data.");
    values[key] = descriptor.value;
  }
  const enabled = (Object.hasOwn(values, "enabled") ? values.enabled : DEFAULTS.enabled);
  if (typeof enabled !== "boolean") throw new Error("Request policy enabled must be boolean.");
  const credentials = (Object.hasOwn(values, "credentials") ? values.credentials : DEFAULTS.credentials);
  const redirects = (Object.hasOwn(values, "redirects") ? values.redirects : DEFAULTS.redirects);
  if (credentials !== "omit" || redirects !== "reject") throw new Error("Request policy supports only omitted credentials and rejected redirects.");
  const timeoutMs = integer((Object.hasOwn(values, "timeoutMs") ? values.timeoutMs : DEFAULTS.timeoutMs), LIMITS.minTimeoutMs, LIMITS.maxTimeoutMs);
  const maxResponseBytes = integer((Object.hasOwn(values, "maxResponseBytes") ? values.maxResponseBytes : DEFAULTS.maxResponseBytes), LIMITS.minResponseBytes, LIMITS.maxResponseBytes);
  const allowedOrigins = origins((Object.hasOwn(values, "allowedOrigins") ? values.allowedOrigins : DEFAULTS.allowedOrigins));
  if (enabled && !allowedOrigins.length) throw new Error("Enabled request policy requires an exact HTTPS origin.");
  return Object.freeze({ enabled, allowedOrigins, credentials, redirects, timeoutMs, maxResponseBytes });
}

function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new Error("Request policy limit is outside its allowed bounds.");
  return value;
}

function origins(value: unknown): readonly string[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > LIMITS.maxOrigins) throw new Error("Request origins must be a bounded plain array.");
  const result: string[] = [];
  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) throw new Error("Unexpected request origins array field.");
  }
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string") throw new Error("Request origins must contain string data.");
    const origin = descriptor.value;
    let parsed: URL;
    try { parsed = new URL(origin); } catch { throw new Error("Request origin must be a canonical HTTPS origin."); }
    if (parsed.protocol !== "https:" || parsed.origin !== origin || parsed.username || parsed.password || parsed.hostname.includes("*")) throw new Error("Request origin must be a canonical HTTPS origin.");
    if (result.includes(origin)) throw new Error("Duplicate request origin.");
    result.push(origin);
  }
  return Object.freeze(result.sort());
}

/** Immutable instance binding. Omitted repeated registration inherits its original policy. */
export const webAutomationRequestPolicies = Object.freeze({
  normalize,
  register(owner: object, input?: WebAutomationRequestPolicyInput): WebAutomationRequestPolicy {
    const previous = bound.get(owner);
    if (input === undefined && previous) return previous;
    const policy = normalize(input);
    if (previous && JSON.stringify(previous) !== JSON.stringify(policy)) throw new Error("Conflicting request policy registration.");
    if (previous) return previous;
    bound.set(owner, policy);
    return policy;
  },
  read(owner: object): WebAutomationRequestPolicy | undefined { return bound.get(owner); }
});

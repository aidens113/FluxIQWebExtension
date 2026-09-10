import { createHash } from "node:crypto";
import { WEB_LLM_EVIDENCE_SCHEMA_VERSION, type WebLlmEvidenceElement, type WebLlmPageEvidence } from "./llm-evidence";

export const WEB_REUSABLE_EVIDENCE_FINGERPRINT_SCHEMA_VERSION = "web-reusable-evidence-fingerprint.v1" as const;
export const WEB_REUSABLE_EVIDENCE_PROJECTION_SCHEMA_VERSION = "web-reusable-evidence-projection.v1" as const;
export const WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION = "web-reusable-evidence-sanitizer.v1" as const;
export const WEB_REUSABLE_EVIDENCE_CAPABILITY_SCHEMA_VERSION = "web-client-capabilities.v1" as const;
export const WEB_REUSABLE_EVIDENCE_MAX_ELEMENTS = 40;
export const WEB_REUSABLE_EVIDENCE_MAX_ACTIONS = 20;
export const WEB_REUSABLE_EVIDENCE_MAX_CAPABILITIES = 20;
export const WEB_REUSABLE_EVIDENCE_MAX_PROJECTION_ITEMS = 24;
export const WEB_REUSABLE_EVIDENCE_MAX_PROJECTION_BYTES = 4_096;

export type WebReusableEvidenceAction = Readonly<{
  definitionId: string;
  status: "succeeded" | "failed";
  route?: "success" | "failed";
}>;

export type WebReusableEvidenceFingerprint = Readonly<{
  schemaVersion: typeof WEB_REUSABLE_EVIDENCE_FINGERPRINT_SCHEMA_VERSION;
  sanitizerVersion: typeof WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION;
  evidenceSchemaVersion: string;
  capabilitySchemaVersion: typeof WEB_REUSABLE_EVIDENCE_CAPABILITY_SCHEMA_VERSION;
  location: { origin: string; path: string };
  structuralDigest: string;
  capabilityDigest: string;
  digest: string;
  compatibilityTags: string[];
}>;

export type WebReusableEvidencePromptFact =
  | Readonly<{ kind: "element"; tag: string; role?: string; name?: string; inputType?: string; controlType?: string; optionCount?: number; sameOriginLink?: boolean }>
  | Readonly<{ kind: "action"; definitionId: string; status: "succeeded" | "failed"; route?: "success" | "failed" }>;

export type WebReusableEvidencePromptProjection = Readonly<{
  schemaVersion: typeof WEB_REUSABLE_EVIDENCE_PROJECTION_SCHEMA_VERSION;
  sanitizerVersion: typeof WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION;
  compatibilityDigest: string;
  location: { origin: string; path: string };
  facts: WebReusableEvidencePromptFact[];
  truncated: boolean;
  digest: string;
  byteCount: number;
}>;

export type WebReusableEvidenceProduction = Readonly<{
  fingerprint: WebReusableEvidenceFingerprint;
  promptProjection: WebReusableEvidencePromptProjection;
}>;

export function produceWebReusableEvidence(input: Readonly<{
  evidence: WebLlmPageEvidence;
  actions?: readonly WebReusableEvidenceAction[];
  clientCapabilities?: readonly string[];
}>, options: Readonly<{ maxProjectionBytes?: number; maxProjectionItems?: number }> = {}): WebReusableEvidenceProduction {
  if (input.evidence.schemaVersion !== WEB_LLM_EVIDENCE_SCHEMA_VERSION || input.evidence.trust !== "untrusted-page-evidence" || !Array.isArray(input.evidence.elements)) {
    throw new Error("Reusable web evidence requires the current sanitized evidence schema");
  }
  enforceSourceItemLimit(input.evidence.elements.length, WEB_REUSABLE_EVIDENCE_MAX_ELEMENTS, "element");
  enforceSourceItemLimit(input.actions?.length ?? 0, WEB_REUSABLE_EVIDENCE_MAX_ACTIONS, "action");
  enforceSourceItemLimit(input.clientCapabilities?.length ?? 0, WEB_REUSABLE_EVIDENCE_MAX_CAPABILITIES, "capability");
  const location = safeLocation(input.evidence.location);
  const elements = normalizedElements(input.evidence.elements, location);
  const actions = normalizedActions(input.actions ?? []);
  const capabilities = normalizedCapabilities(input.clientCapabilities ?? []);
  const structuralDigest = digest({ location, elements });
  const capabilityDigest = digest({ schemaVersion: WEB_REUSABLE_EVIDENCE_CAPABILITY_SCHEMA_VERSION, capabilities });
  const fingerprintBase = {
    schemaVersion: WEB_REUSABLE_EVIDENCE_FINGERPRINT_SCHEMA_VERSION,
    sanitizerVersion: WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION,
    evidenceSchemaVersion: boundedTag(input.evidence.schemaVersion, "evidence schema version"),
    capabilitySchemaVersion: WEB_REUSABLE_EVIDENCE_CAPABILITY_SCHEMA_VERSION,
    location,
    structuralDigest,
    capabilityDigest,
    compatibilityTags: [
      `web.location:${digest(location)}`,
      `web.structure:${structuralDigest}`,
      `web.capabilities:${capabilityDigest}`,
      `web.sanitizer:${WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION}`,
    ],
  };
  const fingerprint: WebReusableEvidenceFingerprint = { ...fingerprintBase, digest: digest(fingerprintBase) };
  const candidates: WebReusableEvidencePromptFact[] = [
    ...elements.map(promptElementFact),
    ...actions.map((action) => ({ kind: "action" as const, ...action })),
  ];
  return {
    fingerprint,
    promptProjection: boundedProjection(fingerprint, candidates, options),
  };
}

type NormalizedElement = Readonly<{
  tag: string;
  selectorDigest: string;
  role?: string;
  name?: string;
  inputType?: string;
  controlType?: string;
  optionCount?: number;
  sameOriginLink?: boolean;
}>;

function normalizedElements(input: readonly WebLlmEvidenceElement[], location: { origin: string; path: string }): NormalizedElement[] {
  const unique = new Map<string, NormalizedElement>();
  for (const element of input) {
    const tag = boundedToken(element.tag, 40);
    const selector = boundedText(element.selector, 500);
    if (!tag || !selector || sensitiveControl(element)) continue;
    const normalized = compact({
      tag: tag.toLowerCase(),
      selectorDigest: digest(selector),
      role: boundedToken(element.role, 80)?.toLowerCase(),
      name: boundedText(element.name, 160),
      inputType: boundedToken(element.inputType, 40)?.toLowerCase(),
      controlType: boundedToken(element.controlType, 40)?.toLowerCase(),
      optionCount: Array.isArray(element.options) ? Math.min(element.options.length, 20) : undefined,
      sameOriginLink: sameOriginHref(element.href, location.origin) ? true : undefined,
    }) as NormalizedElement;
    unique.set(canonicalJson(normalized), normalized);
  }
  return [...unique.values()].sort(compareCanonical);
}

function normalizedActions(input: readonly WebReusableEvidenceAction[]): WebReusableEvidenceAction[] {
  const unique = new Map<string, WebReusableEvidenceAction>();
  for (const action of input) {
    const definitionId = boundedTag(action.definitionId, "action definition ID");
    if (!definitionId.startsWith("web.")) continue;
    if (action.status !== "succeeded" && action.status !== "failed") continue;
    if (action.route !== undefined && action.route !== "success" && action.route !== "failed") continue;
    const normalized = compact({ definitionId, status: action.status, route: action.route }) as WebReusableEvidenceAction;
    unique.set(canonicalJson(normalized), normalized);
  }
  return [...unique.values()].sort(compareCanonical);
}

function normalizedCapabilities(input: readonly string[]): string[] {
  const values = input.map(value => boundedTag(value, "client capability"));
  return [...new Set(values)].sort();
}

function promptElementFact(element: NormalizedElement): WebReusableEvidencePromptFact {
  const { selectorDigest: _selectorDigest, ...fact } = element;
  return { kind: "element", ...fact };
}

function boundedProjection(fingerprint: WebReusableEvidenceFingerprint, candidates: WebReusableEvidencePromptFact[], options: Readonly<{ maxProjectionBytes?: number; maxProjectionItems?: number }>): WebReusableEvidencePromptProjection {
  const maxBytes = boundedLimit(options.maxProjectionBytes, WEB_REUSABLE_EVIDENCE_MAX_PROJECTION_BYTES, "projection byte limit");
  const maxItems = boundedLimit(options.maxProjectionItems, WEB_REUSABLE_EVIDENCE_MAX_PROJECTION_ITEMS, "projection item limit");
  const facts = candidates.slice(0, maxItems);
  let truncated = facts.length !== candidates.length;
  for (;;) {
    const base = {
      schemaVersion: WEB_REUSABLE_EVIDENCE_PROJECTION_SCHEMA_VERSION,
      sanitizerVersion: WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION,
      compatibilityDigest: fingerprint.digest,
      location: fingerprint.location,
      facts,
      truncated,
    };
    const withDigest = { ...base, digest: digest(base) };
    const byteCount = stableByteCount(withDigest);
    const result: WebReusableEvidencePromptProjection = { ...withDigest, byteCount };
    if (serializedBytes(result) <= maxBytes) return result;
    if (!facts.length) throw new Error("Web reusable-evidence projection envelope exceeds the byte limit");
    facts.pop();
    truncated = true;
  }
}

function stableByteCount(input: object): number {
  let value = 0;
  for (let index = 0; index < 8; index += 1) {
    const next = serializedBytes({ ...input, byteCount: value });
    if (next === value) return value;
    value = next;
  }
  return value;
}

function safeLocation(input: string): { origin: string; path: string } {
  const url = new URL(input);
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) throw new Error("Reusable web evidence requires an HTTP(S) location without credentials");
  return { origin: url.origin, path: url.pathname };
}

function sameOriginHref(input: unknown, origin: string): boolean {
  if (typeof input !== "string" || !input) return false;
  try {
    const url = new URL(input, origin);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password && url.origin === origin;
  } catch { return false; }
}

function sensitiveControl(element: WebLlmEvidenceElement): boolean {
  const types = [element.inputType, element.controlType].filter((value): value is string => typeof value === "string").map(value => value.toLowerCase());
  return types.some(value => value === "password" || value === "hidden" || value === "file" || value === "credit-card" || value === "one-time-code");
}

function boundedLimit(input: number | undefined, hardMaximum: number, label: string): number {
  if (input === undefined) return hardMaximum;
  if (!Number.isSafeInteger(input) || input < 1 || input > hardMaximum) throw new Error(`${label} must be between 1 and ${hardMaximum}`);
  return input;
}

function enforceSourceItemLimit(actual: number, maximum: number, label: string): void {
  if (actual > maximum) throw new Error(`Reusable web evidence ${label} count exceeds ${maximum}`);
}

function boundedTag(input: unknown, label: string): string {
  const value = boundedText(input, 160);
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u.test(value)) throw new Error(`${label} is malformed`);
  return value;
}

function boundedToken(input: unknown, maximum: number): string | undefined {
  const value = boundedText(input, maximum);
  return value && /^[A-Za-z0-9_.:-]+$/u.test(value) ? value : undefined;
}

function boundedText(input: unknown, maximum: number): string | undefined {
  if (typeof input !== "string") return undefined;
  const value = input.replace(/\s+/gu, " ").trim();
  return value ? value.slice(0, maximum) : undefined;
}

function compact<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

function compareCanonical(left: unknown, right: unknown): number { return canonicalJson(left).localeCompare(canonicalJson(right)); }
function digest(input: unknown): string { return createHash("sha256").update(canonicalJson(input)).digest("hex"); }
function serializedBytes(input: unknown): number { return Buffer.byteLength(JSON.stringify(input), "utf8"); }
function canonicalJson(input: unknown): string {
  if (Array.isArray(input)) return `[${input.map(canonicalJson).join(",")}]`;
  if (input && typeof input === "object") return `{${Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${JSON.stringify(key)}:${canonicalJson(value)}`).join(",")}}`;
  return JSON.stringify(input);
}

// A completed run's page evidence, reduced to what may be cached and shown to
// a later build: a fingerprint that says which page and which client it was,
// and a projection of the page's controls for the prompt.
//
// Nothing in it is capped (t200). Until 2026-09-30 a packet of more than forty
// elements threw here, and the projection kept 24 facts in 4,096 bytes, sorted
// rather than in the page's order. The packet now carries every element, so
// every one is projected, in document order. The fingerprint is still computed
// over the elements as a sorted set, because it answers "is this the same page"
// and a page that re-rendered in another order is the same page.

import { createHash } from "node:crypto";
import { isSensitiveFieldSignature } from "../sensitivity";
import { WEB_LLM_EVIDENCE_SCHEMA_VERSION, type WebLlmEvidenceElement, type WebLlmPageEvidence } from "./llm-evidence";

export const WEB_REUSABLE_EVIDENCE_FINGERPRINT_SCHEMA_VERSION = "web-reusable-evidence-fingerprint.v1" as const;
// `.v2`: every element in document order, and no `truncated`, since nothing is left out.
export const WEB_REUSABLE_EVIDENCE_PROJECTION_SCHEMA_VERSION = "web-reusable-evidence-projection.v2" as const;
// `.v2`: the packet stopped carrying element selectors, so the structural
// digest below is computed over a different set of facts. Bumping the version
// keeps a `.v1` fingerprint from ever being treated as compatible with a `.v2`
// one, which is what the digest is for.
export const WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION = "web-reusable-evidence-sanitizer.v2" as const;
export const WEB_REUSABLE_EVIDENCE_CAPABILITY_SCHEMA_VERSION = "web-client-capabilities.v1" as const;

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
}>): WebReusableEvidenceProduction {
  if (input.evidence.schemaVersion !== WEB_LLM_EVIDENCE_SCHEMA_VERSION || input.evidence.trust !== "untrusted-page-evidence" || !Array.isArray(input.evidence.elements)) {
    throw new Error("Reusable web evidence requires the current sanitized evidence schema");
  }
  const location = safeLocation(input.evidence.location);
  const elements = normalizedElements(input.evidence.elements, location);
  const actions = normalizedActions(input.actions ?? []);
  const capabilities = normalizedCapabilities(input.clientCapabilities ?? []);
  // A set for the fingerprint, whatever order the page drew it in.
  const structuralDigest = digest({ location, elements: [...elements].sort(compareCanonical) });
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
    promptProjection: promptProjection(fingerprint, candidates),
  };
}

type NormalizedElement = Readonly<{
  tag: string;
  role?: string;
  name?: string;
  inputType?: string;
  controlType?: string;
  optionCount?: number;
  sameOriginLink?: boolean;
}>;

/** Each distinct element once, in the packet's order -- document order. */
function normalizedElements(input: readonly WebLlmEvidenceElement[], location: { origin: string; path: string }): NormalizedElement[] {
  const unique = new Map<string, NormalizedElement>();
  for (const element of input) {
    const tag = token(element.tag);
    if (!tag || unshareableControl(element)) continue;
    const normalized = compact({
      tag: tag.toLowerCase(),
      role: token(element.role)?.toLowerCase(),
      name: oneLine(element.name),
      inputType: token(element.inputType)?.toLowerCase(),
      controlType: token(element.controlType)?.toLowerCase(),
      optionCount: Array.isArray(element.options) ? element.options.length : undefined,
      sameOriginLink: sameOriginHref(element.href, location.origin) ? true : undefined,
    }) as NormalizedElement;
    const key = canonicalJson(normalized);
    if (!unique.has(key)) unique.set(key, normalized);
  }
  return [...unique.values()];
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

/**
 * The fact and the dedup key are now the same object, which they were not
 * before: the key used to include a digest of the element's selector while the
 * fact dropped it, so two controls that read identically but sat at different
 * selectors produced two identical facts. Dropping the selector fixed the
 * duplication as well as the leak.
 */
function promptElementFact(element: NormalizedElement): WebReusableEvidencePromptFact {
  return { kind: "element", ...element };
}

/** Every fact, in order, with the digest and the byte count of what is stored. */
function promptProjection(fingerprint: WebReusableEvidenceFingerprint, facts: WebReusableEvidencePromptFact[]): WebReusableEvidencePromptProjection {
  const base = {
    schemaVersion: WEB_REUSABLE_EVIDENCE_PROJECTION_SCHEMA_VERSION,
    sanitizerVersion: WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION,
    compatibilityDigest: fingerprint.digest,
    location: fingerprint.location,
    facts,
  };
  const withDigest = { ...base, digest: digest(base) };
  return { ...withDigest, byteCount: stableByteCount(withDigest) };
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

/**
 * Control types that are not secrets by the shared rule but still must not
 * appear in a fingerprint that is cached and reused across runs. A hidden
 * input is a per-session token rather than a control -- carrying it makes the
 * structural digest change on every visit and puts the token's name in a
 * stored artefact -- and a file input's identity describes the operator's
 * filesystem, not the page.
 *
 * This is deliberately a separate question from sensitivity, and separately
 * named, because collapsing the two would have widened the shared rule: making
 * `hidden` and `file` sensitive everywhere would start withholding values the
 * recorder is supposed to capture.
 */
const NON_REUSABLE_CONTROL_TYPES = new Set(["hidden", "file"]);

/**
 * Whether the fingerprint must not describe this control: a secret by the one
 * shared rule, or one of the two types above.
 *
 * A packet element carries no `autocomplete` and no `data-sensitive`, so only
 * the type half of the shared rule can be asked here. The other half is
 * already enforced upstream by the same rule, in
 * `llm-evidence/elements.ts`, which refuses to describe such a control at all
 * -- so nothing reaching this function can carry one. This is the second
 * fence, not the first.
 */
function unshareableControl(element: WebLlmEvidenceElement): boolean {
  const types = [element.inputType, element.controlType].filter((value): value is string => typeof value === "string").map(value => value.trim().toLowerCase());
  if (types.some(value => NON_REUSABLE_CONTROL_TYPES.has(value))) return true;
  return isSensitiveFieldSignature({ inputType: element.inputType, controlType: element.controlType });
}

/** An identifier this domain or Core minted -- an action's definition id, a schema version -- never page text. */
function boundedTag(input: unknown, label: string): string {
  const value = oneLine(input);
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u.test(value)) throw new Error(`${label} is malformed`);
  return value;
}

/** A tag, role or type: one word of the page's markup vocabulary, or nothing. */
function token(input: unknown): string | undefined {
  const value = oneLine(input);
  return value && /^[A-Za-z0-9_.:-]+$/u.test(value) ? value : undefined;
}

function oneLine(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const value = input.replace(/\s+/gu, " ").trim();
  return value || undefined;
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

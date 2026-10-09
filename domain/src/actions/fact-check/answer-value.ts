// A fact check's result as it may cross the wire: rebuilt field by field from
// whatever was sent, so a producer that put page text, a value or an unknown
// key beside the declared fields sends none of it. Both ends read through
// this: the extension before the result leaves the browser
// (`client/fact-check-mapping.ts`), and the domain evaluator before it answers
// Core (`runtime/facts/evaluate.ts`).
//
// An answer this cannot read becomes `unknown` with the reason
// `capture_failed` rather than being dropped, so the answers stay aligned with
// the queries by index; a result that is not one at all is `undefined`.

import type { WebAutomationLayerKind } from "../../page-evidence";
import {
  WEB_AUTOMATION_FACT_EXCERPT_MAX,
  type WebAutomationFactAnswer,
  type WebAutomationFactCheckResult,
  type WebAutomationFactDocument,
  type WebAutomationFactElement,
  type WebAutomationFactEvidence,
  type WebAutomationFactUnknownReason
} from "./answer";

const VERDICTS = new Set(["true", "false", "unknown"]);
const REASONS: ReadonlySet<string> = new Set<WebAutomationFactUnknownReason>([
  "unreadable_frame", "capture_failed", "stale_document", "loading", "ambiguous", "sensitive", "no_state", "unclassified_dialog", "unbound", "unsupported"
]);
const LAYER_KINDS: ReadonlySet<string> = new Set<WebAutomationLayerKind>(["consent", "rate_limit", "robot_check", "promotion", "assistant"]);
const READY_STATES = new Set(["loading", "interactive", "complete"]);
/** An element's identifying strings are names, not prose. */
const NAME_MAX = 120;
/** A selector may be long, but not unbounded. */
const SELECTOR_MAX = 512;

/** The result, rebuilt; `undefined` when the value carries no answer list. */
export function webAutomationFactCheckResultValue(value: unknown, fallbackCapturedAt: number = Date.now()): WebAutomationFactCheckResult | undefined {
  const record = objectValue(value);
  if (!record || !Array.isArray(record.answers)) return undefined;
  const answers = record.answers.map((answer) => webAutomationFactAnswerValue(answer, fallbackCapturedAt));
  const document = documentValue(record.document);
  return document === undefined ? { answers } : { answers, document };
}

/** One answer, rebuilt; an unreadable one is `unknown` because reading it failed. */
export function webAutomationFactAnswerValue(value: unknown, fallbackCapturedAt: number): WebAutomationFactAnswer {
  const record = objectValue(value);
  const capturedAt = finiteNumber(record?.capturedAt) ?? fallbackCapturedAt;
  if (!record || typeof record.result !== "string" || !VERDICTS.has(record.result)) {
    return { result: "unknown", evidence: { reason: "capture_failed" }, capturedAt };
  }
  const evidence = evidenceValue(record.evidence);
  return {
    result: record.result as WebAutomationFactAnswer["result"],
    ...(evidence === undefined ? {} : { evidence }),
    capturedAt
  };
}

function evidenceValue(value: unknown): WebAutomationFactEvidence | undefined {
  const record = objectValue(value);
  if (!record) return undefined;
  const evidence: WebAutomationFactEvidence = {};
  const element = elementValue(record.element);
  if (element) evidence.element = element;
  const excerpt = bounded(record.excerpt, WEB_AUTOMATION_FACT_EXCERPT_MAX);
  if (excerpt !== undefined) evidence.excerpt = excerpt;
  const count = finiteNumber(record.count);
  if (count !== undefined && Number.isSafeInteger(count) && count >= 0) evidence.count = count;
  if (typeof record.dialogKind === "string" && LAYER_KINDS.has(record.dialogKind)) evidence.dialogKind = record.dialogKind as WebAutomationLayerKind;
  if (typeof record.reason === "string" && REASONS.has(record.reason)) evidence.reason = record.reason as WebAutomationFactUnknownReason;
  return Object.keys(evidence).length ? evidence : undefined;
}

function elementValue(value: unknown): WebAutomationFactElement | undefined {
  const record = objectValue(value);
  const tagName = bounded(record?.tagName, 64);
  if (!record || tagName === undefined) return undefined;
  const element: WebAutomationFactElement = { tagName };
  for (const key of ["role", "id", "testId", "name", "accessibleName"] as const) {
    const text = bounded(record[key], NAME_MAX);
    if (text !== undefined) element[key] = text;
  }
  const selector = bounded(record.selector, SELECTOR_MAX);
  if (selector !== undefined) element.selector = selector;
  return element;
}

function documentValue(value: unknown): WebAutomationFactDocument | undefined {
  const record = objectValue(value);
  if (!record) return undefined;
  const document: WebAutomationFactDocument = {};
  if (typeof record.url === "string") document.url = record.url;
  const timeOrigin = finiteNumber(record.timeOrigin);
  if (timeOrigin !== undefined) document.timeOrigin = timeOrigin;
  if (typeof record.readyState === "string" && READY_STATES.has(record.readyState)) document.readyState = record.readyState as WebAutomationFactDocument["readyState"];
  return Object.keys(document).length ? document : undefined;
}

/** A non-empty string cut to `max` characters, whitespace collapsed. */
function bounded(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const collapsed = value.replace(/\s+/gu, " ").trim();
  if (!collapsed) return undefined;
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

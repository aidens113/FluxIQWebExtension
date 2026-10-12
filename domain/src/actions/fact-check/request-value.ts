// A fact check's request as the page reads it off the wire. Each query is
// rebuilt field by field and checked against its kind; one that cannot be read
// stays in its slot as `undefined`, so the page answers it `unknown`
// (`unsupported`) and every answer still lines up with the claim it answers.

import type { WebAutomationElementFingerprint } from "../types";
import type { WebAutomationLayerKind } from "../../page-evidence";
import type {
  WebAutomationFactComparison,
  WebAutomationFactCountComparison,
  WebAutomationFactQuery,
  WebAutomationFactTarget
} from "./request";

/** The request with every unreadable query left as `undefined` in its slot. */
export type WebAutomationFactCheckReading = {
  queries: Array<WebAutomationFactQuery | undefined>;
  documentTimeOrigin?: number | undefined;
};

const STATE_KINDS = new Set(["exists", "visible", "enabled", "checked", "selected"]);
const COMPARISONS = new Set<WebAutomationFactComparison>(["equals", "contains", "matches"]);
const COUNT_COMPARISONS = new Set<WebAutomationFactCountComparison>(["=", "!=", ">", ">=", "<", "<="]);
const LAYER_KINDS = new Set<WebAutomationLayerKind>(["consent", "rate_limit", "robot_check", "promotion", "assistant"]);

/** The request a gateway command's parameters carry, or `undefined` when they carry no query list. */
export function webAutomationFactCheckRequestValue(value: unknown): WebAutomationFactCheckReading | undefined {
  const record = objectValue(value);
  if (!record || !Array.isArray(record.queries)) return undefined;
  const reading: WebAutomationFactCheckReading = { queries: record.queries.map(webAutomationFactQueryValue) };
  if (typeof record.documentTimeOrigin === "number" && Number.isFinite(record.documentTimeOrigin)) reading.documentTimeOrigin = record.documentTimeOrigin;
  return reading;
}

/** One query, rebuilt, or `undefined` when it is not a claim the page can be asked. */
export function webAutomationFactQueryValue(value: unknown): WebAutomationFactQuery | undefined {
  const claim = claimValue(value);
  if (!claim) return undefined;
  const frameId = objectValue(value)?.frameId;
  return typeof frameId === "number" && Number.isSafeInteger(frameId) && frameId >= 0 ? { ...claim, frameId } : claim;
}

function claimValue(value: unknown): WebAutomationFactQuery | undefined {
  const record = objectValue(value);
  const kind = record?.kind;
  if (!record || typeof kind !== "string") return undefined;
  if (STATE_KINDS.has(kind)) {
    const target = targetValue(record.target);
    if (!target || typeof record.expected !== "boolean") return undefined;
    return { kind: kind as "exists", target, expected: record.expected };
  }
  if (kind === "url" || kind === "text" || kind === "value") {
    const comparison = record.comparison;
    if (typeof comparison !== "string" || !COMPARISONS.has(comparison as WebAutomationFactComparison)) return undefined;
    if (typeof record.expected !== "string" || !record.expected.trim()) return undefined;
    const compared = { comparison: comparison as WebAutomationFactComparison, expected: record.expected };
    if (kind === "url") return { kind, ...compared };
    const target = targetValue(record.target);
    if (kind === "value") return target ? { kind, target, ...compared } : undefined;
    return target ? { kind, target, ...compared } : { kind, ...compared };
  }
  if (kind === "count") {
    const target = targetValue(record.target);
    const comparison = record.comparison;
    if (!target?.selector || typeof comparison !== "string" || !COUNT_COMPARISONS.has(comparison as WebAutomationFactCountComparison)) return undefined;
    if (typeof record.expected !== "number" || !Number.isSafeInteger(record.expected) || record.expected < 0) return undefined;
    return { kind, target: { ...target, selector: target.selector }, comparison: comparison as WebAutomationFactCountComparison, expected: record.expected };
  }
  if (kind === "dialog") {
    if (typeof record.expected !== "boolean") return undefined;
    const dialogKind = typeof record.dialogKind === "string" && LAYER_KINDS.has(record.dialogKind as WebAutomationLayerKind) ? record.dialogKind as WebAutomationLayerKind : undefined;
    if (record.dialogKind !== undefined && dialogKind === undefined) return undefined;
    const nameContains = typeof record.nameContains === "string" && record.nameContains.trim() ? record.nameContains : undefined;
    return { kind, expected: record.expected, ...(dialogKind ? { dialogKind } : {}), ...(nameContains ? { nameContains } : {}) };
  }
  return undefined;
}

/** A target naming at least a selector or an element description; anything else names nothing to ask. */
function targetValue(value: unknown): WebAutomationFactTarget | undefined {
  const record = objectValue(value);
  if (!record) return undefined;
  const selector = typeof record.selector === "string" && record.selector.trim() ? record.selector : undefined;
  const element = objectValue(record.element);
  const described = element && Object.keys(element).length ? element as WebAutomationElementFingerprint : undefined;
  if (!selector && !described) return undefined;
  const hosts = Array.isArray(record.shadowHosts) ? record.shadowHosts.filter((host): host is string => typeof host === "string" && host.length > 0) : [];
  return {
    ...(selector ? { selector } : {}),
    ...(described ? { element: described } : {}),
    ...(hosts.length ? { shadowHosts: hosts } : {})
  };
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

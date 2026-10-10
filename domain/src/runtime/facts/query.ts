// Turning a Core fact condition into the claim the page is asked.
//
// This is where every binding is resolved and every shape is checked, so the
// page receives only literals and only claims it can answer. A condition this
// cannot turn into a claim is answered `unknown` here and never sent: the
// reason is `unbound` when it compares with a Flow input or value Core did not
// supply, and `unsupported` when the shape names no claim -- an unknown fact,
// an operator the fact does not take, a state claim naming no element, a
// regular expression that does not compile. A claim nobody could ask is not a
// claim that failed.
//
// The grammar, by `fact`:
//
//   exists | absent | visible | enabled | checked | selected   (target required)
//     op = the fact's own word (for the four C9 names), or `equals` with an
//     optional boolean value (default true); `absent` is `exists` negated, and
//     `exists` with op `absent` asks the same.
//   text (target optional: the page's text) | url | value (target required)
//     op = equals | contains | matches, value = the string compared with.
//   count (target with a selector required)
//     op = equals with a number, or count with "<cmp> <n>" (`>= 3`, `= 0`).
//   dialog | dialog.<consent|rate_limit|robot_check|promotion|assistant>
//     op = exists | visible | absent, value = optional text the dialog's name
//     contains (or, without a value, the name of a `{ kind: "dialog", name }`
//     target, the form Core's candidate script saves); or contains, value =
//     that text, asking that such a dialog is open.

import type { JsonObject, JsonValue } from "fluxiq/core";
import type {
  WebAutomationFactComparison,
  WebAutomationFactCountComparison,
  WebAutomationFactQuery,
  WebAutomationFactTarget,
  WebAutomationFactUnknownReason
} from "../../actions/fact-check";
import type { WebAutomationLayerKind } from "../../page-evidence";
import { elementFingerprint } from "../../output-nodes";
import type { WebAutomationFactCondition, WebAutomationFactEvaluationContext, WebAutomationFactOp } from "./condition";

/** The claim to ask, or why none can be asked. */
export type WebAutomationFactQueryReading = { query: WebAutomationFactQuery } | { unknown: WebAutomationFactUnknownReason };

const STATE_FACTS = new Set(["exists", "absent", "visible", "enabled", "checked", "selected"]);
const COMPARISONS = new Set<string>(["equals", "contains", "matches"]);
const COUNT_PATTERN = /^\s*(=|==|!=|>=|<=|>|<)\s*(\d{1,9})\s*$/u;
const LAYER_KINDS = new Set<string>(["consent", "rate_limit", "robot_check", "promotion", "assistant"]);
const OPS = new Set<string>(["exists", "absent", "visible", "enabled", "equals", "contains", "matches", "count"]);

/** The claim a raw condition names, with its bindings resolved from `context`. */
export function webAutomationFactQuery(entry: unknown, context: WebAutomationFactEvaluationContext = {}): WebAutomationFactQueryReading {
  const condition = conditionValue(entry);
  if (!condition) return { unknown: "unsupported" };
  const value = boundValue(condition.value, context);
  if (value === UNBOUND) return { unknown: "unbound" };
  const frameId = frameOf(condition.target);
  const query = claimFor(condition, value);
  if (!query) return { unknown: "unsupported" };
  return { query: frameId === undefined ? query : { ...query, frameId } };
}

const UNBOUND = Symbol("unbound");
type Literal = string | number | boolean | undefined;

function claimFor(condition: WebAutomationFactCondition, value: Literal): WebAutomationFactQuery | undefined {
  const [word, sub] = splitFact(condition.fact);
  const op = condition.op;
  if (STATE_FACTS.has(word) && sub === undefined) {
    const target = targetValue(condition.target);
    const expected = statePolarity(word, op, value);
    if (!target || expected === undefined) return undefined;
    const kind = word === "absent" ? "exists" : word as "exists" | "visible" | "enabled" | "checked" | "selected";
    return { kind, target, expected };
  }
  if ((word === "text" || word === "url" || word === "value") && sub === undefined) {
    if (!COMPARISONS.has(op) || value === undefined || typeof value === "boolean") return undefined;
    const expected = String(value);
    if (!expected.trim() || (op === "matches" && !compiles(expected))) return undefined;
    const comparison = op as WebAutomationFactComparison;
    if (word === "url") return { kind: "url", comparison, expected };
    const target = targetValue(condition.target);
    if (word === "value") return target ? { kind: "value", target, comparison, expected } : undefined;
    return target ? { kind: "text", target, comparison, expected } : { kind: "text", comparison, expected };
  }
  if (word === "count" && sub === undefined) {
    const target = targetValue(condition.target);
    const counted = countComparison(op, value);
    if (!target?.selector || !counted) return undefined;
    return { kind: "count", target: { ...target, selector: target.selector }, ...counted };
  }
  if (word === "dialog") {
    if (sub !== undefined && !LAYER_KINDS.has(sub)) return undefined;
    const dialogKind = sub as WebAutomationLayerKind | undefined;
    // Core's candidate script saves a dialog fact as `op: visible | absent`
    // with the name in a `{ kind: "dialog", role, name }` target; the role
    // cannot narrow a layer kind, so it reads as any dialog.
    const named = value === undefined ? dialogTargetName(condition.target) : value;
    const name = typeof named === "string" && named.trim() ? named : undefined;
    if (named !== undefined && name === undefined) return undefined;
    const expected = op === "exists" || op === "visible" || op === "contains" ? true : op === "absent" ? false : undefined;
    if (expected === undefined || (op === "contains" && !name)) return undefined;
    return { kind: "dialog", expected, ...(dialogKind ? { dialogKind } : {}), ...(name ? { nameContains: name } : {}) };
  }
  return undefined;
}

/** `true` when the claim is that the element is in the fact's state, `false` when it is not; `undefined` for an op the fact does not take. */
function statePolarity(word: string, op: WebAutomationFactOp, value: Literal): boolean | undefined {
  const negated = word === "absent";
  if (op === "equals") {
    if (value !== undefined && typeof value !== "boolean") return undefined;
    return (value ?? true) !== negated;
  }
  if (value !== undefined) return undefined;
  if (op === word) return !negated;
  // `exists` asked with op `absent`, or `absent` with op `exists`: the other polarity of the same claim.
  if ((word === "exists" && op === "absent") || (word === "absent" && op === "exists")) return negated;
  return undefined;
}

function countComparison(op: WebAutomationFactOp, value: Literal): { comparison: WebAutomationFactCountComparison; expected: number } | undefined {
  if (op === "equals") return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? { comparison: "=", expected: value } : undefined;
  if (op !== "count") return undefined;
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? { comparison: "=", expected: value } : undefined;
  const match = typeof value === "string" ? COUNT_PATTERN.exec(value) : null;
  if (!match) return undefined;
  const comparison = (match[1] === "==" ? "=" : match[1]) as WebAutomationFactCountComparison;
  return { comparison, expected: Number(match[2]) };
}

/** The literal a value names: itself, or what Core bound the input or value to. */
function boundValue(value: WebAutomationFactCondition["value"], context: WebAutomationFactEvaluationContext): Literal | typeof UNBOUND {
  if (value === undefined || typeof value !== "object") return value;
  const bound = "input" in value ? context.inputs?.[value.input] : context.values?.[value.value];
  if (typeof bound === "string" || typeof bound === "boolean") return bound;
  if (typeof bound === "number" && Number.isFinite(bound)) return bound;
  return UNBOUND;
}

/**
 * The durable target as the page resolves one: a selector re-queried, or an
 * element description put through the same normaliser that put it on the
 * wire for an action (`output-nodes`), plus the shadow host chain it records.
 */
function targetValue(value: JsonObject | undefined): WebAutomationFactTarget | undefined {
  if (!value) return undefined;
  // Core's candidate script writes a hand-authored literal target as an opaque
  // `locator` the host interprets; this host reads it as a CSS selector.
  const selector = nonEmpty(value.selector) ?? nonEmpty(value.locator);
  const described = elementFingerprint(value.element ?? value.fingerprint);
  const element = described && Object.keys(described).length ? described : undefined;
  if (!selector && !element) return undefined;
  const hosts = shadowHosts(value.shadowHosts) ?? shadowHosts(jsonObject(element?.context)?.shadowHosts);
  return {
    ...(selector ? { selector } : {}),
    ...(element ? { element } : {}),
    ...(hosts ? { shadowHosts: hosts } : {})
  };
}

function frameOf(target: JsonObject | undefined): number | undefined {
  const frame = target?.frameId ?? target?.browserFrameId;
  return typeof frame === "number" && Number.isSafeInteger(frame) && frame >= 0 ? frame : undefined;
}

function conditionValue(entry: unknown): WebAutomationFactCondition | undefined {
  const record = jsonObject(entry);
  if (!record || typeof record.fact !== "string" || typeof record.op !== "string" || !OPS.has(record.op)) return undefined;
  const value = record.value;
  const readable = value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    || (jsonObject(value) !== undefined && (typeof jsonObject(value)?.input === "string" || typeof jsonObject(value)?.value === "string"));
  if (!readable) return undefined;
  const target = record.target === undefined ? undefined : jsonObject(record.target);
  if (record.target !== undefined && !target) return undefined;
  return {
    fact: record.fact.trim(),
    op: record.op as WebAutomationFactOp,
    ...(value === undefined ? {} : { value: value as WebAutomationFactCondition["value"] }),
    ...(target ? { target } : {})
  };
}

/** The name a saved `{ kind: "dialog", name }` target carries, if any. */
function dialogTargetName(target: JsonObject | undefined): string | undefined {
  return target?.kind === "dialog" && typeof target.name === "string" ? target.name : undefined;
}

function splitFact(fact: string): [string, string | undefined] {
  const dot = fact.indexOf(".");
  return dot < 0 ? [fact, undefined] : [fact.slice(0, dot), fact.slice(dot + 1)];
}

function compiles(pattern: string): boolean {
  try {
    new RegExp(pattern, "u");
    return true;
  } catch (error) {
    if (error instanceof SyntaxError) return false;
    throw error;
  }
}

function shadowHosts(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const hosts = value.filter((host): host is string => typeof host === "string" && host.length > 0);
  return hosts.length ? hosts : undefined;
}

function nonEmpty(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function jsonObject(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : undefined;
}

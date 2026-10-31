// Finding a control again among a fresh look's controls (t786, D4), by the
// identity signals a saved control is held to (`element-fingerprint/signals.ts`)
// and never by its address: a re-render renumbers handles and rewrites
// positional selectors, which is exactly how the old target went stale.
//
// A candidate is the control when **every signal both carry agrees and at
// least two agree** -- the floor a control is saved with
// (`WEB_ELEMENT_IDENTITY_MINIMUM_SIGNALS`). A signal only one side carries says
// nothing either way. Compared, each exactly, spacing and case aside:
//
// - **kind**: each of the tag, role, implied role and input type both say;
// - **words**: each of the visible text, text, accessible name and label both
//   say, every distinct wording one agreeing signal -- skipped when either side
//   reads its words as its value (`readsWords`), since an earlier step may have
//   changed them;
// - **id**, **testId**, **name**, and the **drawing** digest;
// - **classNames**, as a set.
//
// Never the selector, the xpath, the list or table position, or a handle
// number. A saved record, dialog and shadow root gate every match before
// uniqueness is considered. Record keys outrank record words; missing or
// changed record evidence cannot prove gone or authorize a different row.
//
// A candidate is a fingerprint, or an object carrying one under `element` (a
// resolved step's parameters, a look-up's answer).

import type { AutomationStudioTargetReacquireAnswer } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebAutomationElementContext, WebAutomationElementFingerprint } from "../../actions/types";
import { WEB_ELEMENT_IDENTITY_MINIMUM_SIGNALS, webElementIdentitySignals, webRecordedRecordMatches, type WebElementIdentitySignal } from "../../element-fingerprint";
import { webReacquireText } from "./text";

const STRING_FIELDS = ["tagName", "role", "implicitRole", "inputType", "visibleText", "text", "accessibleName", "label", "id", "testId", "name", "drawing", "selector"] as const;
const KIND_FIELDS = ["tagName", "role", "implicitRole", "inputType"] as const;
const WORD_FIELDS = ["visibleText", "text", "accessibleName", "label"] as const;

type Read = { fingerprint: WebAutomationElementFingerprint; readsWords: boolean; record: WebAutomationElementContext["record"]; dialog: string | undefined; shadowHosts: readonly string[] };

/** The one candidate that is the stale control, or why there is none (header). */
export function webReacquireElement(input: { stale: JsonValue; candidates: readonly JsonValue[] }): AutomationStudioTargetReacquireAnswer {
  const stale = readElement(input.stale);
  if (!stale || usableSignals(stale).length < WEB_ELEMENT_IDENTITY_MINIMUM_SIGNALS) return { outcome: "unmatched", reason: "unidentifiable" };
  const matches = input.candidates.flatMap((candidate) => {
    const read = readElement(candidate);
    return read && agrees(stale, read) ? [{ candidate, read }] : [];
  });
  if (matches.length === 0 && stale.record === undefined && stale.dialog === undefined && stale.shadowHosts.length === 0) return { outcome: "gone" };
  const eligible = matches.filter(({ read }) => webRecordedRecordMatches(stale.record, read.record)
    && stale.dialog === read.dialog && sameHosts(stale.shadowHosts, read.shadowHosts));
  return eligible.length === 1 ? { outcome: "found", value: eligible[0]!.candidate } : { outcome: "unmatched", reason: "ambiguous" };
}

/** Recompute the save-time floor after ignored words are removed, including its lone-class rule. */
function usableSignals(target: Read): WebElementIdentitySignal[] {
  if (!target.readsWords) return webElementIdentitySignals(target.fingerprint);
  const fingerprint = { ...target.fingerprint };
  for (const field of WORD_FIELDS) delete fingerprint[field];
  return webElementIdentitySignals(fingerprint);
}

/** Whether every signal both carry agrees and at least two do (header). */
function agrees(stale: Read, candidate: Read): boolean {
  const carried = new Set(webElementIdentitySignals(candidate.fingerprint));
  const shared = [...new Set(webElementIdentitySignals(stale.fingerprint))].filter((signal) => carried.has(signal));
  let agreeing = 0;
  for (const signal of shared) {
    const said = compare(signal, stale, candidate);
    if (said === "differs") return false;
    agreeing += said;
  }
  return agreeing >= WEB_ELEMENT_IDENTITY_MINIMUM_SIGNALS;
}

/** How many agreeing signals one shared signal is, or `differs`. */
function compare(signal: WebElementIdentitySignal, stale: Read, candidate: Read): number | "differs" {
  const a = stale.fingerprint;
  const b = candidate.fingerprint;
  if (signal === "kind") return fields(KIND_FIELDS, a, b);
  if (signal === "words") return stale.readsWords || candidate.readsWords ? 0 : wordsAgree(a, b);
  if (signal === "classNames") return sameSet(a.classNames ?? [], b.classNames ?? []) ? 1 : "differs";
  if (signal === "drawing") return a.drawing === b.drawing ? 1 : "differs";
  return same(a[signal], b[signal]) ? 1 : "differs";
}

/** Each field both say, compared: `1` when at least one is shared and none differs. */
function fields(names: readonly (typeof STRING_FIELDS)[number][], a: WebAutomationElementFingerprint, b: WebAutomationElementFingerprint): number | "differs" {
  const shared = names.filter((name) => said(a[name]) && said(b[name]));
  if (shared.some((name) => !same(a[name], b[name]))) return "differs";
  return shared.length > 0 ? 1 : 0;
}

/** Each wording field both say must agree; with none shared, the two sets of wordings must be the same set. */
function wordsAgree(a: WebAutomationElementFingerprint, b: WebAutomationElementFingerprint): number | "differs" {
  const shared = WORD_FIELDS.filter((name) => said(a[name]) && said(b[name]));
  if (shared.some((name) => !same(a[name], b[name]))) return "differs";
  if (shared.length > 0) return new Set(shared.map((name) => webReacquireText(a[name]!))).size;
  const wordingsA = wordings(a);
  return sameSet(wordingsA, wordings(b)) ? new Set(wordingsA.map(webReacquireText)).size : "differs";
}

function wordings(fingerprint: WebAutomationElementFingerprint): string[] {
  return WORD_FIELDS.map((name) => fingerprint[name]).filter(said);
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a.filter(said).map(webReacquireText));
  const right = new Set(b.filter(said).map(webReacquireText));
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function same(a: string | undefined, b: string | undefined): boolean {
  return said(a) && said(b) && webReacquireText(a) === webReacquireText(b);
}

/** A candidate's fingerprint, whether it is one or carries one under `element`; nothing for a value that names no control. */
function readElement(value: JsonValue | undefined): Read | undefined {
  if (!record(value)) return undefined;
  const source = record(value.element) ? value.element : value;
  const fingerprint: Record<string, string | string[]> = {};
  for (const name of STRING_FIELDS) {
    const field = source[name];
    if (typeof field === "string" && field.trim() !== "") fingerprint[name] = field;
  }
  const classes = Array.isArray(source.classNames) ? source.classNames.filter((token): token is string => typeof token === "string" && token.trim() !== "") : [];
  if (classes.length > 0) fingerprint.classNames = classes;
  if (Object.keys(fingerprint).every((name) => name === "selector")) return undefined;
  if (source.context !== undefined && !record(source.context)) return undefined;
  const context = record(source.context) ? source.context : undefined;
  if (context?.dialog !== undefined && (typeof context.dialog !== "string" || context.dialog.trim() === "")) return undefined;
  if (context?.shadowHosts !== undefined && (!Array.isArray(context.shadowHosts)
    || context.shadowHosts.some((host) => typeof host !== "string" || host.trim() === ""))) return undefined;
  return {
    fingerprint: fingerprint as WebAutomationElementFingerprint,
    readsWords: source.readsWords === true,
    record: recordIdentity(context?.record),
    dialog: typeof context?.dialog === "string" && context.dialog.trim() !== "" ? context.dialog : undefined,
    shadowHosts: Array.isArray(context?.shadowHosts) ? context.shadowHosts.filter((host): host is string => typeof host === "string" && host !== "") : []
  };
}

/** Keep structured record evidence; an empty/malformed declared record fails closed. */
function recordIdentity(value: JsonValue | undefined): WebAutomationElementContext["record"] {
  if (value === undefined) return undefined;
  if (!record(value)) return {};
  return {
    key: typeof value.key === "string" ? value.key : undefined,
    keyAttribute: typeof value.keyAttribute === "string" ? value.keyAttribute : undefined,
    text: typeof value.text === "string" ? value.text : undefined,
    values: Array.isArray(value.values) ? value.values.filter((item): item is string => typeof item === "string") : undefined
  };
}

function sameHosts(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((host, index) => host === right[index]);
}

function said(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function record(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

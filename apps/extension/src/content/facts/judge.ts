// One claim judged against the page as it stands: `true`, `false` or
// `unknown`, with the evidence it rests on (plan B1).
//
// The rules, per kind (`expected` is the claim's polarity):
//
//   exists    found, or several equally good candidates: the claim is that
//             something is there. Nothing found: it is not.
//   visible   found: whether it is shown, by the assertion's own rule. Nothing
//             found: not visible -- so "not visible" holds for a thing gone.
//   enabled, checked, selected
//             found: its state. A state the element does not show (`no_state`)
//             or may not be read (`sensitive`) is unknown. Nothing found: the
//             claim, either way, is about an element that is not there: false.
//   text      the element's shown text, or the page's with no target.
//   value     a field's value, or a choice's chosen label. Sensitive: unknown.
//   url       the document's address.
//   count     how many elements the selector matches.
//   dialog    the open dialogs whose name contains `nameContains`, and of
//             `dialogKind` when one is named. A dialog no classifier named, or
//             one with no name when a name is asked for, may be the one asked
//             about, so where it decides the answer the answer is unknown.
//
// Then one rule over all of them: **`false` needs a fully read document.**
// While the document is still being parsed an absence proves nothing -- the
// element, the text or the dialog may be in the part not read yet -- so a
// `false` there becomes `unknown` (`loading`). The address is the exception:
// it is known before the first byte of the body is.
//
// Ambiguity is the resolver's (`../action-runtime/resolve-target.ts`): a
// fingerprint matched by several elements equally answers "something is there"
// but not "which one", so only `exists` is judged on it.

import type {
  WebAutomationFactAnswer,
  WebAutomationFactComparison,
  WebAutomationFactCountComparison,
  WebAutomationFactEvidence,
  WebAutomationFactQuery,
  WebAutomationFactUnknownReason
} from "@fluxiq-web-extension/domain/client";
import { WEB_AUTOMATION_FACT_EXCERPT_MAX } from "@fluxiq-web-extension/domain/client";
import type { FactElement, FactPage, FactReading } from "./fact-page";

/** How much text a `matches` claim is run over, so a pattern cannot be made to scan a page without end. */
const MATCHED_TEXT_MAX = 100_000;

/** The claim's answer, judged now. Throws only when the page itself threw while being read. */
export function judgeFact(query: WebAutomationFactQuery, page: FactPage, capturedAt: number, readyState: "loading" | "interactive" | "complete"): WebAutomationFactAnswer {
  const judged = judgeClaim(query, page);
  if (judged.result === "false" && readyState === "loading" && query.kind !== "url") {
    return answer("unknown", capturedAt, { ...judged.evidence, reason: "loading" });
  }
  return answer(judged.result, capturedAt, judged.evidence);
}

type Judged = { result: WebAutomationFactAnswer["result"]; evidence?: WebAutomationFactEvidence | undefined };

function judgeClaim(query: WebAutomationFactQuery, page: FactPage): Judged {
  if (query.kind === "url") return compared(page.document().url, query.comparison, query.expected, false);
  if (query.kind === "count") {
    const count = page.count(query.target);
    return { result: verdict(countHolds(count, query.comparison, query.expected)), evidence: { count } };
  }
  if (query.kind === "dialog") return judgeDialog(query, page);
  // Only a text claim may name no element: it is then about the page's text.
  if (!query.target) return query.kind === "text" ? judgeReading(page.text(), query.comparison, query.expected, undefined) : unknownBecause("unsupported");

  const resolution = page.resolve(query.target);
  if (resolution.outcome === "ambiguous") {
    return query.kind === "exists" ? { result: verdict(query.expected) } : unknownBecause("ambiguous");
  }
  if (resolution.outcome === "not_found") {
    if (query.kind === "exists") return { result: verdict(!query.expected) };
    if (query.kind === "visible") return { result: verdict(!query.expected) };
    return { result: "false" };
  }
  const element = resolution.element;
  const described = { element: page.describe(element) };
  switch (query.kind) {
    case "exists":
      return { result: verdict(query.expected), evidence: described };
    case "visible":
      return { result: verdict(page.visible(element) === query.expected), evidence: described };
    case "enabled":
      return { result: verdict(page.enabled(element) === query.expected), evidence: described };
    case "checked": {
      const state = page.checked(element);
      if (state === "sensitive") return unknownBecause("sensitive", described);
      if (state === undefined) return unknownBecause("no_state", described);
      return { result: verdict(state === query.expected), evidence: described };
    }
    case "selected": {
      const state = page.selected(element);
      if (state === undefined) return unknownBecause("no_state", described);
      return { result: verdict(state === query.expected), evidence: described };
    }
    case "text":
      return judgeReading(page.text(element), query.comparison, query.expected, element, page);
    case "value": {
      const values = page.values(element);
      if ("withheld" in values) return unknownBecause(values.withheld, described);
      const held = values.read.find((value) => comparisonHolds(value, query.comparison, query.expected));
      const shown = held ?? values.read[0] ?? "";
      return { result: verdict(held !== undefined), evidence: { ...described, ...excerptOf(shown, query.expected) } };
    }
  }
}

function judgeReading(reading: FactReading, comparison: WebAutomationFactComparison, expected: string, element: FactElement | undefined, page?: FactPage): Judged {
  const described = element && page ? { element: page.describe(element) } : {};
  if ("withheld" in reading) return unknownBecause(reading.withheld, described);
  const judged = compared(reading.read, comparison, expected, true);
  return { result: judged.result, evidence: { ...described, ...judged.evidence } };
}

function judgeDialog(query: Extract<WebAutomationFactQuery, { kind: "dialog" }>, page: FactPage): Judged {
  const wanted = query.nameContains === undefined ? undefined : collapse(query.nameContains).toLowerCase();
  let matched = 0;
  let undecided = 0;
  let first: { kind?: WebAutomationFactEvidence["dialogKind"]; name?: string | undefined } | undefined;
  for (const dialog of page.dialogs()) {
    const name = dialog.name === undefined ? undefined : collapse(dialog.name);
    const nameFits = wanted === undefined ? true : name === undefined ? undefined : name.toLowerCase().includes(wanted);
    const kindFits = query.dialogKind === undefined ? true : dialog.kind === undefined ? undefined : dialog.kind === query.dialogKind;
    if (nameFits === false || kindFits === false) continue;
    if (nameFits === undefined || kindFits === undefined) {
      undecided += 1;
      continue;
    }
    matched += 1;
    first ??= { kind: dialog.kind, name };
  }
  const evidence: WebAutomationFactEvidence = {
    count: matched,
    ...(first?.kind ? { dialogKind: first.kind } : {}),
    ...(first?.name ? { excerpt: bounded(first.name) } : {})
  };
  if (matched > 0) return { result: verdict(query.expected), evidence };
  if (undecided > 0) return unknownBecause("unclassified_dialog", evidence);
  return { result: verdict(!query.expected), evidence };
}

function compared(actual: string, comparison: WebAutomationFactComparison, expected: string, quote: boolean): Judged {
  const text = collapse(actual);
  const holds = comparisonHolds(text, comparison, expected);
  return { result: verdict(holds), ...(quote ? { evidence: excerptOf(text, expected) } : {}) };
}

/**
 * Whitespace collapsed on both sides, as the assertion reads text, and case
 * kept: "equals" and "contains" mean what they say. A pattern is run over at
 * most `MATCHED_TEXT_MAX` characters.
 */
function comparisonHolds(actual: string, comparison: WebAutomationFactComparison, expected: string): boolean {
  const text = collapse(actual);
  if (comparison === "matches") return new RegExp(expected, "u").test(text.slice(0, MATCHED_TEXT_MAX));
  const wanted = collapse(expected);
  return comparison === "equals" ? text === wanted : text.includes(wanted);
}

function countHolds(count: number, comparison: WebAutomationFactCountComparison, expected: number): boolean {
  switch (comparison) {
    case "=": return count === expected;
    case "!=": return count !== expected;
    case ">": return count > expected;
    case ">=": return count >= expected;
    case "<": return count < expected;
    case "<=": return count <= expected;
  }
}

/** The part of the text the claim is about: around the expected words when they are there, its start otherwise. */
function excerptOf(text: string, expected: string): Pick<WebAutomationFactEvidence, "excerpt"> {
  const collapsed = collapse(text);
  if (!collapsed) return {};
  const at = collapsed.indexOf(collapse(expected));
  const start = at < 0 ? 0 : Math.max(0, at - Math.floor((WEB_AUTOMATION_FACT_EXCERPT_MAX - expected.length) / 2));
  return { excerpt: bounded(collapsed.slice(start)) };
}

function bounded(text: string): string {
  return text.length <= WEB_AUTOMATION_FACT_EXCERPT_MAX ? text : `${text.slice(0, WEB_AUTOMATION_FACT_EXCERPT_MAX - 1)}…`;
}

function collapse(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function verdict(holds: boolean): WebAutomationFactAnswer["result"] {
  return holds ? "true" : "false";
}

function unknownBecause(reason: WebAutomationFactUnknownReason, evidence: WebAutomationFactEvidence = {}): Judged {
  return { result: "unknown", evidence: { ...evidence, reason } };
}

function answer(result: WebAutomationFactAnswer["result"], capturedAt: number, evidence: WebAutomationFactEvidence | undefined): WebAutomationFactAnswer {
  return evidence && Object.keys(evidence).length ? { result, evidence, capturedAt } : { result, capturedAt };
}

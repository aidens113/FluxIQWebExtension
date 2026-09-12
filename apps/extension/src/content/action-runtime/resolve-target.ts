// Finds the element an action acts on, and says how sure it is.
//
// Level 1 is exact lookup: a CSS selector, a viewport point, the visual bounds
// the model saw, the recorded element fingerprint, and finally the focused
// element when the command named no target at all. Each of those is tried in
// turn and each now does two things it did not do before Phase 1.3. It gates
// its matches -- on being visible, on being enabled, and on agreeing with the
// recorded tag -- so a strategy that lands on a hidden or disabled twin of the
// real target falls through to the next one instead of resolving a dud. And it
// counts them, because "the first thing in document order" is a guess dressed
// as an answer: two Continue buttons is not a resolved target, it is an
// ambiguous one, and a Flow can only be told which it meant if the browser says
// so. A strategy that matched exactly one element still resolves it whether or
// not the gate liked it, so a deliberately hidden or disabled target -- what an
// assertion or an actionability refusal is about -- reaches the verb as before.
//
// A failure carries Core's structured record rather than only a sentence:
// TARGET_AMBIGUOUS naming the candidates that tied, TARGET_NOT_FOUND naming the
// strategies that were attempted. The codes come from the domain's closed set,
// never from a string written here, and `results.ts` lifts the record and the
// measurement off the thrown error onto the result the Flow receives. A
// resolution that *succeeded* carries the same measurement, but only as far as
// `resolveTargetWithDiagnostics`: the verbs take `resolveTarget`, whose
// contract is the element alone, so nothing puts `resolution` on a successful
// result yet.
//
// Level 2 is scoring, and it runs at the two points where an exact answer is
// not one: when a strategy matched several elements and the gate could not
// narrow them to one, and when every strategy missed. Both hand the candidates
// to Core's element matcher through `identity/score.ts` -- the same matcher
// Core would score them with itself, published for a browser since Wave 3 as
// `fluxiq/automation-studio/fingerprinting`. A candidate wins by clearing the
// floor and beating the runner-up by a margin; otherwise the tie is reported
// rather than broken by document order. The confidence on a scored resolution
// is Core's measurement of the candidate that won, never a constant, and it is
// absent from an exact resolution because nothing was measured there.
//
// Scoring cannot rescue every drift, and it is not meant to. A control whose
// text, id, class and test id have *all* changed scores below the floor against
// its own page, because at that point nothing distinguishes it from the next
// button along; the resolver refuses rather than clicking the least-wrong thing.
// The measured numbers are in reports/w3-matcher-packaging.md.

import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import { findClosestFingerprint, type ElementFingerprint } from "../element-finder";
import {
  candidateFingerprint,
  candidateLabel,
  collectTargetCandidates,
  scoreTargetCandidates,
  type CandidateSelection,
  type TargetCandidate
} from "../identity";
import type { BrowserActionCommand, BrowserActionTargetResolution, BrowserActionTargetStrategy, RectDescriptor } from "../types";

/** The element an action will act on, with the measurement that chose it. */
export type ResolvedTarget = {
  element: Element;
  resolution: BrowserActionTargetResolution;
};

/**
 * The recorded target as it arrives in `options.element`: the fingerprint
 * `element-finder.ts` looks elements up by, plus the identity signals
 * `describe-element.ts` records, which say what family a candidate must be in.
 */
type RecordedTarget = ElementFingerprint & {
  role?: string | undefined;
  implicitRole?: string | undefined;
  testId?: string | undefined;
  accessibleName?: string | undefined;
  label?: string | undefined;
};

/** One exact strategy's result: what it was asked for, and everything it matched. */
type StrategyAttempt = {
  strategy: BrowserActionTargetStrategy;
  /** How the miss reads in a failure message. Unchanged from before Phase 1.3. */
  description: string;
  matches: Element[];
};

/** Elements walked while matching a fingerprint's text. A resolution runs on every action's critical path. */
const MAX_TEXT_SCAN = 2_000;
/** Candidates named in an ambiguous failure. Core bounds a record's text, and a longer list helps nobody. */
const MAX_NAMED_CANDIDATES = 5;

/**
 * A target that could not be resolved, carrying Core's failure record and the
 * measurement that produced it.
 *
 * Both ride onto the result: `results.ts` reads `failure` and `resolution` off
 * a thrown value structurally, so a Flow receives TARGET_AMBIGUOUS or
 * TARGET_NOT_FOUND with the strategy that was tried rather than a sentence it
 * would have to parse. The record is built from the closed code set, so it
 * cannot contradict a Core consistency rule and be dropped by its parser.
 */
export class TargetResolutionError extends Error {
  readonly failure: AutomationStudioFailureRecord;
  readonly resolution: BrowserActionTargetResolution;

  constructor(message: string, failure: AutomationStudioFailureRecord, resolution: BrowserActionTargetResolution) {
    super(message);
    this.name = "TargetResolutionError";
    this.failure = failure;
    this.resolution = resolution;
  }
}

/** The element an action acts on. Throws `TargetResolutionError` when none can be chosen. */
export function resolveTarget(action: BrowserActionCommand): Element {
  return resolveTargetWithDiagnostics(action).element;
}

/**
 * The element an action acts on, with how it was found. Verbs take the element
 * alone through `resolveTarget`; a caller that reports a result wants the
 * measurement too, and passes it on as the result's `resolution`.
 */
export function resolveTargetWithDiagnostics(action: BrowserActionCommand): ResolvedTarget {
  const target = recordedTarget(action);
  const misses: string[] = [];

  for (const attempt of exactAttempts(action, target)) {
    if (!attempt.matches.length) {
      misses.push(attempt.description);
      continue;
    }
    const pool = gatedPool(attempt.matches, target);
    const only = pool.length === 1 ? pool[0] : undefined;
    if (only) return { element: only, resolution: { strategy: attempt.strategy, candidateCount: attempt.matches.length } };
    // Several survived the gate. Scoring is the difference between "these two
    // tied" and "these two tied, and one of them is the recorded control".
    const decided = target ? scoreTargetCandidates(target, describePool(pool)) : undefined;
    if (decided?.outcome === "resolved") return scoredTarget(decided, pool.length);
    throw ambiguous(attempt, pool, decided);
  }

  if (!misses.length) {
    const active = document.activeElement;
    if (active) return { element: active, resolution: { strategy: "active-element", candidateCount: 1 } };
    throw notFound("No selector, coordinates, or active element was available.", [], 0);
  }

  // Nothing answered exactly. The page may still hold the control under a new
  // name, so the same-family candidates are enumerated once and scored: the
  // enumeration is what a not-found failure reports either way.
  const nearby = target ? collectTargetCandidates(candidateFamily(target)) : [];
  const decided = target ? scoreTargetCandidates(target, nearby) : undefined;
  if (decided?.outcome === "resolved") return scoredTarget(decided, nearby.length);
  if (decided?.outcome === "ambiguous") throw scoredAmbiguous(decided, misses);
  throw notFound(`No target resolved from ${misses.join(", ")}.`, misses, nearby.length);
}

/** A scored win, with Core's own measurement of it. */
function scoredTarget(decided: Extract<CandidateSelection, { outcome: "resolved" }>, candidateCount: number): ResolvedTarget {
  return {
    element: decided.chosen.element,
    resolution: {
      strategy: "scored-candidate",
      candidateCount,
      bestScore: decided.chosen.score.normalizedScore,
      ...(decided.runnerUp ? { runnerUpScore: decided.runnerUp.score.normalizedScore } : {}),
      confidence: decided.chosen.score.confidence
    }
  };
}

/** The elements a strategy tied between, described the way the matcher reads a candidate. */
function describePool(pool: Element[]): TargetCandidate[] {
  return pool.map((element, index) => ({ element, fingerprint: candidateFingerprint(element, index) }));
}

/**
 * The family a recorded target's neighbours must share, taking the implied role
 * when the markup declares none. The descriptor writes an empty string for an
 * absent role rather than leaving the field out, so the fallback has to be `||`
 * and not `??`.
 */
function candidateFamily(target: RecordedTarget): { tagName?: string | undefined; role?: string | undefined } {
  const role = target.role?.trim() || target.implicitRole?.trim();
  return { ...(target.tagName ? { tagName: target.tagName } : {}), ...(role ? { role } : {}) };
}

/**
 * The exact strategies, in the order they are tried, each evaluated only when
 * the ones before it missed. The order is the one this module shipped with, so
 * a selector still wins over a point and a failure still names its misses in
 * the same sequence.
 */
function* exactAttempts(action: BrowserActionCommand, target: RecordedTarget | undefined): Generator<StrategyAttempt> {
  if (action.selector) {
    yield { strategy: "selector", description: `selector ${action.selector}`, matches: querySelectorAll(action.selector) };
  }
  if (action.coordinates) {
    yield {
      strategy: "coordinates",
      description: `coordinates ${action.coordinates.x},${action.coordinates.y}`,
      matches: elementsAtPoint(action.coordinates)
    };
  }
  const visualPoint = pointFromVisualTarget(action.visualTarget);
  if (visualPoint) {
    yield {
      strategy: "visual-target",
      description: `visual target ${Math.round(visualPoint.x)},${Math.round(visualPoint.y)}`,
      matches: elementsAtPoint(visualPoint)
    };
  }
  if (target) {
    yield { strategy: "fingerprint", description: "element fingerprint", matches: fingerprintMatches(target) };
  }
}

/**
 * What a fingerprint matches, stable signals first.
 *
 * `findClosestFingerprint` answers the stable half -- selector, xpath, id, test
 * id, authored name, class names -- and answers with one element, so there is
 * nothing there to be ambiguous about. Its text fallback is repeated here
 * rather than delegated because that is the half that ties: "the button that
 * says Continue" is one target on most pages and two on this one, and only a
 * count can tell those apart.
 */
function fingerprintMatches(target: RecordedTarget): Element[] {
  const { visibleText, ...stable } = target;
  const exact = findClosestFingerprint(stable);
  if (exact) return [exact];
  if (!visibleText) return [];
  const wanted = normalizeText(visibleText);
  const matches: Element[] = [];
  let scanned = 0;
  for (const element of document.querySelectorAll(target.tagName || "*")) {
    scanned += 1;
    if (scanned > MAX_TEXT_SCAN) break;
    if (normalizeText(element.textContent ?? "") === wanted) matches.push(element);
  }
  return matches;
}

/**
 * The matches worth choosing between: those that are visible, enabled, and of
 * the recorded tag. When the gate rejects every match the matches themselves
 * are the pool, because a strategy that found exactly one element has resolved
 * it -- a hidden or disabled target is what an assertion asks about and what an
 * actionability refusal reports, and neither is this module's decision to make.
 */
function gatedPool(matches: Element[], target: RecordedTarget | undefined): Element[] {
  const preferred = matches.filter((element) => passesGate(element, target));
  return preferred.length ? preferred : matches;
}

function passesGate(element: Element, target: RecordedTarget | undefined): boolean {
  if (target?.tagName && element.tagName.toLowerCase() !== target.tagName.toLowerCase()) return false;
  return isVisibleForResolution(element) && isEnabledForResolution(element);
}

/**
 * Visible enough to be the element a command meant: in the document, with a
 * box, and not hidden by a style that collapses it.
 *
 * This is deliberately weaker than `actionability.ts`, which scrolls the
 * element into view and hit-tests it. Resolution answers "which element is
 * this?" and must not move the page to do it; whether the answer can then be
 * clicked is the actionability gate's question, asked after.
 */
function isVisibleForResolution(element: Element): boolean {
  if (!element.isConnected) return false;
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const style = view.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Enabled by the platform's rule, which covers a disabled `<fieldset>`'s descendants, plus the ARIA claim. */
function isEnabledForResolution(element: Element): boolean {
  if (element.matches(":disabled")) return false;
  return !element.closest('[aria-disabled="true"]');
}

/**
 * Several elements answered to the same target and none could be preferred.
 * The candidates are named, bounded, so the Flow can be told which of them it
 * meant; the code and category ride in the record, not in the sentence. Where
 * scoring was attempted and failed to separate them, each name carries the
 * score it got, because "they tied at 1.00" and "the best of them reached 0.12"
 * are different problems with different fixes.
 */
function ambiguous(attempt: StrategyAttempt, pool: Element[], decided: CandidateSelection | undefined): TargetResolutionError {
  const scores = scoreByElement(decided);
  const named = pool.slice(0, MAX_NAMED_CANDIDATES).map((element) => namedCandidate(element, scores)).join(", ");
  const more = pool.length > MAX_NAMED_CANDIDATES ? `, and ${pool.length - MAX_NAMED_CANDIDATES} more` : "";
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS, {
    expected: `one element matching ${attempt.description}`,
    actual: `${pool.length} elements matched: ${named}${more}`
  });
  const message = `Target ambiguous: ${attempt.description} matched ${pool.length} elements: ${named}${more}.`;
  return new TargetResolutionError(message, failure, { strategy: attempt.strategy, candidateCount: pool.length });
}

/**
 * No strategy answered, and scoring found several candidates that could each be
 * the recorded control. That is a different failure from "nothing matched": the
 * page does hold plausible controls, and the Flow can pick one, so the top of
 * the ranking is named with its score and the strategy is the scored one.
 */
function scoredAmbiguous(decided: Extract<CandidateSelection, { outcome: "ambiguous" }>, misses: string[]): TargetResolutionError {
  const top = decided.ranked.slice(0, MAX_NAMED_CANDIDATES);
  const named = top.map((entry) => `${candidateLabel(entry.element)} (${entry.score.normalizedScore.toFixed(2)})`).join(", ");
  const more = decided.ranked.length > MAX_NAMED_CANDIDATES ? `, and ${decided.ranked.length - MAX_NAMED_CANDIDATES} more` : "";
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS, {
    expected: misses.length ? `one element matching ${misses.join(", ")}` : "one recorded control",
    actual: `no exact match; ${decided.ranked.length} scored candidate(s) tied: ${named}${more}`
  });
  const message = `Target ambiguous: no exact match, and the top scored candidates tied: ${named}${more}.`;
  const best = decided.ranked[0];
  return new TargetResolutionError(message, failure, {
    strategy: "scored-candidate",
    candidateCount: decided.ranked.length,
    ...(best ? { bestScore: best.score.normalizedScore, confidence: best.score.confidence } : {}),
    ...(decided.ranked[1] ? { runnerUpScore: decided.ranked[1].score.normalizedScore } : {})
  });
}

/**
 * Nothing answered. The message is the one this module shipped with, so the
 * strategies attempted still read in order; the record says the same thing in
 * Core's vocabulary and adds how many same-family controls the page did offer,
 * which is what a Flow needs to know to widen its target.
 */
function notFound(message: string, misses: string[], nearbyCount: number): TargetResolutionError {
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, {
    expected: misses.length ? `an element matching ${misses.join(", ")}` : "a selector, coordinates, or a focused element",
    actual: `nothing matched; ${nearbyCount} control(s) of the same family are on the page`
  });
  return new TargetResolutionError(message, failure, { strategy: strategyOf(misses), candidateCount: nearbyCount });
}

/** The score each tied element got, when scoring ran at all. */
function scoreByElement(decided: CandidateSelection | undefined): Map<Element, number> {
  return new Map((decided?.ranked ?? []).map((entry) => [entry.element, entry.score.normalizedScore]));
}

function namedCandidate(element: Element, scores: Map<Element, number>): string {
  const score = scores.get(element);
  return score === undefined ? candidateLabel(element) : `${candidateLabel(element)} (${score.toFixed(2)})`;
}

/** The strategy a not-found failure is attributed to: the last one attempted, or the focus fallback. */
function strategyOf(misses: string[]): BrowserActionTargetStrategy {
  const last = misses.at(-1);
  if (!last) return "active-element";
  if (last.startsWith("selector")) return "selector";
  if (last.startsWith("coordinates")) return "coordinates";
  if (last.startsWith("visual target")) return "visual-target";
  return "fingerprint";
}

function recordedTarget(action: BrowserActionCommand): RecordedTarget | undefined {
  const element = action.options?.element;
  if (!element || typeof element !== "object" || Array.isArray(element)) return undefined;
  return element as RecordedTarget;
}

function querySelectorAll(selector: string): Element[] {
  try {
    return [...document.querySelectorAll(selector)];
  } catch {
    return [];
  }
}

function elementsAtPoint(point: { x: number; y: number }): Element[] {
  const element = document.elementFromPoint(point.x, point.y);
  return element ? [element] : [];
}

/**
 * The point a visual target names. Document bounds are preferred and corrected
 * for the current scroll: they say where the element is on the page, which is
 * still true after the page has moved, whereas the viewport bounds recorded
 * with them say where it was on screen at capture time and point at whatever
 * has since scrolled into that spot.
 */
function pointFromVisualTarget(visualTarget: BrowserActionCommand["visualTarget"]): { x: number; y: number } | undefined {
  if (visualTarget?.documentBounds) {
    const center = centerPoint(visualTarget.documentBounds);
    return { x: center.x - window.scrollX, y: center.y - window.scrollY };
  }
  const bounds = visualTarget?.bounds ?? visualTarget?.anchor?.bounds;
  return bounds ? centerPoint(bounds) : undefined;
}

function centerPoint(rect: RectDescriptor): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

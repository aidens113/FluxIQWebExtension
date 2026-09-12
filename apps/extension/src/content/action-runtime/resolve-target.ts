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
// Level 2 -- enumerating same-family candidates and scoring them with Core's
// element matcher, so a control whose id, class and test id all drifted is
// still recovered by its name, role and position -- is not here. Core's matcher
// is only published from `fluxiq/automation-studio`, whose barrel reaches
// `node:crypto` and `node:perf_hooks`, so bundling it into a content script
// fails outright; see reports/w3-resolver.md. The candidate pool it needs is
// built and is already used to name the elements an ambiguous target tied
// between.

import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import { findClosestFingerprint, type ElementFingerprint } from "../element-finder";
import { candidateLabel, collectTargetCandidates } from "../identity";
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
    throw ambiguous(attempt, pool);
  }

  if (!misses.length) {
    const active = document.activeElement;
    if (active) return { element: active, resolution: { strategy: "active-element", candidateCount: 1 } };
    throw notFound("No selector, coordinates, or active element was available.", [], target);
  }
  throw notFound(`No target resolved from ${misses.join(", ")}.`, misses, target);
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
 * meant; the code and category ride in the record, not in the sentence.
 */
function ambiguous(attempt: StrategyAttempt, pool: Element[]): TargetResolutionError {
  const named = pool.slice(0, MAX_NAMED_CANDIDATES).map(candidateLabel).join(", ");
  const more = pool.length > MAX_NAMED_CANDIDATES ? `, and ${pool.length - MAX_NAMED_CANDIDATES} more` : "";
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS, {
    expected: `one element matching ${attempt.description}`,
    actual: `${pool.length} elements matched: ${named}${more}`
  });
  const message = `Target ambiguous: ${attempt.description} matched ${pool.length} elements: ${named}${more}.`;
  return new TargetResolutionError(message, failure, { strategy: attempt.strategy, candidateCount: pool.length });
}

/**
 * Nothing answered. The message is the one this module shipped with, so the
 * strategies attempted still read in order; the record says the same thing in
 * Core's vocabulary and adds how many same-family controls the page did offer,
 * which is what a Flow needs to know to widen its target.
 */
function notFound(message: string, misses: string[], target: RecordedTarget | undefined): TargetResolutionError {
  const nearby = collectTargetCandidates({
    ...(target?.tagName ? { tagName: target.tagName } : {}),
    ...(target?.role ?? target?.implicitRole ? { role: target?.role ?? target?.implicitRole } : {})
  });
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, {
    expected: misses.length ? `an element matching ${misses.join(", ")}` : "a selector, coordinates, or a focused element",
    actual: `nothing matched; ${nearby.length} control(s) of the same family are on the page`
  });
  return new TargetResolutionError(message, failure, { strategy: strategyOf(misses), candidateCount: nearby.length });
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

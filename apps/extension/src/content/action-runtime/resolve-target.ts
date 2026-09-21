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
// The one answer a strategy does produce is then checked before it is acted on.
// Level 1's queries are not equally strong -- an id is unique and a class set
// is not -- and the weak ones used to act with no score and no floor at all: a
// page whose Save button had been replaced by a `btn btn-primary` "Delete
// workspace" was resolved by the class-set query and clicked, measured, while
// Level 2 scored the same element -0.237 and refused it. `identity/veto.ts`
// closes that: it scores the match against the recording with the same matcher
// Level 2 uses and refuses one the page contradicts, or one that answers
// nothing the recording named exactly -- the second rule being what protects a
// recording carrying no stable identifier, whose thin denominator lets an
// impostor drift above zero rather than below it, and what refuses a different
// action whose label merely contains the recorded one. A veto is a miss, not an
// abort, so the strategies after it and then scoring still run -- which is how
// a control that merely moved into another slot is recovered rather than only
// not clicked.
//
// The veto now asks one question before it scores anything, and it is the
// question no fingerprint could answer. A page built from a repeated template
// makes its controls identical on purpose -- 240 rows, 240 action buttons, one
// constant accessible name -- so a recorded selector can only name one of them
// positionally, and replaying it against a page that lost the recorded row
// resolved *another member's* button, agreed with it on every signal, clicked
// it and reported success. `identity/record.ts` carries which record the
// control sat in and refuses a candidate in a different one, at Level 1 and
// again before Level 2 ranks anything. It fails closed: a candidate in no
// record at all, when the recording named one, disagrees.
//
// A point is checked once more. `coordinates` and `visual-target` land on one
// element by construction, so a page holding that element's identical twin
// never shows in their count: on `ambiguous-targets` `no-context` the recorded
// bounds fell on the first of two byte-identical Continue buttons, and the
// replay clicked it and reported success (`L-replay` Defect 1). So a point's
// answer is acted on only after the recorded target's family is scored, and a
// family scoring calls tied fails TARGET_AMBIGUOUS, as the fingerprint
// strategy's text match already did on the same page.
//
// A failure carries Core's structured record rather than only a sentence:
// TARGET_AMBIGUOUS naming the candidates that tied, TARGET_NOT_FOUND naming the
// strategies that were attempted. The codes come from the domain's closed set,
// never from a string written here, and `results.ts` lifts both the record and
// the measurement off the thrown error onto the `BrowserActionResult`.
//
// A resolution that *succeeded* now reports its measurement too, and that is
// the half of D1 nobody ever decided against -- it fell out of this function
// returning a bare `Element`. `resolveTarget` returns the element and the
// resolution together, each verb passes the resolution into the evidence it
// already builds, and `results.ts` puts it on the result. Until D13 the gap
// cost little, because Level 2 scoring could not succeed and every success was
// an exact match with nothing interesting to report; now that a scored
// resolution resolves at a measured confidence, a Flow that cannot read it
// cannot tell a control recovered by a hair from one matched outright, and
// neither can anyone debugging a replay that clicked the wrong thing.
//
// Both then leave the browser. `webAutomationActionResultPayload`
// (`domain/src/client/gateway-mapping.ts`) carries `resolution` on the result
// payload and its own test pins that it does. It is safe to carry because of
// what it is: a closed strategy enum and four numbers, no page-derived text and
// so no redaction guard. The candidate *labels* an ambiguous failure names are
// page text, and they ride on the failure record, bounded by
// `identity/reportable-text.ts` -- never in these fields.
//
// Level 2 is scoring, and it runs at the two points where an exact answer is
// not one: when a strategy matched several elements and the gate could not
// narrow them to one, and when every strategy missed. Both hand the candidates
// to Core's element matcher through `identity/score.ts` -- the same matcher
// Core would score them with itself, published for a browser since Wave 3 as
// `fluxiq/automation-studio/fingerprinting`. A candidate wins by clearing the
// floor, beating the runner-up by a margin, and agreeing exactly on something
// that says which control it is; otherwise the tie is reported rather than
// broken by document order, or the target is reported not found. The
// confidence on a scored resolution is Core's measurement of the candidate that
// won, never a constant.
//
// An exact resolution reports its strategy, its candidate count and the score
// the veto took of it -- which closes the last piece of D1. `identity/veto.ts`
// has always scored every exact match before it is acted on; until 2026-09-12
// it returned that measurement only when it refused and dropped it when it
// accepted, so a successful exact match arrived here with nothing to report.
// The alternative was scoring the element a second time on every action's
// critical path, for a number already computed a call below. It is Core's
// measurement either way, never a constant, and it is absent -- rather than
// filled with a stand-in -- when the recording named nothing the veto could
// weigh the match by. There is no runner-up score on an exact match, because
// only one element was weighed.
//
// Scoring cannot rescue every drift, and it is not meant to. A control whose
// text, id, class and test id have *all* changed scores below the floor against
// its own page, because at that point nothing distinguishes it from the next
// button along; the resolver refuses rather than clicking the least-wrong thing.
// The measured numbers are in reports/w3-matcher-packaging.md.

import {
  WEB_AUTOMATION_FAILURE_CODES,
  webAutomationFailureRecord,
  type WebAutomationFailureCarrier,
  type WebAutomationFailureRecord
} from "@fluxiq-web-extension/domain/client";
import { findClosestFingerprint, type ElementFingerprint } from "../element-finder";
import { deepElementFromPoint, resolveShadowScope, type LookupRoot, type ShadowScope } from "../selector";
import {
  candidateFingerprint,
  candidateLabel,
  collectTargetCandidates,
  scoreTargetCandidates,
  vetoExactMatch,
  type CandidateSelection,
  type TargetCandidate,
  type TargetCandidatePool,
  type TargetMeasurement
} from "../identity";
import type { BrowserActionCommand, BrowserActionTargetResolution, BrowserActionTargetStrategy, DomElementContext, RectDescriptor } from "../types";

/** The element an action will act on, with the measurement that chose it. */
export type ResolvedTarget = {
  element: Element;
  resolution: BrowserActionTargetResolution;
};

/**
 * The recorded target as it arrives on the command -- declared as
 * `action.element`, and still carried raw in `options.element` beside it: the
 * fingerprint `element-finder.ts` looks elements up by, plus the identity
 * signals `describe-element.ts` records, which say what family a candidate
 * must be in.
 */
type RecordedTarget = ElementFingerprint & {
  role?: string | undefined;
  implicitRole?: string | undefined;
  testId?: string | undefined;
  accessibleName?: string | undefined;
  label?: string | undefined;
  /**
   * Where the element sat, of which one field is acted on: `context.record`,
   * the row, card or list item it belonged to. The veto refuses a match in
   * another record and the scorer will not rank one, so a page of identical
   * controls can be told apart by something other than their position.
   */
  context?: DomElementContext | undefined;
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
 * Both ride onto the `BrowserActionResult`: `results.ts` reads `failure` and
 * `resolution` off a thrown value structurally, so the result names
 * TARGET_AMBIGUOUS or TARGET_NOT_FOUND as a code rather than as a sentence a
 * reader would have to parse, and both then travel on to a Flow -- the record
 * as `failure`, the measurement as `resolution`, which the result payload
 * carries as of this change. The record is built from the closed code set, so
 * it cannot contradict a Core consistency rule and be dropped by its parser.
 *
 * `implements WebAutomationFailureCarrier` is what makes that last sentence a
 * compiler check rather than a habit, and it is why the field is
 * `WebAutomationFailureRecord` and not Core's `AutomationStudioFailureRecord`.
 * `runtime/failure/carrier.ts` names this class as its worked example of the
 * convention, and until now this class was the one that did not follow it:
 * Core types a record's `code` as a bare `string`, because Core does not own
 * the codes, so an invented code compiled here and was demoted to UNKNOWN at
 * the far end. Narrowed to the domain's record, the closed set is enforced at
 * the throw. All three builders below already go through
 * `webAutomationFailureRecord`, so nothing about what is thrown changed.
 */
export class TargetResolutionError extends Error implements WebAutomationFailureCarrier {
  readonly failure: WebAutomationFailureRecord;
  readonly resolution: BrowserActionTargetResolution;

  constructor(message: string, failure: WebAutomationFailureRecord, resolution: BrowserActionTargetResolution) {
    super(message);
    this.name = "TargetResolutionError";
    this.failure = failure;
    this.resolution = resolution;
  }
}

/**
 * The element an action acts on, with the measurement that chose it. Throws
 * `TargetResolutionError` when none can be chosen.
 *
 * Both halves of the return are used, which is the change that closed D1's
 * other half. Verbs destructure the element to act on and pass the resolution
 * into the evidence they already hand `results.ts`, so a *successful*
 * resolution's measurement reaches the result and then the wire. It used to
 * reach nothing: this function returned a bare `Element` and a second
 * `resolveTargetWithDiagnostics` beside it returned both, and since the verbs
 * took the first, every success threw its measurement away one call below where
 * the failure path's copy was kept. The two are now one function, because a
 * measurement no caller can see is a measurement nobody will keep correct.
 */
export function resolveTarget(action: BrowserActionCommand): ResolvedTarget {
  const target = recordedTarget(action);
  // A target recorded inside a shadow root is looked for only in the roots its
  // recorded host chain reaches, by every strategy below and by scoring; any
  // other target in the document, as it always was (`selector/shadow/scope.ts`).
  const scope = resolveShadowScope(target?.context?.shadowHosts);
  const misses: string[] = [];
  // Enumerating and scoring the family is the costly half of a resolution, and
  // both a point's answer and the final fallback may need it. Nothing on the
  // page changes inside this call, so it runs at most once.
  let family: ScoredFamily | undefined;
  const scoredFamily = (known: RecordedTarget): ScoredFamily => (family ??= scoreFamily(known, scope));

  for (const attempt of exactAttempts(action, target, scope)) {
    if (!attempt.matches.length) {
      misses.push(attempt.description);
      continue;
    }
    const pool = gatedPool(attempt.matches, target);
    const only = pool.length === 1 ? pool[0] : undefined;
    if (only) {
      // One answer, unweighed until now. `identity/veto.ts` scores it against
      // the recording and refuses a match the page contradicts, or one that
      // corroborates nothing the recording named; a refusal
      // demotes the strategy to a miss rather than ending the resolution, so
      // the strategies after it and then Level 2 still get their turn -- which
      // is how a page that moved the control into another slot is recovered
      // instead of merely not clicked.
      const verdict = target ? vetoExactMatch(target, only) : undefined;
      if (verdict?.refusedBecause) {
        misses.push(`${attempt.description} (${verdict.summary})`);
        continue;
      }
      // A point answers with one element whatever else the page holds, so its
      // count proves nothing about a twin. Scoring the family does.
      if (target && POSITIONAL_STRATEGIES.has(attempt.strategy)) {
        const { decided } = scoredFamily(target);
        if (decided?.outcome === "ambiguous") throw scoredAmbiguous(decided, [...misses, attempt.description]);
      }
      // And when it accepts, its measurement is what the resolution reports.
      // The veto weighed this element on the way past; carrying the number out
      // is free, where scoring it again here would not be.
      return { element: only, resolution: exactResolution(attempt, verdict?.measurement) };
    }
    // Several survived the gate. Scoring is the difference between "these two
    // tied" and "these two tied, and one of them is the recorded control".
    const decided = target ? scoreTargetCandidates(target, describePool(pool)) : undefined;
    if (decided?.outcome === "resolved") return scoredTarget(decided, pool.length);
    throw ambiguous(attempt, pool, decided);
  }

  if (!misses.length) {
    const active = document.activeElement;
    if (active) return { element: active, resolution: { strategy: "active-element", candidateCount: 1 } };
    throw notFound("No selector, coordinates, or active element was available.", [], NO_POOL);
  }

  // Nothing answered exactly. The page may still hold the control under a new
  // name, so the same-family candidates are enumerated once and scored: the
  // enumeration is what a not-found failure reports either way.
  const { nearby, decided } = target ? scoredFamily(target) : NO_FAMILY;
  if (decided?.outcome === "resolved") return scoredTarget(decided, nearby.candidates.length);
  if (decided?.outcome === "ambiguous") throw scoredAmbiguous(decided, misses);
  throw notFound(`No target resolved from ${misses.join(", ")}.`, misses, nearby, decided);
}

/** No enumeration was run at all: nothing was looked at, so nothing was cut short. */
const NO_POOL: TargetCandidatePool = { candidates: [], examined: 0, truncated: false };

/** The strategies that choose an element by where it is rather than by what it is. */
const POSITIONAL_STRATEGIES: ReadonlySet<BrowserActionTargetStrategy> = new Set(["coordinates", "visual-target"]);

/** The recorded target's same-family candidates, and what scoring made of them. */
type ScoredFamily = { nearby: TargetCandidatePool; decided: CandidateSelection | undefined };

/** No recorded target, so no family was enumerated or scored. */
const NO_FAMILY: ScoredFamily = { nearby: NO_POOL, decided: undefined };

function scoreFamily(target: RecordedTarget, scope: ShadowScope): ScoredFamily {
  const nearby = collectTargetCandidates(candidateFamily(target), scope.roots);
  return { nearby, decided: scoreTargetCandidates(target, nearby.candidates) };
}

/**
 * An exact strategy's win, with the measurement the veto took on the way past.
 *
 * There is no runner-up: an exact strategy resolved one element, so the only
 * thing that was weighed is that element. `bestScore` and `confidence` are
 * Core's, never a constant, and they are absent when the recording named
 * nothing the veto could weigh the match by -- which is a truthful "not
 * measured" rather than a stand-in.
 */
function exactResolution(attempt: StrategyAttempt, measurement: TargetMeasurement | undefined): BrowserActionTargetResolution {
  return {
    strategy: attempt.strategy,
    candidateCount: attempt.matches.length,
    ...(measurement ? { bestScore: measurement.score, confidence: measurement.confidence } : {})
  };
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
 * the same sequence. Each looks only in `scope`, and a failure says where it
 * looked when that was not the document.
 */
function* exactAttempts(action: BrowserActionCommand, target: RecordedTarget | undefined, scope: ShadowScope): Generator<StrategyAttempt> {
  const where = scope.description === undefined ? "" : ` in ${scope.description}`;
  if (action.selector) {
    yield { strategy: "selector", description: `selector ${action.selector}${where}`, matches: querySelectorAll(scope.roots, action.selector) };
  }
  if (action.coordinates) {
    yield {
      strategy: "coordinates",
      description: `coordinates ${action.coordinates.x},${action.coordinates.y}${where}`,
      matches: elementsAtPoint(action.coordinates, scope)
    };
  }
  const visualPoint = pointFromVisualTarget(action.visualTarget);
  if (visualPoint) {
    yield {
      strategy: "visual-target",
      description: `visual target ${Math.round(visualPoint.x)},${Math.round(visualPoint.y)}${where}`,
      matches: elementsAtPoint(visualPoint, scope)
    };
  }
  if (target) {
    yield { strategy: "fingerprint", description: `element fingerprint${where}`, matches: fingerprintMatches(target, scope.roots) };
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
 *
 * Each root in scope is asked on its own, so a stable signal that answers in
 * two shadow roots answers twice, and the resolver weighs the two rather than
 * taking the first.
 */
function fingerprintMatches(target: RecordedTarget, roots: readonly LookupRoot[]): Element[] {
  const { visibleText, ...stable } = target;
  const exact = roots.flatMap((root) => {
    const found = findClosestFingerprint(stable, root);
    return found ? [found] : [];
  });
  if (exact.length) return exact;
  if (!visibleText) return [];
  const wanted = normalizeText(visibleText);
  const matches: Element[] = [];
  let scanned = 0;
  for (const root of roots) {
    for (const element of root.querySelectorAll(target.tagName || "*")) {
      scanned += 1;
      if (scanned > MAX_TEXT_SCAN) return matches;
      if (normalizeText(element.textContent ?? "") === wanted) matches.push(element);
    }
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
 *
 * When scoring ran and refused, its numbers ride along. A near-miss and a
 * hopeless page are otherwise indistinguishable to a Flow -- both read as
 * "nothing matched; 2 controls of the same family are on the page" -- and they
 * call for opposite responses: a near-miss means the recorded control is
 * probably still there under a new name and the target should be widened, while
 * a best candidate deep in the negatives means it is gone and the step needs
 * rewriting. `scoredAmbiguous` beside this already reports the same three
 * fields, so a refusal now carries them whichever way it refused.
 *
 * The count of same-family controls is a measurement of the *enumeration*, not
 * of the page, and until 2026-09-12 it was reported as though the two were one
 * thing. They are not, on a page big enough for the enumeration's cap to bite:
 * the scan stopped after the first N interactive elements, and if the target's
 * family began after them the failure read "0 control(s) of the same family are
 * on the page" -- which says *this control does not exist here* to a reader
 * whose actual problem is *we stopped looking*. Those call for opposite
 * responses, and the first sends a person hunting for a fault in a selector
 * that was right. `familySeen` is what tells them apart.
 */
function notFound(message: string, misses: string[], pool: TargetCandidatePool, decided?: CandidateSelection): TargetResolutionError {
  const best = decided?.ranked[0];
  const runnerUp = decided?.ranked[1];
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, {
    expected: misses.length ? `an element matching ${misses.join(", ")}` : "a selector, coordinates, or a focused element",
    actual: `nothing matched; ${familySeen(pool)}${best ? `; best scored ${best.score.normalizedScore.toFixed(2)}` : ""}`
  });
  return new TargetResolutionError(message, failure, {
    strategy: strategyOf(misses),
    candidateCount: pool.candidates.length,
    ...(best ? { bestScore: best.score.normalizedScore, confidence: best.score.confidence } : {}),
    ...(runnerUp ? { runnerUpScore: runnerUp.score.normalizedScore } : {})
  });
}

/**
 * What the enumeration found, and whether that is the whole of what the page
 * offered.
 *
 * A complete scan reports the count as a fact about the page, which is the
 * sentence this module has always produced. A scan a cap cut short reports the
 * same count as a floor and says where it stopped, because the number is then a
 * fact about the enumeration, and a Flow reading it as a fact about the page
 * would widen or rewrite the wrong thing.
 */
function familySeen(pool: TargetCandidatePool): string {
  const found = `${pool.candidates.length} control(s) of the same family`;
  if (!pool.truncated) return `${found} are on the page`;
  return `${found} in the first ${pool.examined} interactive element(s); the scan was cut short there, so the page may hold more`;
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

/**
 * The recorded element's identity: the declared field first, the untyped bag
 * only when no declared field arrived.
 *
 * `action.element` is the contract. The domain fills it in
 * `client/gateway-mapping.ts`, and that is also where the question of *which*
 * description is the better one has already been answered: Core's
 * `prepareElementTargetAction` rewrites the dispatched target on every dispatch
 * from the parameters' own top-level keys, never looking inside
 * `parameters.element`, so an adapted copy is richer than the recorded one only
 * when Core actually matched a runtime candidate, and is a lossy re-derivation
 * of the same element when it did not. Measured on the real path, that is 11
 * identity signals against 1. Re-deriving that preference here would be a
 * second order to keep in step with the first; this function takes the
 * description the domain already chose.
 *
 * Both paths are wire values, so both are checked rather than trusted -- the
 * declared field's type says what the domain sends, not what an older client or
 * a hand-built command actually sent -- and an object with no keys is not an
 * identity, so it falls through instead of blanking the target.
 *
 * The fallback is deliberate and temporary: `options.element` is the same value
 * raw, and it stays live until every producer sends the declared field.
 * `tests/resolve-target.test.ts` holds both halves, so one row fails if the
 * declared field stops being read and another if the fallback disappears while
 * a caller still sends only `options`.
 */
function recordedTarget(action: BrowserActionCommand): RecordedTarget | undefined {
  return describedElement(action.element) ?? describedElement(action.options?.element);
}

/** A wire value that is an element description: an object carrying at least one signal. */
function describedElement(value: unknown): RecordedTarget | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.keys(value).length ? value as RecordedTarget : undefined;
}

function querySelectorAll(roots: readonly LookupRoot[], selector: string): Element[] {
  return roots.flatMap((root) => {
    try {
      return [...root.querySelectorAll(selector)];
    } catch {
      return [];
    }
  });
}

/**
 * What a point lands on. For a target recorded inside a shadow root the point
 * is followed into the roots it paints, and it answers only when it lands in
 * the scope: `document.elementFromPoint` alone answers with the outermost
 * shadow host, which lane D's replay weighed against the consent button inside
 * it and refused.
 */
function elementsAtPoint(point: { x: number; y: number }, scope: ShadowScope): Element[] {
  if (!scope.scoped) {
    const element = document.elementFromPoint(point.x, point.y);
    return element ? [element] : [];
  }
  const element = deepElementFromPoint(point.x, point.y);
  return element && scope.roots.includes(element.getRootNode() as LookupRoot) ? [element] : [];
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

// The elements a drifted target could plausibly be, and how each of them
// describes itself.
//
// The resolver's exact strategies -- a selector, a point, a fingerprint's id or
// test id -- answer "is this exact thing still here?". When the answer is no,
// or when it is yes several times over, the question becomes "which of the
// things that *are* here is the one that was recorded?", and that question
// needs a pool to choose from. This module builds that pool from the live
// document: the controls that share the recorded target's tag or role family,
// bounded, in this frame only.
//
// Each candidate is described in the shape Core's element matcher scores --
// `ElementFingerprintCandidate` -- so the pool can be handed straight to it
// without a second translation. The signals come from the same `identity/`
// modules `describe-element.ts` assembles a descriptor from, so a candidate and
// a recorded descriptor are built from one set of rules and compare fairly.
//
// Every lookup is bounded on purpose. A resolution runs on the critical path of
// every action, and a page with ten thousand nodes must not turn one click into
// a full-document walk. What each bound actually buys is stated on the bound
// itself, because until 2026-09-12 the two here were the wrong way round: the
// scan bound was 600 and it was spent on *every* interactive element rather
// than on the family, so a page whose target's family began past the six
// hundredth `CANDIDATE_SELECTOR` match enumerated nothing at all -- and the
// resolver then reported the page as holding no such control. See
// `MAX_SCANNED` below and `reports/x-scan-cap.md` for the measurement.

import type { ElementFingerprintCandidate } from "fluxiq/automation-studio";
import type { LookupRoot } from "../selector";
import { accessibleNameFor } from "./accessible-name";
import { boundedText } from "./bounded-text";
import { implicitRole } from "./implicit-role";
import { labelText } from "./label";
import { reportableText } from "./reportable-text";

/** One element the resolver may choose, paired with the description Core's matcher scores. */
export type TargetCandidate = {
  element: Element;
  fingerprint: ElementFingerprintCandidate;
};

/**
 * The pool a resolver chooses from, and whether it is the whole of what the
 * page offered.
 *
 * The count alone cannot answer the question a failed replay asks. "No control
 * of this family is on the page" tells a Flow to rewrite the step; "we stopped
 * looking before the page ran out" tells it nothing of the sort, and the two
 * used to read identically because enumeration returned a bare array. So the
 * pool carries what bounded it.
 *
 * A bare `truncated` is the right name here under the rule tabulated in
 * `domain/src/recording/web-state/evidence/input.ts`: it sits inside the
 * structure whose own caps set it, beside that structure's own count, and it
 * summarises no cap but this module's two.
 */
export type TargetCandidatePool = {
  /** The family members that were described, in document order. */
  candidates: TargetCandidate[];
  /** Interactive elements the family filter looked at, whether or not they were in the family. */
  examined: number;
  /**
   * A cap stopped the scan before the document ran out, so `candidates` is a
   * prefix of the page's family rather than all of it. Either cap can set it:
   * `MAX_SCANNED` when the page holds more interactive elements than the filter
   * looked at, `MAX_CANDIDATES` when the family itself is longer than the
   * scorer is given.
   */
  truncated: boolean;
};

/** What the recorded target looked like, as far as enumeration needs to know. */
export type CandidateFamily = {
  /** The recorded tag name, lowercased. A candidate sharing it is in the family. */
  tagName?: string | undefined;
  /** The recorded ARIA role, explicit or implicit. A candidate sharing it is in the family. */
  role?: string | undefined;
};

/**
 * Interactive elements the family filter looks at before enumeration gives up.
 *
 * This is a bound on the *cheap* half. The walk itself is already paid for:
 * `querySelectorAll` has materialised a static NodeList of every
 * `CANDIDATE_SELECTOR` match before the loop starts, so stopping the loop early
 * saves not a document walk but a tag comparison and at most one `getAttribute`
 * per element. `MAX_CANDIDATES` below is the bound that matters, because
 * `candidateFingerprint` -- a `getBoundingClientRect`, an accessible-name
 * computation and a `textContent` read -- runs only on family members.
 *
 * It was 600, and the two bounds were doing each other's job: 600 was spent on
 * whatever came first in document order, so a page with a 200-item nav and a
 * 300-row grid ahead of its content had spent the budget before reaching the
 * family, `collectTargetCandidates` returned nothing, and the failure said the
 * page held no control of that family. 5,000 is chosen against what the same
 * page already pays elsewhere on the same event: `dom-snapshot.ts` walks up to
 * `MAX_SNAPSHOT_SCAN_ELEMENTS = 50_000` elements and `evidence/repeating.ts`
 * up to 2,000 on every capture, so a resolution that looks at 5,000 is an order
 * of magnitude cheaper than the capture beside it. Measured cost in
 * `reports/x-scan-cap.md`.
 *
 * It stays a hard bound rather than becoming no bound: a page can hold a
 * hundred thousand anchors, and one click must not walk all of them. When it
 * does bite, the pool says so -- see `TargetCandidatePool.truncated` -- because
 * a short pool reported as a complete one is worse than a short pool.
 */
const MAX_SCANNED = 5_000;
/** Candidates handed to the scorer. Beyond this the extra rows cannot change which one wins. */
const MAX_CANDIDATES = 60;
const MAX_SIGNAL_LENGTH = 200;
/** Characters of a candidate's own label quoted in a failure message. */
const MAX_LABEL_LENGTH = 40;

/**
 * The elements a resolver may choose between: anything a person can act on,
 * plus anything the page dressed as interactive. The list is deliberately not
 * "every element" -- a recorded target is a control, and scoring a page's
 * paragraphs against it wastes the budget on rows that can never win.
 */
const CANDIDATE_SELECTOR = [
  "a[href]", "button", "input", "select", "textarea", "summary", "label",
  "[role]", "[tabindex]", "[onclick]", "[contenteditable]"
].join(",");

/**
 * The candidates in `roots` that share the recorded target's tag or role
 * family, in document order within each root and root after root, capped. The
 * roots are the document, or the shadow roots a recorded target's host chain
 * reached (`../selector/shadow/scope.ts`): a target recorded inside a widget's
 * shadow root is weighed against that widget's controls, never the page's.
 *
 * "Family" is deliberately loose: a `<button>` that became a `<div role=
 * "button">` is the same control to a person, and a resolver that insisted on
 * the tag would never find it. Where the family names neither a tag nor a role
 * -- a target recorded with no such signal -- every interactive element is in
 * scope, because nothing has been said that could exclude one.
 *
 * The pool says whether it is complete. Truncation is decided against the
 * NodeList's own length rather than against the cap, so a page holding exactly
 * `MAX_SCANNED` interactive elements or exactly `MAX_CANDIDATES` family members
 * is reported complete, which it is.
 */
export function collectTargetCandidates(family: CandidateFamily, roots: readonly LookupRoot[] = [document]): TargetCandidatePool {
  const tagName = family.tagName?.toLowerCase();
  const role = family.role?.toLowerCase();
  const lists = roots.map((root) => root.querySelectorAll(CANDIDATE_SELECTOR));
  const total = lists.reduce((sum, list) => sum + list.length, 0);
  const candidates: TargetCandidate[] = [];
  let examined = 0;
  for (const interactive of lists) {
    for (const element of interactive) {
      if (examined >= MAX_SCANNED) return { candidates, examined, truncated: true };
      examined += 1;
      if (!inFamily(element, tagName, role)) continue;
      // The index is across every root, so no two candidates share a fallback id.
      candidates.push({ element, fingerprint: candidateFingerprint(element, candidates.length) });
      // The scorer's budget is full. Anything after this element is unweighed,
      // and that is only truncation if there was in fact something after it.
      if (candidates.length >= MAX_CANDIDATES) return { candidates, examined, truncated: examined < total };
    }
  }
  return { candidates, examined, truncated: false };
}

/**
 * How an element describes itself to Core's matcher: the same identity signals
 * `describe-element.ts` puts on the wire, under the names Core weighs them by.
 *
 * `index` only backs the candidate id when the page offers no stable one; Core
 * uses that id to name the winner, never to score it, so a positional fallback
 * cannot influence which candidate is chosen.
 *
 * **Where the element sits is deliberately not here.** `context.ts` derives
 * `listPosition` and `tablePosition` for every described element, and they are
 * exactly what separates row 7's Edit button from row 8's -- so their absence
 * from both sides of the comparison looks like an oversight. It is not, and the
 * reason is Core's, measured on 2026-09-12 against
 * `fluxiq/automation-studio/fingerprinting`:
 *
 * - `ElementFingerprint` has no positional field, and `ElementFingerprintWeights`
 *   names nineteen signals of which none is positional. There is nothing to
 *   send them as.
 * - The one extensible slot Core does score is `attributes`, weight 6 of 292.
 *   Wired through it, two identical row actions score 1.0000 and 0.9630 --
 *   0.0370 apart, against the 0.2 `TARGET_SCORE_MARGIN` a winner must beat the
 *   runner-up by. Even in the best case the slot allows, where only the recorded
 *   row carries the attributes at all, the separation is 0.0900. Both outcomes
 *   are `ambiguous`, which is what they already are without it.
 *
 * So sending them would add a signal to every candidate on every resolution and
 * change no decision. They are captured for a reader that can use them: the LLM
 * evidence packet carries them per element as `item` and `cell`
 * (`domain/src/runtime/llm-evidence/elements.ts`). Making a grid row resolvable
 * by position needs a positional signal *in Core's matcher*, with weight enough
 * to clear the margin -- a Core change, not a wiring change here.
 */
export function candidateFingerprint(element: Element, index: number): ElementFingerprintCandidate {
  const tagName = element.tagName.toLowerCase();
  const testId = candidateTestId(element);
  const id = element.id || undefined;
  const role = element.getAttribute("role")?.trim().toLowerCase() || implicitRole(element);
  const classNames = [...element.classList];
  const selector = candidateSelector(element, tagName, id, testId);
  const visibleText = boundedText(element.textContent, MAX_SIGNAL_LENGTH);
  const accessibleName = accessibleNameFor(element);
  const label = labelText(element);
  const rect = element.getBoundingClientRect();
  return {
    candidateId: testId ?? id ?? `${tagName}:${index}`,
    tagName,
    ...(role ? { role } : {}),
    ...(id ? { id } : {}),
    ...(testId ? { testId } : {}),
    ...(classNames.length ? { classNames } : {}),
    ...(selector ? { selector } : {}),
    ...(visibleText ? { visibleText } : {}),
    ...(accessibleName ? { accessibleName } : {}),
    ...(label ? { label } : {}),
    bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    isVisibleOnViewport: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight
  };
}

/**
 * A short, stable name for a candidate in a failure message: enough for a
 * person reading the failure to find the element on the page, bounded so a
 * list of them still fits Core's record limit.
 *
 * The tag and the identifier are always given -- they are what make two
 * candidates distinguishable and neither is page content. The text is given
 * only when it is the element's own label; `reportable-text.ts` owns that
 * judgement and says why. This string reaches a Flow on a failure record with
 * no element descriptor beside it, so nothing downstream can redact it.
 */
export function candidateLabel(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  const testId = candidateTestId(element);
  const identifier = testId ? `[data-testid="${testId}"]` : element.id ? `#${element.id}` : "";
  const text = reportableText(element, MAX_LABEL_LENGTH);
  return `${tagName}${identifier}${text ? ` "${text}"` : ""}`;
}

/**
 * The author's test id, in the order the common tools write one.
 *
 * `describe-element.ts` owns the producer-side copy of this rule as `testIdFor`
 * and the two must name the same attributes. It is not imported:
 * `describe-element.ts` imports the identity barrel, so importing it back from
 * here would invert the descriptor's dependency on `identity/` and close a
 * cycle through that barrel. Moving `testIdFor` into this directory is the real
 * fix and belongs to whichever change next owns `describe-element.ts`.
 */
function candidateTestId(element: Element): string | undefined {
  return element.getAttribute("data-testid") ??
    element.getAttribute("data-test") ??
    element.getAttribute("data-cy") ??
    undefined;
}

/** The most stable selector the candidate can offer, matching how a descriptor names one. */
function candidateSelector(element: Element, tagName: string, id: string | undefined, testId: string | undefined): string | undefined {
  if (id) return `#${id}`;
  if (testId) return `[data-testid="${testId}"]`;
  const name = element.getAttribute("name");
  return name ? `${tagName}[name="${name}"]` : undefined;
}

/** Same tag, or same role, counting the role the markup implies as well as the one it declares. */
function inFamily(element: Element, tagName: string | undefined, role: string | undefined): boolean {
  if (!tagName && !role) return true;
  if (tagName && element.tagName.toLowerCase() === tagName) return true;
  if (!role) return false;
  const declared = element.getAttribute("role")?.trim().toLowerCase();
  return declared === role || implicitRole(element) === role;
}

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
// a full-document walk.

import type { ElementFingerprintCandidate } from "fluxiq/automation-studio";
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

/** What the recorded target looked like, as far as enumeration needs to know. */
export type CandidateFamily = {
  /** The recorded tag name, lowercased. A candidate sharing it is in the family. */
  tagName?: string | undefined;
  /** The recorded ARIA role, explicit or implicit. A candidate sharing it is in the family. */
  role?: string | undefined;
};

/** Nodes examined before enumeration gives up. A resolution is on every action's critical path. */
const MAX_SCANNED = 600;
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
 * The candidates in this document that share the recorded target's tag or role
 * family, in document order, capped.
 *
 * "Family" is deliberately loose: a `<button>` that became a `<div role=
 * "button">` is the same control to a person, and a resolver that insisted on
 * the tag would never find it. Where the family names neither a tag nor a role
 * -- a target recorded with no such signal -- every interactive element is in
 * scope, because nothing has been said that could exclude one.
 */
export function collectTargetCandidates(family: CandidateFamily, root: Document = document): TargetCandidate[] {
  const tagName = family.tagName?.toLowerCase();
  const role = family.role?.toLowerCase();
  const candidates: TargetCandidate[] = [];
  let scanned = 0;
  for (const element of root.querySelectorAll(CANDIDATE_SELECTOR)) {
    scanned += 1;
    if (scanned > MAX_SCANNED) break;
    if (!inFamily(element, tagName, role)) continue;
    candidates.push({ element, fingerprint: candidateFingerprint(element, candidates.length) });
    if (candidates.length >= MAX_CANDIDATES) break;
  }
  return candidates;
}

/**
 * How an element describes itself to Core's matcher: the same identity signals
 * `describe-element.ts` puts on the wire, under the names Core weighs them by.
 *
 * `index` only backs the candidate id when the page offers no stable one; Core
 * uses that id to name the winner, never to score it, so a positional fallback
 * cannot influence which candidate is chosen.
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

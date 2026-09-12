import { stateBounds } from "../geometry";
import type { WebAutomationElementStateInput } from "../types";
import { elementStateIdAssigner, meaningfulText, stableAttribute } from "./identity";
import { isLikelyActionableElement, isLikelyInteractableElement, isPrimaryControlElement, isSemanticTextElement } from "./kind";

// Which of a page's elements enter state, and what each is called there.
//
// A page routinely offers more elements than a state snapshot should carry, so
// this is a ranking under a cap, not a filter: capture-worthy elements are
// ordered by how likely a Flow is to need them and the first `limit` are kept.
// The selection reports what it did -- how many the page offered, how many were
// worth capturing, how many fit -- because a consumer reading `elements.*`
// cannot otherwise tell an exhaustive list from a truncated one, and the
// element the Flow wanted may be the one the cap dropped.

export const MAX_STATE_ELEMENTS = 1_500;

// The keys the snapshot's own summary occupies inside `elements.*`. They are
// listed here because this is what hands out element keys: a page shipping
// `data-testid="count"` would otherwise be filed at `elements.count` and
// overwrite the element count with a JSON blob. Every summary path
// `snapshot.ts` writes has to appear here, including the two that name which
// cap truncated the list.
export const WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS = ["count", "captured", "truncated", "captureTruncated", "stateTruncated"] as const;

// An element together with the key it is filed under in `elements.*`. The key
// is unique across a selection and is the only one anything may use: rebuilding
// it per element would drop the positional suffix that separates repeats.
export type WebAutomationStateElement = {
  element: WebAutomationElementStateInput;
  stateId: string;
};

export type WebAutomationStateElementSelection = {
  // Kept elements, most relevant first, each with its assigned state key.
  elements: WebAutomationStateElement[];
  // Every element the page offered, before any filtering. This is what
  // `elements.count` reports.
  total: number;
  // How many were worth capturing, before the cap.
  eligible: number;
  // How many are represented in state. Equal to `elements.length`.
  captured: number;
  // This projection's own cap dropped elements that were worth capturing --
  // the `stateTruncated` limit, written to `elements.stateTruncated`. Distinct
  // from `captured < total`, which is the ordinary case of a page full of
  // layout nodes that carry no evidence, and distinct from the browser's own
  // cap, which cut before any of this ran. Legal as a bare `truncated` here
  // because it sits beside the counts of the one cap that set it; the rule is
  // in `../evidence/input.ts`.
  truncated: boolean;
};

// Worth a state entry: it occupies space on the page, and it either behaves
// like a control with something to identify it by, or carries text, a value or
// a link a Flow could assert on.
export function shouldCaptureElementState(element: WebAutomationElementStateInput): boolean {
  if (!hasElementBounds(element)) return false;
  return Boolean(
    (isLikelyInteractableElement(element) && hasMeaningfulElementIdentity(element)) ||
    meaningfulText(element.text) ||
    meaningfulText(element.visibleText) ||
    meaningfulText(element.name) ||
    meaningfulText(element.value) ||
    meaningfulText(element.href)
  );
}

// Rank the page's elements, keep what fits, and name what is kept.
export function filterStateElements(
  elements: readonly WebAutomationElementStateInput[],
  limit = MAX_STATE_ELEMENTS
): WebAutomationStateElementSelection {
  const eligible = elements
    .map((element, documentIndex) => ({ element, documentIndex }))
    .filter((entry) => shouldCaptureElementState(entry.element));
  const ranked = [...eligible].sort((left, right) =>
    stateElementBucket(left.element) - stateElementBucket(right.element) ||
    stateElementScore(right.element) - stateElementScore(left.element)
  );
  // `rank` remembers relevance order so the keys can be assigned in document
  // order -- the only order under which a positional suffix means anything --
  // and the results still come back most relevant first.
  const kept = ranked.slice(0, Math.max(0, limit)).map((entry, rank) => ({ ...entry, rank }));
  kept.sort((left, right) => left.documentIndex - right.documentIndex);
  const assignStateId = elementStateIdAssigner(WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS);
  const named = kept.map((entry) => ({ element: entry.element, stateId: assignStateId(entry.element), rank: entry.rank }));
  named.sort((left, right) => left.rank - right.rank);
  return {
    elements: named.map(({ element, stateId }) => ({ element, stateId })),
    total: elements.length,
    eligible: eligible.length,
    captured: named.length,
    truncated: eligible.length > named.length
  };
}

// Coarse relevance, applied before the fine-grained score. A bucket is a
// statement about what an element is for; the score only orders within one.
function stateElementBucket(element: WebAutomationElementStateInput): number {
  if (isPrimaryControlElement(element) && hasMeaningfulElementIdentity(element)) return 0;
  if (isLikelyInteractableElement(element) && hasMeaningfulElementIdentity(element)) return 1;
  if (isSemanticTextElement(element) && hasTextualElementIdentity(element)) return 2;
  if (hasTextualElementIdentity(element)) return 3;
  if (meaningfulText(element.href)) return 4;
  return 5;
}

function stateElementScore(element: WebAutomationElementStateInput): number {
  let score = 0;
  if (isLikelyInteractableElement(element)) score += 200;
  if (isLikelyActionableElement(element)) score += 100;
  if (hasStableElementIdentity(element)) score += 60;
  if (meaningfulText(element.name)) score += 45;
  if (meaningfulText(element.value)) score += 35;
  if (meaningfulText(element.text) || meaningfulText(element.visibleText)) score += 25;
  const bounds = element.documentBounds ?? element.bounds;
  if (bounds) score += Math.min(20, Math.sqrt(bounds.width * bounds.height) / 8);
  return score;
}

// Anything to call the element by. An interactive element with no identity of
// any kind cannot be described to a model or matched later, so capturing it
// spends budget on a row nothing can use.
function hasMeaningfulElementIdentity(element: WebAutomationElementStateInput): boolean {
  return hasStableElementIdentity(element) ||
    hasTextualElementIdentity(element) ||
    meaningfulText(element.href);
}

function hasTextualElementIdentity(element: WebAutomationElementStateInput): boolean {
  return meaningfulText(element.text) ||
    meaningfulText(element.visibleText) ||
    meaningfulText(element.name) ||
    meaningfulText(element.value);
}

function hasStableElementIdentity(element: WebAutomationElementStateInput): boolean {
  return Boolean(
    stableAttribute(element, "data-testid") ||
    stableAttribute(element, "data-test") ||
    stableAttribute(element, "data-cy") ||
    stableAttribute(element, "aria-label") ||
    stableAttribute(element, "name") ||
    stableAttribute(element, "id")
  );
}

function hasElementBounds(element: WebAutomationElementStateInput): boolean {
  return stateBounds(element.documentBounds ?? element.bounds) !== undefined;
}

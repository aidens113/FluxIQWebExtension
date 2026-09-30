// Whether the page is still working.
//
// A snapshot taken mid-flight looks exactly like a snapshot of a page that has
// settled, and the difference decides whether a missing element is a failure or
// a race. Four independent signals answer it, and they are kept separate rather
// than collapsed into one boolean because they fail differently: the document's
// own `readyState`, the regions the author marked `aria-busy`, the progress
// bars and spinners on screen, and a live region whose words say it is loading.
//
// The spinner heuristic is a heuristic, so it is bounded on both sides: an
// element qualifies only if its own class, id or test id names it as one *and*
// it is actually painted, which keeps the permanently-present-but-empty
// progress container of a fixture or a real page out of the evidence. That is
// a rule about what counts as a loading signal, not a bound on the page: every
// element, painted or not, is in the snapshot's element list.
//
// Every indicator and every busy region is reported, in composed document
// order, open shadow roots included (t200): there was a cap of eight of each,
// and a label cut to 120 characters. The words of a live region -- asked
// whether they say it is loading, and read as an indicator's label -- are read
// through `textOutsideSensitiveControls` (`../sensitive-text.ts`), so a status
// message holding a sensitive control's contents does not quote them.

import { selectorFor } from "../selector";
import { accessibleNameFor, normalizedText } from "../identity";
import { textOutsideSensitiveControls } from "../sensitive-text";
import { composedClosest, queryComposedInOrder } from "../shadow-dom";
import { present } from "../../shared/present";
import type { LoadingEvidence, LoadingIndicator } from "./types";

const BUSY_SELECTOR = "[aria-busy='true']";
const PROGRESS_SELECTOR = "progress,[role='progressbar']";
const SPINNER_SELECTOR = "[class*='spinner'],[class*='loader'],[class*='loading'],[class*='skeleton'],[id*='spinner'],[id*='loading'],[data-testid*='spinner'],[data-testid*='loading']";
const STATUS_SELECTOR = "[role='status'],[role='alert'],[aria-live='polite'],[aria-live='assertive']";
const LOADING_WORDS = /\b(loading|saving|submitting|processing|uploading|refreshing|updating|working|please wait)\b/iu;

export function loadingEvidence(): LoadingEvidence {
  const documentState = document.readyState;
  const busyRegions = queryComposedInOrder(BUSY_SELECTOR).filter(isPainted).map((element) => selectorFor(element));
  const indicators = loadingIndicators();
  const pendingNavigation = documentState !== "complete";
  return present<LoadingEvidence>({
    documentState,
    busy: pendingNavigation || busyRegions.length > 0 || indicators.length > 0,
    busyRegions,
    indicators,
    pendingNavigation
  });
}

/** Every painted indicator, in document order, each named by the first kind that claims it. */
function loadingIndicators(): LoadingIndicator[] {
  const indicators: LoadingIndicator[] = [];
  for (const element of queryComposedInOrder(`${PROGRESS_SELECTOR},${STATUS_SELECTOR},${SPINNER_SELECTOR}`)) {
    if (!isPainted(element)) continue;
    const kind = indicatorKind(element);
    if (kind) indicators.push(indicator(element, kind));
  }
  return indicators;
}

/**
 * A progress bar is one by markup. A live region whose words say it is loading
 * is the author telling a reader directly, so it is asked before the class-name
 * heuristic can call the same element a spinner; a live region that says
 * nothing of the kind may still be one.
 */
function indicatorKind(element: Element): LoadingIndicator["kind"] | undefined {
  if (element.matches(PROGRESS_SELECTOR)) return "progressbar";
  if (element.matches(STATUS_SELECTOR) && LOADING_WORDS.test(textOutsideSensitiveControls(element))) return "status";
  return element.matches(SPINNER_SELECTOR) ? "spinner" : undefined;
}

function indicator(element: Element, kind: LoadingIndicator["kind"]): LoadingIndicator {
  const label = accessibleNameFor(element) ?? normalizedText(textOutsideSensitiveControls(element));
  return present<LoadingIndicator>({ selector: selectorFor(element), kind, label: label || undefined });
}

/** On screen in the sense that matters here: rendered, not hidden, and occupying space. */
function isPainted(element: Element): boolean {
  if (composedClosest(element, "[hidden],[aria-hidden='true']")) return false;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width >= 1 && rect.height >= 1;
}

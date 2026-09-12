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
// progress container of a fixture or a real page out of the evidence.

import { selectorFor } from "../describe-element";
import { accessibleNameFor, boundedText } from "../identity";
import { present } from "../../shared/present";
import type { LoadingEvidence, LoadingIndicator } from "./types";

const MAX_INDICATORS = 8;
const MAX_BUSY_REGIONS = 8;
const MAX_LABEL_LENGTH = 120;
const BUSY_SELECTOR = "[aria-busy='true']";
const PROGRESS_SELECTOR = "progress,[role='progressbar']";
const SPINNER_SELECTOR = "[class*='spinner'],[class*='loader'],[class*='loading'],[class*='skeleton'],[id*='spinner'],[id*='loading'],[data-testid*='spinner'],[data-testid*='loading']";
const STATUS_SELECTOR = "[role='status'],[role='alert'],[aria-live='polite'],[aria-live='assertive']";
const LOADING_WORDS = /\b(loading|saving|submitting|processing|uploading|refreshing|updating|working|please wait)\b/iu;

export function loadingEvidence(): LoadingEvidence {
  const documentState = document.readyState;
  const busyRegions = selectors(BUSY_SELECTOR, MAX_BUSY_REGIONS);
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

function loadingIndicators(): LoadingIndicator[] {
  const found = new Map<Element, LoadingIndicator>();
  for (const element of document.querySelectorAll(PROGRESS_SELECTOR)) {
    if (isPainted(element)) found.set(element, indicator(element, "progressbar"));
  }
  // A live region whose words say it is loading is the author telling a reader
  // directly, so it is read before the class-name heuristic can call the same
  // element a spinner.
  for (const element of document.querySelectorAll(STATUS_SELECTOR)) {
    if (found.has(element) || !isPainted(element)) continue;
    if (!LOADING_WORDS.test(element.textContent ?? "")) continue;
    found.set(element, indicator(element, "status"));
  }
  for (const element of document.querySelectorAll(SPINNER_SELECTOR)) {
    if (!found.has(element) && isPainted(element)) found.set(element, indicator(element, "spinner"));
  }
  return [...found.values()].slice(0, MAX_INDICATORS);
}

function indicator(element: Element, kind: LoadingIndicator["kind"]): LoadingIndicator {
  const label = accessibleNameFor(element) ?? boundedText(element.textContent, MAX_LABEL_LENGTH);
  return present<LoadingIndicator>({ selector: selectorFor(element), kind, label: label || undefined });
}

function selectors(selector: string, max: number): string[] {
  const found: string[] = [];
  for (const element of document.querySelectorAll(selector)) {
    if (!isPainted(element)) continue;
    found.push(selectorFor(element));
    if (found.length >= max) break;
  }
  return found;
}

/** On screen in the sense that matters here: rendered, not hidden, and occupying space. */
function isPainted(element: Element): boolean {
  if (element.closest("[hidden],[aria-hidden='true']")) return false;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width >= 1 && rect.height >= 1;
}

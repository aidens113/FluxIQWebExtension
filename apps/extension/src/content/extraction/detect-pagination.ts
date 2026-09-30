// How a list continues past the page it is showing, detected from the controls
// around it (C4).
//
// The search starts at the element holding the run and walks outward, because a
// pagination nav sits beside a list rather than inside it. Controls inside the
// run's own items are never candidates: a product card's own link is not a way
// to the next page. The first level of the page that offers a control answers,
// and what it offers is read in this order:
//
// - `a[rel~="next"]`, or a control labelled "Next" or "Next page", gives `next`;
// - "Load more" or "Show more" gives `loadMore`;
// - a run of controls labelled with digits gives `numbered`, its `pages`
//   selector naming exactly that run.
//
// **`scroll` is never detected.** An infinite feed looks like an ordinary list
// that happens to end, so proposing a scroll would propose scrolling every list
// the page shows. Only the user picks it (the proposal contract says so).
//
// `maxPages` is what the page itself advertises -- the number of numbered page
// controls it shows -- or the domain's own page bound when the page advertises
// nothing. The user confirms it in the picker before anything runs, and the
// page holds it to `WEB_AUTOMATION_EXTRACT_MAX_PAGES` in either case.
//
// A control's label is its `aria-label` or its text, read through the one
// sensitive-text reader and used only to recognize the control. No label
// reaches the proposal (decision D3): what travels is the selector.

import { webAutomationItemSignature, type WebAutomationExtractListPagination } from "@fluxiq-web-extension/domain/client";
import { testIdFor } from "../describe-element";
import { selectorFor } from "../selector";
import { textOutsideSensitiveControls } from "../sensitive-text";
import { generalizedItemSelector } from "./item-selector";

/** What a control offers, when its label says. */
export type PaginationControlKind = "next" | "loadMore";

/** Everything a page uses as a pagination control. */
const CONTROL_SELECTOR = 'a,button,[role="button"],[role="link"]';

/** How far out from the list the search goes before giving up. */
const MAX_ANCESTOR_LEVELS = 6;

const NEXT_LABEL = /^next\b|\bnext\s+page\b/u;
const LOAD_MORE_LABEL = /\b(?:load|show|view)\s+more\b/u;

/**
 * What a control labelled this way offers, or `undefined` when its label says
 * nothing about pagination. Pure: the label and `rel` are read off the control
 * by `detectPagination`.
 */
export function paginationKindForLabel(label: string, rel: string | undefined): PaginationControlKind | undefined {
  if (rel !== undefined && rel.trim().toLowerCase().split(/\s+/u).includes("next")) return "next";
  const text = label.replace(/\s+/gu, " ").trim().toLowerCase();
  if (!text) return undefined;
  if (NEXT_LABEL.test(text)) return "next";
  if (LOAD_MORE_LABEL.test(text)) return "loadMore";
  return undefined;
}

/**
 * How many pages a proposal asks for: the one in front of it.
 *
 * This used to be every page the pager showed -- the count of its numbered
 * controls, or the domain's ceiling when it had none -- and that is the
 * detector answering a question only the instruction can answer. How a list
 * continues is a fact about the page, and how much of it to take is a fact
 * about what was asked for; proposing the maximum silently turns the first into
 * the second.
 *
 * Measured on 2026-09-24: `product-catalog-first-page-reworded-prices` and
 * `product-catalog-first-page-sparse-cards` each built a Flow whose single
 * `web.dom.extract_list` carried this proposal, walked all three catalog pages
 * and returned 23 records where the instruction said first page and the
 * expectation held 8. Two of the three runs that completed that day failed for
 * this and nothing else -- the extension read both pages perfectly, every
 * in-scope record matching field for field.
 *
 * So a proposal now asks for the page it is looking at, and a read that wants
 * more says so. Nothing is hidden by the change: a read stopped by this bound
 * reports `truncated`, which is the loop's own word for "the list could have
 * gone on", so a Flow that should have taken more pages says it took fewer
 * rather than quietly answering short.
 */
export const PROPOSED_MAX_PAGES = 1;

/** How the run's list continues, or `undefined` when nothing around it says. */
export function detectPagination(run: readonly Element[], container: Element): WebAutomationExtractListPagination | undefined {
  let level: Element | null = container;
  for (let depth = 0; level && depth < MAX_ANCESTOR_LEVELS; depth += 1, level = level.parentElement) {
    const controls = Array.from(level.querySelectorAll(CONTROL_SELECTOR))
      .filter((control) => !run.some((item) => item === control || item.contains(control)));
    if (controls.length === 0) continue;
    const numbered = numberedControls(controls);
    const next = controls.find((control) => kindOf(control) === "next");
    if (next) return { mode: "next", next: selectorFor(next), maxPages: PROPOSED_MAX_PAGES };
    const loadMore = controls.find((control) => kindOf(control) === "loadMore");
    if (loadMore) return { mode: "loadMore", control: selectorFor(loadMore), maxPages: PROPOSED_MAX_PAGES };
    const pages = numbered.length > 1 ? generalizedItemSelector(numbered, selectorFor(level)) : undefined;
    if (pages) return { mode: "numbered", pages: pages.selector, maxPages: PROPOSED_MAX_PAGES };
  }
  return undefined;
}

function kindOf(control: Element): PaginationControlKind | undefined {
  const label = control.getAttribute("aria-label") ?? textOutsideSensitiveControls(control);
  return paginationKindForLabel(label, control.getAttribute("rel") ?? undefined);
}

/**
 * The biggest run of same-template controls whose labels are all digits: the
 * page's own numbered controls, which also say how many pages it has.
 */
function numberedControls(controls: readonly Element[]): Element[] {
  const byTemplate = new Map<string, Element[]>();
  for (const control of controls) {
    if (!isNumberLabelled(control)) continue;
    const signature = webAutomationItemSignature({
      tagName: control.tagName,
      role: control.getAttribute("role"),
      testId: testIdFor(control),
      classes: control.classList
    });
    byTemplate.set(signature, [...byTemplate.get(signature) ?? [], control]);
  }
  return [...byTemplate.values()].sort((left, right) => right.length - left.length)[0] ?? [];
}

function isNumberLabelled(control: Element): boolean {
  return /^\d+$/u.test(textOutsideSensitiveControls(control).trim());
}

// ## Which control a `next` read follows on the page it is on
//
// A proposal's `next` is `selectorFor` the control it saw, and where that
// control carries no id or test id the selector is a position:
// `nav > a:nth-of-type(6)`. A position holds only while the pager keeps it, and
// a pager that shows a different set of links on every page does not. The
// everything store's Previous is a link from page two on and plain text on page
// one, and the numbers it shows move with the page, so its Next is the fourth
// link on page one, the fifth on page two and the sixth on pages three and four.
// Live run `run-munv53gt-a0e6f545` authored its read while the store showed page
// three or four, got `a:nth-of-type(6)`, and played it back from page one, where
// that names nothing: one page read, stopped on `control_absent` -- the word for
// a list that ended -- while the page showed Next. Re-authored as
// `a:nth-of-type(4)`, the same read names Next on page one and "5" on page two.
//
// So the authored selector is where the read starts, not the last word, the way
// a click target is re-resolved when its selector drifts. It is followed as it
// is when it names a control that could be the way forward. When it names
// nothing, or names what is plainly another page's control -- a page number,
// the current page, Previous, First, Last -- the pager around it and around the
// list is asked for its own way forward: the control labelled Next or carrying
// `rel="next"`, a disabled one included, so a last page still ends on
// `control_disabled`; or, where the pager labels none, the numbered control
// after the one marked `aria-current`. Labels are read here only to recognize a
// control, as in detection (decision D3); none leaves the page.

/** How a `next` read found the control it follows: the authored selector, the pager's Next label, or the page number after the current one. */
export type NextControlSource = "selector" | "label" | "number";

/** The control a `next` read follows on this page, and how it was found. */
export type NextControlChoice = { control: Element; by: NextControlSource };

/**
 * What a pager's controls are when a read looks for its way forward: detection's
 * controls, and an element marked disabled, since a pager draws its last page's
 * Next as disabled text and that is the list ending rather than no pager at all.
 */
const PAGER_CONTROL_SELECTOR = `${CONTROL_SELECTOR},[aria-disabled="true"]`;

/**
 * A label that is the pager's Next and nothing else. Stricter than detection's
 * `NEXT_LABEL`, because a control found this way replaces the one the author
 * chose: "Next page", "Go to next page, page 2", "Next" and "Next ›" are a
 * pager's; "Next day delivery" and "Next slide" are not.
 */
const PAGER_NEXT_LABEL = /\bnext\s+page\b|^next\b[^\p{L}\p{N}]*$/u;

/** A label that plainly names another page: a number, the current or a numbered page, Previous, First, Last or Back. */
const OTHER_PAGE_LABEL = /^(?:(?:go\s+to\s+)?(?:current\s+)?page,?\s+(?:page\s+)?)?\d+$|\bprev(?:ious)?\b|\bfirst\b|\blast\b|\bback\b/u;

/**
 * The control a `next` read follows on this page, or `undefined` when neither
 * the authored control nor the pager offers a way forward. `named` is what the
 * authored selector names here (`null` for nothing) and `run` the items the
 * page shows; see the header above for the order it is decided in.
 */
export function nextControlOnPage(named: Element | null, run: readonly Element[]): NextControlChoice | undefined {
  if (named && !namesAnotherPage(named)) return { control: named, by: "selector" };
  const outsideRun = (element: Element): boolean => !run.some((item) => item === element || item.contains(element));
  // Around the authored control first, which is where its pager is when it
  // names one, then around the list, which is where it is when it names nothing.
  for (const start of [named?.parentElement ?? null, run[0]?.parentElement ?? null]) {
    let level: Element | null = start;
    for (let depth = 0; level && depth < MAX_ANCESTOR_LEVELS; depth += 1, level = level.parentElement) {
      const controls = Array.from(level.querySelectorAll(PAGER_CONTROL_SELECTOR)).filter(outsideRun);
      const labelled = controls.find(isPagerNext);
      if (labelled) return { control: labelled, by: "label" };
      const following = numberedAfterCurrent(level, controls, outsideRun);
      if (following) return { control: following, by: "number" };
    }
  }
  return undefined;
}

function labelOf(control: Element): string {
  return (control.getAttribute("aria-label") ?? textOutsideSensitiveControls(control)).replace(/\s+/gu, " ").trim().toLowerCase();
}

function isPagerNext(control: Element): boolean {
  const rel = control.getAttribute("rel");
  if (rel !== null && rel.trim().toLowerCase().split(/\s+/u).includes("next")) return true;
  return PAGER_NEXT_LABEL.test(labelOf(control));
}

/**
 * Whether the authored control is plainly not the way forward: it is marked as
 * the current page, or its label or text is a page number, Previous, First,
 * Last or Back. A control labelled next never is, and one whose label says
 * nothing a pager says -- an icon, a script's own button -- is the author's
 * choice and is followed.
 */
function namesAnotherPage(control: Element): boolean {
  if (kindOf(control) === "next") return false;
  if (isMarkedCurrent(control)) return true;
  return OTHER_PAGE_LABEL.test(labelOf(control)) || isNumberLabelled(control);
}

function isMarkedCurrent(element: Element): boolean {
  const current = element.getAttribute("aria-current");
  return current !== null && current !== "false";
}

/** The number an element shows as its whole text, or `undefined` for anything else. */
function shownNumber(element: Element): number | undefined {
  const text = textOutsideSensitiveControls(element).trim();
  return /^\d+$/u.test(text) ? Number(text) : undefined;
}

/**
 * The enabled control numbered one more than the page marked `aria-current` at
 * this level, or `undefined` when nothing there is marked or nothing follows it.
 * Only a marked page counts: a number merely drawn as text could be anything a
 * page shows beside its list.
 */
function numberedAfterCurrent(level: Element, controls: readonly Element[], outsideRun: (element: Element) => boolean): Element | undefined {
  const current = Array.from(level.querySelectorAll("[aria-current]")).find((element) => outsideRun(element) && isMarkedCurrent(element) && shownNumber(element) !== undefined);
  const number = current === undefined ? undefined : shownNumber(current);
  if (number === undefined) return undefined;
  return controls.find((control) => shownNumber(control) === number + 1 && control.getAttribute("aria-disabled") !== "true");
}

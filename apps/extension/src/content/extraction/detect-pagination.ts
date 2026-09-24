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

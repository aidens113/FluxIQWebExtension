// Whether the run's own section links to more of it: a "See all" beside the
// four friend requests a home page shows of eight (t195 w22e).
//
// Live run 36 (`run-muq3uozx-3153564b`, cause 11): Circleway's Friends home
// shows four request cards under a header whose "See all" opens the requests
// page, and the top bar's badge says 4. The badge and the cards agree with each
// other and not with the eight requests there are, and the model read the four
// as the whole list. The link was in the page view; nothing said what it meant.
//
// **The section is the run's own, never the page's.** It is found walking out
// from the element holding the items, one level at a time. At each level the
// band is the current element and its siblings that belong with it: backwards
// up to and including the nearest one holding a heading -- the section's own
// header -- and forwards up to the next one holding a heading. A sibling
// holding another run of three or more items of one template ends the band on
// its side, since past it is another list's section. The walk goes up a level
// only while the band is the whole of its parent: a band cut by a heading or
// another run, or one that holds the section's heading, is the section. So on
// the Friends home, where the main column is header, grid, header, grid, the
// requests' section is the first header and its grid, and the suggestions' the
// second; and a `<section>` wrapping its own heading and list is its own.
//
// **A section link is a control whose whole label is a closed phrase** -- see,
// view or show, then all or more (`webAutomationSectionLinkLabel`) -- outside
// every item, and apart from the run's own pagination control: a "Show more"
// the read already presses is how the list continues, not a hint that it does.
// Its label is the phrase and nothing else, so no page value crosses (D3); a
// link also carries its same-origin path.
//
// It is a hint beside the proposal, never pagination: the read does not follow
// it, and the domain only tells the model what the link means.

import { webAutomationSectionLinkLabel, type WebAutomationSectionContinuation } from "@fluxiq-web-extension/domain/client";
import { parsedUrl } from "../../../shared/parsed-url";
import { textOutsideSensitiveControls } from "../../sensitive-text";
import { isRecordItemTag, itemTemplateSignature } from "../infer-list";

/** How far out from the list the section is looked for; the pagination search goes as far. */
const MAX_SECTION_LEVELS = 6;

/** What the page's own repeating evidence calls a template rather than a coincidence. */
const MIN_ITEMS_PER_RUN = 3;

/** Elements walked under one band member, so a huge region costs a bounded walk. */
const MAX_WALKED_ELEMENTS = 5_000;

/** The longest path a section link carries; a longer one is left off. */
const MAX_PATH_LENGTH = 256;

const CONTROL_TAGS = new Set(["A", "BUTTON"]);
const CONTROL_ROLES = new Set(["button", "link"]);
const HEADING_TAG = /^H[1-6]$/u;

/**
 * The link to more of the run in its own section, or `undefined` when there is
 * none. `items` are the run's items, `container` the element holding them, and
 * `pagination` whatever the run's own pagination control names, which is
 * never reported.
 */
export function sectionContinuation(
  items: readonly Element[],
  container: Element,
  pagination: readonly Element[]
): WebAutomationSectionContinuation | undefined {
  const skipped = new Set<Element>(items);
  const isPagination = (control: Element): boolean => pagination.some((element) => element === control || element.contains(control) || control.contains(element));
  let scope = container;
  for (let level = 0; level < MAX_SECTION_LEVELS; level += 1) {
    const parent = scope.parentElement;
    const band = bandAround(scope, parent, skipped);
    for (const member of band.members) {
      const found = sectionLinkIn(member, skipped, isPagination);
      if (found) return found;
    }
    if (band.closed || !parent || isPageRoot(parent)) return undefined;
    scope = parent;
  }
  return undefined;
}

/** The band around `scope` among its parent's children, header first, and whether it is the whole section; see the header. */
function bandAround(scope: Element, parent: Element | null, skipped: ReadonlySet<Element>): { members: Element[]; closed: boolean } {
  if (!parent || holdsHeading(scope, skipped)) return { members: [scope], closed: true };
  const siblings = Array.from(parent.children);
  const at = siblings.indexOf(scope);
  const members = [scope];
  let closed = false;
  for (let index = at - 1; index >= 0; index -= 1) {
    const sibling = siblings[index]!;
    if (holdsRun(sibling)) {
      closed = true;
      break;
    }
    members.unshift(sibling);
    if (holdsHeading(sibling, skipped)) {
      closed = true;
      break;
    }
  }
  for (let index = at + 1; index < siblings.length; index += 1) {
    const sibling = siblings[index]!;
    if (holdsRun(sibling) || holdsHeading(sibling, skipped)) {
      closed = true;
      break;
    }
    members.push(sibling);
  }
  return { members, closed };
}

/** The first section link at or under `root`, in document order, outside every skipped element. */
function sectionLinkIn(root: Element, skipped: ReadonlySet<Element>, isPagination: (control: Element) => boolean): WebAutomationSectionContinuation | undefined {
  let found: WebAutomationSectionContinuation | undefined;
  walk(root, skipped, (element) => {
    if (!isControl(element) || isPagination(element)) return false;
    const label = closedLabelOf(element);
    if (label === undefined) return false;
    const path = pathOf(element);
    found = path === undefined ? { label } : { label, path };
    return true;
  });
  return found;
}

function isControl(element: Element): boolean {
  if (CONTROL_TAGS.has(element.tagName.toUpperCase())) return true;
  return CONTROL_ROLES.has((element.getAttribute("role") ?? "").trim().toLowerCase());
}

/** The control's accessible name or its text, when either is wholly a closed phrase. */
function closedLabelOf(control: Element): string | undefined {
  const named = control.getAttribute("aria-label");
  return (named === null ? undefined : webAutomationSectionLinkLabel(named)) ?? webAutomationSectionLinkLabel(textOutsideSensitiveControls(control));
}

/** A link's path on this page's origin, or `undefined` for a button, another origin, or anything unparseable. */
function pathOf(control: Element): string | undefined {
  const href = control.tagName.toUpperCase() === "A" ? control.getAttribute("href") : null;
  if (href === null || href.trim() === "") return undefined;
  const base = parsedUrl(control.baseURI);
  const url = base === undefined ? undefined : parsedUrl(href, base.href);
  if (!base || !url || (url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== base.origin) return undefined;
  return url.pathname.length <= MAX_PATH_LENGTH ? url.pathname : undefined;
}

/** Whether the element or anything under it, outside the skipped elements, is a heading. */
function holdsHeading(element: Element, skipped: ReadonlySet<Element>): boolean {
  return walk(element, skipped, (current) => HEADING_TAG.test(current.tagName.toUpperCase()) || (current.getAttribute("role") ?? "").trim().toLowerCase() === "heading");
}

/** Whether the element or anything under it holds a run: three or more children of one item template (`../largest-runs.ts`). */
function holdsRun(element: Element): boolean {
  return walk(element, new Set(), (current) => {
    if (current.children.length < MIN_ITEMS_PER_RUN) return false;
    const counts = new Map<string, number>();
    for (const child of current.children) {
      if (!isRecordItemTag(child.tagName)) continue;
      const signature = itemTemplateSignature(child);
      const count = (counts.get(signature) ?? 0) + 1;
      if (count >= MIN_ITEMS_PER_RUN) return true;
      counts.set(signature, count);
    }
    return false;
  });
}

/**
 * Visits `root` and everything under it in document order, not entering a
 * skipped element, until `visit` answers true or the walk's bound is reached.
 * Whether `visit` ever answered true.
 */
function walk(root: Element, skipped: ReadonlySet<Element>, visit: (element: Element) => boolean): boolean {
  const pending: Element[] = [root];
  let walked = 0;
  while (pending.length > 0 && walked < MAX_WALKED_ELEMENTS) {
    const element = pending.pop()!;
    if (skipped.has(element)) continue;
    walked += 1;
    if (visit(element)) return true;
    const children = Array.from(element.children);
    for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
  }
  return false;
}

function isPageRoot(element: Element): boolean {
  const tag = element.tagName.toUpperCase();
  return tag === "BODY" || tag === "HTML";
}

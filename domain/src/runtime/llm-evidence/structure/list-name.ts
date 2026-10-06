// What a detected list is called, when the page itself says so: the name a
// detection's answer carries as `list` (`./packet.ts`), so the chat's card for
// the detection reads "Look · the “Search results” list" rather than "Look ·
// the repeating list on the page" (R2-U-9, live run `run-muwansvz-a2b4a987`
// moment 04).
//
// The name is page structure the page gave the list, read in the detection's
// own capture, in this order, nearest first:
//
// - the list container's accessible name, from its own `aria-label` or the
//   elements its `aria-labelledby` names;
// - a table container's `<caption>`;
// - the heading straight before the container: its previous sibling when that
//   is a heading, or ends in one (a header block whose last element is the
//   heading);
// - then the same for each ancestor up to three levels out, stopping at
//   `main`, `body` or `html`: a `<section aria-label="Search results">` round
//   the list, or an `<h2>` before the block the list sits in.
//
// Only the immediate previous sibling is looked at, never the nearest heading
// anywhere before: a filter sidebar's "Filters" heading lies before a results
// list in document order, and is not its name. Nothing is guessed: a list with
// no such label -- live run `run-muwansvz-a2b4a987` put its results in an
// unlabelled `main` with no heading of its own -- has no name, and the chat
// keeps its plain words. The label is screened as every page string the
// domain publishes, one line, and dropped when it is withheld, empty or longer
// than `MAX_LIST_NAME`; no other page text is read or sent.

import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { isWithheldText, screenedPageText } from "../withheld";

/** The longest name a list is given; a longer label is not a name. */
const MAX_LIST_NAME = 60;
/** How many ancestors out from the container are looked at. */
const ANCESTOR_LEVELS = 3;
/** The elements past which nothing names one list. */
const PAGE_ROOTS: ReadonlySet<string> = new Set(["main", "body", "html"]);
const HEADING_TAG = /^h[1-6]$/u;
/** How deep into a previous sibling its last element is followed to a heading. */
const HEADER_DEPTH = 2;

/** The page's own name for the list whose container the detection names, or `undefined` when it gives none. */
export function webLlmStructureListName(detected: WebLlmSnapshotBinding, container: string): string | undefined {
  const page = pageOf(detected);
  let node = page.addressed(container);
  for (let level = 0; node !== undefined && level <= ANCESTOR_LEVELS; level += 1) {
    const said = ariaName(page, node) ?? (level === 0 ? caption(page, node) : undefined) ?? headingBefore(page, node);
    if (said !== undefined) return said;
    if (PAGE_ROOTS.has(node.tag.toLowerCase())) return undefined;
    node = page.parent(node);
  }
  return undefined;
}

type Page = {
  addressed(selector: string): WebLlmEvidenceElement | undefined;
  parent(element: WebLlmEvidenceElement): WebLlmEvidenceElement | undefined;
  children(element: WebLlmEvidenceElement): readonly WebLlmEvidenceElement[];
  byId(id: string): WebLlmEvidenceElement | undefined;
};

/** The capture's own document, as elements by handle, selector, parent and `id`. A child frame merged into it is another document. */
function pageOf(binding: WebLlmSnapshotBinding): Page {
  const own = binding.evidence.elements.filter((element) => (element.frameId ?? 0) === 0);
  const byHandle = new Map(own.map((element) => [element.target, element]));
  const children = new Map<string, WebLlmEvidenceElement[]>();
  const ids = new Map<string, WebLlmEvidenceElement[]>();
  for (const element of own) {
    if (element.parent !== undefined) children.set(element.parent, [...(children.get(element.parent) ?? []), element]);
    const id = attribute(element, "id");
    if (id !== undefined) ids.set(id, [...(ids.get(id) ?? []), element]);
  }
  return {
    addressed: (selector) => {
      const found = own.filter((element) => binding.selectors.get(element.target) === selector);
      return found.length === 1 ? found[0] : undefined;
    },
    parent: (element) => (element.parent === undefined ? undefined : byHandle.get(element.parent)),
    children: (element) => children.get(element.target) ?? [],
    byId: (id) => {
      const found = ids.get(id) ?? [];
      return found.length === 1 ? found[0] : undefined;
    }
  };
}

/** The element's own `aria-label`, else the words of the elements its `aria-labelledby` names. */
function ariaName(page: Page, element: WebLlmEvidenceElement): string | undefined {
  const label = named(attribute(element, "aria-label"));
  if (label !== undefined) return label;
  const ids = attribute(element, "aria-labelledby")?.split(/\s+/u).filter(Boolean) ?? [];
  const words = ids.map((id) => page.byId(id)).map((labelling) => (labelling === undefined ? undefined : wordsOf(labelling)));
  return words.length > 0 && words.every((word) => word !== undefined) ? named(words.join(" ")) : undefined;
}

/** A table's caption: its first element, when that is one. */
function caption(page: Page, element: WebLlmEvidenceElement): string | undefined {
  const first = page.children(element)[0];
  return first !== undefined && first.tag.toLowerCase() === "caption" ? named(wordsOf(first)) : undefined;
}

/** The heading straight before the element: its previous sibling, or the last element that sibling ends in. */
function headingBefore(page: Page, element: WebLlmEvidenceElement): string | undefined {
  const parent = page.parent(element);
  if (parent === undefined) return undefined;
  const siblings = page.children(parent);
  let before = siblings[siblings.indexOf(element) - 1];
  for (let depth = 0; before !== undefined && depth <= HEADER_DEPTH; depth += 1) {
    if (heading(before)) return named(wordsOf(before));
    before = page.children(before).at(-1);
  }
  return undefined;
}

function heading(element: WebLlmEvidenceElement): boolean {
  return HEADING_TAG.test(element.tag.toLowerCase()) || element.role === "heading";
}

function wordsOf(element: WebLlmEvidenceElement): string | undefined {
  return element.name ?? element.text;
}

/** A label as a list's name: screened, one line, and short; `undefined` when it is none. */
function named(text: string | undefined): string | undefined {
  const said = screenedPageText(text);
  if (said === undefined || isWithheldText(said)) return undefined;
  const line = said.replace(/\s+/gu, " ").trim();
  return line !== "" && line.length <= MAX_LIST_NAME ? line : undefined;
}

function attribute(element: WebLlmEvidenceElement, name: string): string | undefined {
  return element.attributes?.find(([key]) => key.toLowerCase() === name)?.[1];
}

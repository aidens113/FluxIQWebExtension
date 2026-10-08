// What the page holds of a text a wait or a text assertion failed to see
// (t369, `domain/src/actions/text-sighting.ts`).
//
// Read once, after the wait has already failed, so it never decides an
// outcome and costs nothing on a wait that succeeds.
//
// - Shown: the body's rendered text (`innerText`, what `pageText()` and the
//   wait read) holds the text, whitespace collapsed. Then there is nothing to
//   explain -- a scoped assertion failed on its element while the page shows
//   the text elsewhere -- and the answer is `undefined`.
// - Hidden: the document's text nodes hold it, scripts, styles and templates
//   left out, but the page does not show it: a closed flyout, a collapsed
//   panel, a `display: none` mini-cart.
// - Absent: neither.
//
// The snippets of shown text beside the answer are read one rendered text node
// at a time, widened to the inline run it sits in, so a snippet is a line a
// person sees rather than a whole section. A text node inside a control the
// sensitivity rule marks (`isSensitiveFormControl`: a password, a one-time
// code, a card field, anything marked `data-sensitive`) is never read, and a
// run that contains one falls back to the node's own text. A field's value is
// never read at all: `innerText` and text nodes do not carry it.

import type { WebAutomationTextSighting } from "@fluxiq-web-extension/domain/client";
import { isSensitiveFormControl } from "../../element-traits";
import { nearestSnippets } from "./nearest-snippets";

/** Elements whose text is not page text. */
const NOT_PAGE_TEXT = "script, style, noscript, template";
/** A run wider than this is a section, not a line: the node's own text stands in for it. */
const RUN_MAX_LENGTH = 200;
/** Enough shown text nodes to rank, on any page a person reads. */
const MAX_CANDIDATES = 4_000;

/** Whether the document shows, hides or lacks `wanted`, with the shown text most like it; `undefined` when it is shown or names nothing. */
export function sightText(wanted: string, root: Document = document): WebAutomationTextSighting | undefined {
  const needle = collapsed(wanted);
  if (!needle) return undefined;
  const body = root.body;
  if (!body) return { textPresence: "absent", visibleNear: [] };
  if (collapsed(body.innerText ?? "").includes(needle)) return undefined;
  const held = collapsed(documentText(body)).includes(needle);
  return { textPresence: held ? "hidden" : "absent", visibleNear: nearestSnippets(needle, shownSnippets(body)) };
}

function collapsed(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

/** The text nodes' text in document order, leaving out what is not page text. */
function documentText(body: HTMLElement): string {
  let text = "";
  for (const node of textNodes(body)) {
    if (node.parentElement?.closest(NOT_PAGE_TEXT)) continue;
    text += node.data;
  }
  return text;
}

function* textNodes(body: HTMLElement): Generator<Text> {
  const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) yield node as Text;
}

/** Each shown, non-sensitive text node as the line it reads in, in document order. */
function* shownSnippets(body: HTMLElement): Generator<string> {
  let read = 0;
  for (const node of textNodes(body)) {
    if (read >= MAX_CANDIDATES) return;
    const own = collapsed(node.data);
    const parent = node.parentElement;
    if (!own || !parent || parent.closest(NOT_PAGE_TEXT)) continue;
    if (withinSensitiveControl(parent, body) || !shown(parent)) continue;
    read += 1;
    yield lineOf(parent, body) ?? own;
  }
}

/** The text of the inline run `element` sits in, or `undefined` when that run is too wide or holds a sensitive control. */
function lineOf(element: HTMLElement, body: HTMLElement): string | undefined {
  let run: HTMLElement = element;
  const view = body.ownerDocument.defaultView;
  while (run.parentElement && run.parentElement !== body && view?.getComputedStyle(run).display.startsWith("inline")) run = run.parentElement;
  const text = collapsed(run.innerText ?? "");
  if (!text || text.length > RUN_MAX_LENGTH) return undefined;
  if ([...run.querySelectorAll("*")].some((inner) => isSensitiveFormControl(inner))) return undefined;
  return text;
}

function withinSensitiveControl(element: Element, body: HTMLElement): boolean {
  for (let current: Element | null = element; current && current !== body; current = current.parentElement) {
    if (isSensitiveFormControl(current)) return true;
  }
  return false;
}

/** Rendered and not made invisible: a box, not `visibility: hidden`, not fully transparent. */
function shown(element: Element): boolean {
  const checkable = element as unknown as { checkVisibility?: (options?: Record<string, boolean>) => boolean };
  if (typeof checkable.checkVisibility === "function") {
    return checkable.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true });
  }
  if (element.getClientRects().length === 0) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return style ? style.visibility !== "hidden" && style.visibility !== "collapse" && Number.parseFloat(style.opacity) !== 0 : true;
}

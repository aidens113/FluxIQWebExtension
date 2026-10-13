// The page view's header lines (t223, "Header lines"): each only when it has
// something to say, in this order.
//
//   PAGE "<title>"
//   URL <location written with ~>   (~ = <base>)
//   VIEW <w>x<h> at the top · <n> elements with visible words or a control, in page order · find_on_page searches the rest
//   COVERING <handle> "<name>" <kind> covers <n> close <handle> "<words>" · ...
//   DIALOG <handle> "<name>" modal <kind> · ...
//   LOADING <readyState> busy <kind> "<label>" ... pending-navigation
//   FRAMES <ids> did not answer
//   ARRIVED <type> <n> redirects from <referrer> at <url>
//   SELECTED "<text>"
//   CAPTURE incomplete: the browser left elements out
//
// These say what the dropped packet keys said: the title, the frame, loading,
// navigation, dialogs, blockers, selection and a short capture.
//
// **A cover is named from its own element (t486, N5).** Lane D's round 12
// build 2 (`run-mv636xyp-2e4fe54d`) said `COVERING t692` and nothing more: the
// blocker record carried only its handle, and t692 printed no line of its own.
// Where the capture describes the blocker's element, what the record leaves out
// is read from it: its name, else the first heading inside it, else its own
// words (cut to `MAX_COVER_WORDS`); its layer kind, else its role (the record's
// own role first: until t486 it was said only for a blocker with no handle,
// so N5's `role: "banner"` never reached the line); how many
// controls it covers; and the first control inside it whose words read as
// closing it (`CLOSE_WORDS`, the words `../node-run/covered-target.ts` closes a
// layer by), as `close <handle> "<words>"`.

import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmPageEvidence } from "../sanitize";
import { quotedWords, webLlmReadableWords } from "./element";
import { webLlmPageTree, type WebLlmPageTree } from "./page-tree";
import type { WebLlmLinkWriter } from "./link-writer";

/** The header lines for a page whose view has `lineCount` element lines. */
export function webLlmPageHeader(evidence: WebLlmPageEvidence, links: WebLlmLinkWriter, lineCount: number): string[] {
  const lines: Array<string | undefined> = [
    evidence.title === undefined ? undefined : `PAGE ${quotedWords(evidence.title)}`,
    `URL ${links.write(evidence.location)}   (~ = ${links.base})`,
    viewLine(evidence, lineCount),
    coveringLine(evidence),
    dialogLine(evidence),
    loadingLine(evidence),
    framesLine(evidence),
    arrivedLine(evidence, links),
    evidence.selectedText === undefined ? undefined : `SELECTED ${quotedWords(evidence.selectedText)}`,
    evidence.captureTruncated === true ? "CAPTURE incomplete: the browser left elements out" : undefined
  ];
  return lines.filter((line): line is string => line !== undefined);
}

function viewLine(evidence: WebLlmPageEvidence, lineCount: number): string {
  const scope = `${lineCount} elements with visible words or a control, in page order · find_on_page searches the rest`;
  const viewport = evidence.viewport;
  if (viewport === undefined) return `VIEW · ${scope}`;
  const scrolled = viewport.scrollX === 0 && viewport.scrollY === 0 ? "at the top"
    : viewport.scrollX === 0 ? `scrolled to y=${viewport.scrollY}`
    : `scrolled to x=${viewport.scrollX} y=${viewport.scrollY}`;
  return `VIEW ${viewport.width}x${viewport.height} ${scrolled} · ${scope}`;
}

/** The most of a cover's own words said, so a banner's whole text does not fill the header. */
const MAX_COVER_WORDS = 60;
/** The words a control that closes a layer is named with, at the start of its name (`../node-run/covered-target.ts`). */
const CLOSE_WORDS = /^\s*(?:×|✕|✖|x|close|dismiss|no,? thanks|not now|maybe later|skip|cancel|continue shopping|got it)(?![a-z])/iu;
const HEADING_TAG = /^h[1-6]$/u;

function coveringLine(evidence: WebLlmPageEvidence): string | undefined {
  const blockers = evidence.blockedBy ?? [];
  if (blockers.length === 0) return undefined;
  const byHandle = new Map(evidence.elements.map((element) => [element.target, element] as const));
  const tree = webLlmPageTree(evidence.elements);
  const entries = blockers.map((blocker) => {
    const cover = blocker.target === undefined ? undefined : byHandle.get(blocker.target);
    const name = blocker.name ?? (cover === undefined ? undefined : coverName(cover, evidence.elements, tree));
    const blocks = blocker.blocks ?? cover?.coversCount;
    const closer = cover === undefined ? undefined : closerOf(cover, evidence.elements, tree);
    return joined([
      blocker.target,
      name === undefined ? undefined : quotedWords(name),
      blocker.kind ?? cover?.kind ?? cover?.isDialog?.kind ?? blocker.role ?? cover?.role ?? cover?.implicitRole,
      blocks === undefined ? undefined : `covers ${blocks}`,
      closer === undefined ? undefined : `close ${closer.target} ${quotedWords(wordsOf(closer)!)}`
    ]) ?? blocker.role ?? "layer";
  });
  return `COVERING ${entries.join(" · ")}`;
}

/** What a cover is called: its name, the first heading inside it, or its own words, cut (header). */
function coverName(cover: WebLlmEvidenceElement, elements: readonly WebLlmEvidenceElement[], tree: WebLlmPageTree): string | undefined {
  const heading = elements.find((element) => (HEADING_TAG.test(element.tag) || element.role === "heading") && tree.isUnder(element, cover));
  const words = cover.name ?? (heading === undefined ? undefined : wordsOf(heading)) ?? wordsOf(cover);
  if (words === undefined) return undefined;
  const spaced = words.replace(/\s+/gu, " ").trim();
  if (spaced === "") return undefined;
  return spaced.length > MAX_COVER_WORDS ? `${spaced.slice(0, MAX_COVER_WORDS - 1)}…` : spaced;
}

/**
 * The first control inside a cover whose words read as closing it (header),
 * as `../node-run/covered-target.ts` names a layer's closers: a mark that is
 * only a closing word inside a pressable element of the cover counts, and a
 * closing element that holds another gives way to it -- a help card whose words
 * start with its "×" opens the widget when pressed; only the "×" closes it
 * (t507, `run-mv6qrcln-2e194a12` step 0008 named the card).
 */
function closerOf(cover: WebLlmEvidenceElement, elements: readonly WebLlmEvidenceElement[], tree: WebLlmPageTree): WebLlmEvidenceElement | undefined {
  const byHandle = new Map(elements.map((element) => [element.target, element] as const));
  const reads = (element: WebLlmEvidenceElement, words: RegExp): boolean => [wordsOf(element), element.label].some((said) => said !== undefined && words.test(said));
  const closers = elements.filter((element) => tree.isUnder(element, cover) && reads(element, CLOSE_WORDS)
    && (pressable(element) || (reads(element, CLOSE_MARK) && insidePressable(byHandle, element, cover.target))));
  return closers.find((closer) => !closers.some((other) => other !== closer && tree.isUnder(other, closer)));
}

/** A mark that is nothing but a closing word: a "×", a "Close" (`../node-run/covered-target.ts`). */
const CLOSE_MARK = /^\s*(?:×|✕|✖|x|close|dismiss)\s*$/iu;

/** How far up the `parent` chain an ancestor is looked for. */
const MOST_DEPTH = 40;

/** Whether a described ancestor of `element` below `cover` is pressable, so a press on it lands on that ancestor's listener. */
function insidePressable(byHandle: ReadonlyMap<string, WebLlmEvidenceElement>, element: WebLlmEvidenceElement, cover: string): boolean {
  let at = element.parent;
  for (let depth = 0; at !== undefined && at !== cover && depth < MOST_DEPTH; depth += 1) {
    const ancestor = byHandle.get(at);
    if (ancestor === undefined) return false;
    if (pressable(ancestor)) return true;
    at = ancestor.parent;
  }
  return false;
}

/** Whether a person would press it: a button or link, or something the page listens to or points at. */
function pressable(element: WebLlmEvidenceElement): boolean {
  const role = element.role ?? element.implicitRole;
  return element.tag === "button" || element.tag === "a" || role === "button" || role === "link" || element.hasClickHandler === true || element.cursor === "pointer";
}

/** An element's words as a reader sees them: its name, else its text. */
function wordsOf(element: WebLlmEvidenceElement): string | undefined {
  const words = element.name ?? element.text;
  return words === undefined || words.trim() === "" ? undefined : webLlmReadableWords(element, words);
}

function dialogLine(evidence: WebLlmPageEvidence): string | undefined {
  const entries = (evidence.dialogs ?? []).map((dialog) => joined([
    dialog.target,
    dialog.name === undefined ? undefined : quotedWords(dialog.name),
    dialog.modal === true ? "modal" : undefined,
    dialog.kind
  ]) ?? dialog.role ?? "dialog");
  return entries.length > 0 ? `DIALOG ${entries.join(" · ")}` : undefined;
}

function loadingLine(evidence: WebLlmPageEvidence): string | undefined {
  const loading = evidence.loading;
  if (loading === undefined) return undefined;
  const parts = joined([
    loading.readyState,
    loading.busy === true ? "busy" : undefined,
    ...(loading.indicators ?? []).map((indicator) => joined([indicator.kind, indicator.label === undefined ? undefined : quotedWords(indicator.label)])),
    loading.pendingNavigation === true ? "pending-navigation" : undefined
  ]);
  return parts === undefined ? undefined : `LOADING ${parts}`;
}

function framesLine(evidence: WebLlmPageEvidence): string | undefined {
  const ids = evidence.frame?.unansweredFrameIds ?? [];
  return ids.length > 0 ? `FRAMES ${ids.join(",")} did not answer` : undefined;
}

function arrivedLine(evidence: WebLlmPageEvidence, links: WebLlmLinkWriter): string | undefined {
  const navigation = evidence.navigation;
  if (navigation === undefined) return undefined;
  const redirects = navigation.redirects;
  const parts = joined([
    navigation.type,
    redirects === undefined ? undefined : `${redirects} ${redirects === 1 ? "redirect" : "redirects"}`,
    navigation.referrer === undefined ? undefined : `from ${links.write(navigation.referrer)}`,
    navigation.url === undefined || navigation.url === evidence.location ? undefined : `at ${links.write(navigation.url)}`
  ]);
  return parts === undefined ? undefined : `ARRIVED ${parts}`;
}

/** The parts that say something, joined by spaces, or `undefined` when none does. */
function joined(parts: ReadonlyArray<string | undefined>): string | undefined {
  const said = parts.filter((part): part is string => part !== undefined && part !== "");
  return said.length > 0 ? said.join(" ") : undefined;
}

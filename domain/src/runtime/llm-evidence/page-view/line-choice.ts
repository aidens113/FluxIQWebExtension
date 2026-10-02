// Which elements get a line in the page view, in document order (t223,
// "Which elements get a line"):
//
//  1. A visible control gets a line.
//  2. A visible layer gets a line, with words or without.
//  3. A visible non-control with meaningful own words gets a text line, unless
//     F1 its nearest ancestor with a line is a control with words or a
//     semantic element, whose line already shows these words; F2 it is a label saying exactly
//     what the control line next to it says; or F3 it says exactly what the
//     line before it says.
//  4. A visible non-control image with a meaningful alt gets a line, unless F1
//     applies or its alt is the words of another line of the same list item
//     (or of a line next to it, outside an item): the title the heading or the
//     link already printed.
//  5. A control with no words of its own is named by the images it holds: a
//     profile picture's link, a colour swatch drawn as an image (t229). Their
//     alts are its words, as the accessible name would have them, and the
//     image lines fold into it under F1 as any words under a control do. The
//     image rule takes those words back only where a line beside it already
//     says all of them: a product photo's link in a card whose title link
//     follows is printed as a link, without the title a second time, and a
//     profile picture's "lena.moss's profile picture" stays beside the
//     "lena.moss" link, since it says more.
//  6. F4 joins a run of letterless fragments (`$`, `39.`, `99`) into one line
//     for the element that holds them (`./fragment-merge.ts`).
//
// An element that is a control only because the page listens for presses on
// it or gave it a pointer, and that holds a control of its own, is a delegate
// (`./element/traits.ts`): it gets the line it would get as a non-control. A
// feed list that hears its buttons' presses would otherwise be one control
// line holding the whole feed, and every post's words would fold into it.
//
// Words are compared normalised (`./element/normalised.ts`). The image rule
// compares at word boundaries, so a rating of `4` does not swallow the alt
// `4K television`; and it compares only with lines that are not images, so two
// alike images cannot remove each other. F1 and F4 need `parent`; without it
// they do not apply, and the view prints a duplicate rather than dropping words.

import type { WebLlmEvidenceElement } from "../elements";
import { meaningfulWords, normalisedWords, webLlmElementWords, webLlmViewTraits } from "./element";
import { mergedWebLlmFragments } from "./fragment-merge";
import type { WebLlmPageTree } from "./page-tree";
import type { WebLlmViewLine } from "./view-line";

/** The page view's element lines, in document order. */
export function chosenWebLlmLines(elements: readonly WebLlmEvidenceElement[], tree: WebLlmPageTree): WebLlmViewLine[] {
  const lines = withoutEchoedLabels(firstPass(elements, tree));
  return mergedWebLlmFragments(withoutRepeatedImages(lines), elements, tree);
}

/** Rules 1 to 5 with F1 and F3, which look only backwards. */
function firstPass(elements: readonly WebLlmEvidenceElement[], tree: WebLlmPageTree): WebLlmViewLine[] {
  const lines: WebLlmViewLine[] = [];
  const lined = new Map<WebLlmEvidenceElement, WebLlmViewLine>();
  const delegates = controlHolders(elements, tree);
  for (const [index, element] of elements.entries()) {
    const delegate = delegates.has(element);
    const traits = webLlmViewTraits(element, delegate);
    if (!traits.visible || traits.lineRole === undefined) continue;
    const role = traits.lineRole;
    const own = webLlmElementWords(element, delegate);
    const held = own === undefined && role === "control" ? heldImageWords(elements, index, tree) : undefined;
    const words = own ?? held;
    if ((role === "text" || role === "image") && foldedIntoAncestor(element, tree, lined)) continue;
    if (role === "text" && sameWords(lines.at(-1)?.words, words)) continue;
    const line: WebLlmViewLine = held === undefined ? { element, role, words } : { element, role, words, imageWords: true };
    lines.push(line);
    lined.set(element, line);
  }
  return lines;
}

/** Every element with a visible control under it: the ones a press listener or a cursor alone does not make a control. */
function controlHolders(elements: readonly WebLlmEvidenceElement[], tree: WebLlmPageTree): ReadonlySet<WebLlmEvidenceElement> {
  const holders = new Set<WebLlmEvidenceElement>();
  for (const element of elements) {
    const traits = webLlmViewTraits(element);
    if (!traits.visible || !traits.control) continue;
    for (const ancestor of tree.ancestors(element)) {
      if (holders.has(ancestor)) break;
      holders.add(ancestor);
    }
  }
  return holders;
}

/** Rule 5: the alts of the visible images under a wordless control, in order, which follow it in document order. */
function heldImageWords(elements: readonly WebLlmEvidenceElement[], index: number, tree: WebLlmPageTree): string | undefined {
  const control = elements[index]!;
  const alts: string[] = [];
  for (let next = index + 1; next < elements.length && tree.isUnder(elements[next]!, control); next += 1) {
    const inside = elements[next]!;
    const traits = webLlmViewTraits(inside);
    if (traits.visible && traits.image && meaningfulWords(inside.name)) alts.push(inside.name!);
  }
  return alts.length === 0 ? undefined : alts.join(" ");
}

/**
 * F1: the nearest ancestor with a line is a control with words, or a semantic
 * element, whose line already shows these words. A control printed without
 * words shows none, so nothing under it folds; and a control the page only
 * drew prints its own words, so only words its line holds fold into it (t229).
 */
function foldedIntoAncestor(element: WebLlmEvidenceElement, tree: WebLlmPageTree, lined: ReadonlyMap<WebLlmEvidenceElement, WebLlmViewLine>): boolean {
  const nearest = tree.ancestors(element).find((ancestor) => lined.has(ancestor));
  if (nearest === undefined) return false;
  const line = lined.get(nearest)!;
  const traits = webLlmViewTraits(nearest);
  if (traits.semantic) return true;
  if (line.role !== "control" || line.words === undefined) return false;
  if (!traits.drawn) return true;
  const words = webLlmElementWords(element);
  return words !== undefined && holdsWords(normalisedWords(line.words), normalisedWords(words));
}

/** F2: a label whose words are the words of the control line just before or just after it. */
function withoutEchoedLabels(lines: readonly WebLlmViewLine[]): WebLlmViewLine[] {
  return lines.filter((line, index) => {
    if (line.role !== "text" || line.element.tag !== "label") return true;
    const echoed = [lines[index - 1], lines[index + 1]].some((next) => next?.role === "control" && sameWords(next.words, line.words));
    return !echoed;
  });
}

/**
 * The image rule: an alt that is, or holds, the words of a line beside it in
 * the same list item. An image's line goes; a control named by its images
 * (rule 5) stays, without those words.
 */
function withoutRepeatedImages(lines: readonly WebLlmViewLine[]): WebLlmViewLine[] {
  const itemRun = itemRuns(lines);
  const repeated = (line: WebLlmViewLine, index: number): boolean => {
    const alt = normalisedWords(line.words!);
    const neighbours = itemRun[index] === undefined
      ? [lines[index - 1], lines[index + 1]]
      : lines.filter((_, other) => other !== index && itemRun[other] === itemRun[index]);
    return neighbours.some((other) => {
      if (other === undefined || other.role === "image" || other.imageWords === true || !meaningfulWords(other.words)) return false;
      const words = normalisedWords(other.words);
      return holdsWords(words, alt) || (line.role === "image" && holdsWords(alt, words));
    });
  };
  return lines.flatMap((line, index) => {
    if (line.words === undefined || (line.role !== "image" && line.imageWords !== true)) return [line];
    if (!repeated(line, index)) return [line];
    return line.role === "image" ? [] : [{ element: line.element, role: line.role, words: undefined }];
  });
}

/** Each line's list item, as a number shared by a run of consecutive lines in the same item; `undefined` outside an item. */
function itemRuns(lines: readonly WebLlmViewLine[]): Array<number | undefined> {
  let run = 0;
  let previous: string | undefined;
  return lines.map((line) => {
    const item = line.element.item;
    const key = item === undefined ? undefined : `${item.index}/${item.total}`;
    if (key !== previous) run += 1;
    previous = key;
    return key === undefined ? undefined : run;
  });
}

/** `haystack` holds `needle` as whole words: no letter or digit runs on at either end. */
function holdsWords(haystack: string, needle: string): boolean {
  if (needle === "") return false;
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) {
    const before = haystack.slice(0, at);
    const after = haystack.slice(at + needle.length);
    if (!/[\p{L}\p{N}]$/u.test(before) && !/^[\p{L}\p{N}]/u.test(after)) return true;
  }
  return false;
}

function sameWords(left: string | undefined, right: string | undefined): boolean {
  return left !== undefined && right !== undefined && normalisedWords(left) === normalisedWords(right);
}

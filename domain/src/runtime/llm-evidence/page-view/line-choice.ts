// Which elements get a line in the page view, in document order (t223,
// "Which elements get a line"):
//
//  1. A visible control gets a line.
//  2. A visible layer gets a line, with words or without.
//  3. A visible non-control with meaningful own words gets a text line, unless
//     F1 its nearest ancestor with a line is a control or a semantic element,
//     whose line already shows these words; F2 it is a label saying exactly
//     what the control line next to it says; or F3 it says exactly what the
//     line before it says.
//  4. A visible non-control image with a meaningful alt gets a line, unless F1
//     applies or its alt is the words of another line of the same list item
//     (or of a line next to it, outside an item): the title the heading or the
//     link already printed.
//  5. F4 joins a run of letterless fragments (`$`, `39.`, `99`) into one line
//     for the element that holds them (`./fragment-merge.ts`).
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

/** Rules 1 to 4 with F1 and F3, which look only backwards. */
function firstPass(elements: readonly WebLlmEvidenceElement[], tree: WebLlmPageTree): WebLlmViewLine[] {
  const lines: WebLlmViewLine[] = [];
  const lined = new Set<WebLlmEvidenceElement>();
  for (const element of elements) {
    const traits = webLlmViewTraits(element);
    if (!traits.visible || traits.lineRole === undefined) continue;
    const role = traits.lineRole;
    const words = webLlmElementWords(element);
    if ((role === "text" || role === "image") && foldedIntoAncestor(element, tree, lined)) continue;
    if (role === "text" && sameWords(lines.at(-1)?.words, words)) continue;
    lines.push({ element, role, words });
    lined.add(element);
  }
  return lines;
}

/** F1: the nearest ancestor with a line is a control or a semantic element, whose line already shows these words. */
function foldedIntoAncestor(element: WebLlmEvidenceElement, tree: WebLlmPageTree, lined: ReadonlySet<WebLlmEvidenceElement>): boolean {
  const nearest = tree.ancestors(element).find((ancestor) => lined.has(ancestor));
  if (nearest === undefined) return false;
  const traits = webLlmViewTraits(nearest);
  return traits.control || traits.semantic;
}

/** F2: a label whose words are the words of the control line just before or just after it. */
function withoutEchoedLabels(lines: readonly WebLlmViewLine[]): WebLlmViewLine[] {
  return lines.filter((line, index) => {
    if (line.role !== "text" || line.element.tag !== "label") return true;
    const echoed = [lines[index - 1], lines[index + 1]].some((next) => next?.role === "control" && sameWords(next.words, line.words));
    return !echoed;
  });
}

/** The image rule: an alt that is, or holds, the words of a line beside it in the same list item. */
function withoutRepeatedImages(lines: readonly WebLlmViewLine[]): WebLlmViewLine[] {
  const itemRun = itemRuns(lines);
  return lines.filter((line, index) => {
    if (line.role !== "image" || line.words === undefined) return true;
    const alt = normalisedWords(line.words);
    const neighbours = itemRun[index] === undefined
      ? [lines[index - 1], lines[index + 1]]
      : lines.filter((_, other) => other !== index && itemRun[other] === itemRun[index]);
    return !neighbours.some((other) => {
      if (other === undefined || other.role === "image" || !meaningfulWords(other.words)) return false;
      const words = normalisedWords(other.words);
      return holdsWords(alt, words) || holdsWords(words, alt);
    });
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

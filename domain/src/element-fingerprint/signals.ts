// How many independent things a saved identity says about its control, besides
// where it was.
//
// The question the save-time guard asks (`./shortfall.ts`): if the page changes
// one detail of this control -- regenerates its id, renames a class, moves it --
// is there still something left that says which control it is? A selector and
// an xpath are left out of the count because they are addresses, and so is any
// token the selector is addressed through: R4a's quantity box was saved as
// `{ tagName: "input", selector: "#fb1l6ufkg" }`, and an id written beside that
// selector would have been the same regenerated token said twice, not a second
// signal.
//
// Only signals the page finds a control by are counted, because a signal
// nothing compares cannot find the control when the others fail. The page
// looks a control up by its id, test id, `name` attribute, class set and words
// (`apps/extension/src/content/element-finder.ts`), and scores its words,
// label, id, test id, role, tag and class names
// (`apps/extension/src/content/identity/score.ts`). So, each once:
//
// - **kind**: the tag, role, implied role and input type together. They say
//   what sort of control it is -- every candidate the resolver weighs already
//   shares them -- so all four are one signal, never four.
// - **words**: each distinct visible text, text, accessible name and label,
//   compared without case or spacing, so a button whose text and name are both
//   "Save" says "Save" once. A recorded `text` is counted with them because
//   Core reads it as the visible text of a target that names none
//   (`model/action-element-target.ts`). A placeholder, `aria-label` or title
//   reaches the page as the accessible name it makes, which is where it is
//   counted.
// - **id**, **testId**, **name** (the attribute): each an authored identifier,
//   counted unless the selector is addressed through it.
// - **classNames**: the class tokens, as one signal however many there are --
//   they are one attribute the page wrote -- counted while one token the
//   selector does not quote is left.
//
// Where the control sat -- its record, form, list position, landmark, shadow
// roots -- is carried and gates the search, but names no control on its own,
// and a link's destination is carried but compared by nothing, so neither is
// counted.

import type { WebAutomationElementFingerprint } from "../actions/types";

/** One independent signal of a saved identity; `words` repeats once per distinct wording. */
export type WebElementIdentitySignal = "kind" | "words" | "id" | "testId" | "name" | "classNames";

/** The independent signals `fingerprint` carries besides its selector and xpath (header). */
export function webElementIdentitySignals(fingerprint: WebAutomationElementFingerprint): WebElementIdentitySignal[] {
  const quoted = selectorTokens(fingerprint.selector);
  const signals: WebElementIdentitySignal[] = [];
  if ([fingerprint.tagName, fingerprint.role, fingerprint.implicitRole, fingerprint.inputType].some(said)) signals.push("kind");
  const wordings = new Set([fingerprint.visibleText, fingerprint.text, fingerprint.accessibleName, fingerprint.label].filter(said).map(comparable));
  signals.push(...Array.from(wordings, (): WebElementIdentitySignal => "words"));
  if (said(fingerprint.id) && !quoted.has(comparable(fingerprint.id))) signals.push("id");
  if (said(fingerprint.testId) && !quoted.has(comparable(fingerprint.testId))) signals.push("testId");
  if (said(fingerprint.name) && !quoted.has(comparable(fingerprint.name))) signals.push("name");
  if ((fingerprint.classNames ?? []).some((token) => said(token) && !quoted.has(comparable(token)))) signals.push("classNames");
  return signals;
}

/**
 * Every identifier a selector is addressed through: its `#id`s, its `.class`es
 * and the values of its attribute tests, unescaped and compared without case.
 * A selector that reads as nothing yields nothing, which leaves every signal
 * beside it counted.
 */
function selectorTokens(selector: string | undefined): Set<string> {
  const tokens = new Set<string>();
  if (!said(selector)) return tokens;
  for (const match of selector.matchAll(/[#.]((?:\\[0-9a-f]{1,6}\s?|\\.|[\w-])+)/giu)) tokens.add(comparable(unescape(match[1]!)));
  for (const match of selector.matchAll(/\[\s*[\w:-]+\s*[~|^$*]?=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\]\s]+))\s*(?:[is]\s*)?\]/gu)) {
    tokens.add(comparable(unescape(match[1] ?? match[2] ?? match[3] ?? "")));
  }
  return tokens;
}

/** A CSS-escaped identifier as the page wrote it: `\:r1\:` is `:r1:`, `\31 23` is `123`. */
function unescape(token: string): string {
  return token.replace(/\\([0-9a-f]{1,6})\s?|\\(.)/giu, (_, hex: string | undefined, literal: string | undefined) => hex !== undefined ? String.fromCodePoint(Number.parseInt(hex, 16)) : literal ?? "");
}

function said(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function comparable(value: string): string {
  return value.replace(/\s+/gu, " ").trim().toLowerCase();
}

// Whether any element on the current page carries an identifier the recording
// named: an id, or a token a recorded selector is addressed through.
//
// `score.ts` asks it of every recorded id and selector before handing them to
// Core's matcher, because a token no element carries is evidence of nothing.
// Core has two answers for an identifier the candidate does not share -- absent
// at -0.1, contradicted at -0.8 of weight 26 -- and neither is true of a token
// the page no longer holds anywhere: the page has not named a *different*
// control by it, it has stopped naming anything by it. Charged as a
// contradiction it buried the right candidate under the floor in R4a
// (`run-mv2nlh9l-52e476da`), where the crossborder item page draws its quantity
// box's id afresh on every load and `#fb1l6ufkg` was one load's draw.
//
// "The page" is the candidates' document and every open shadow root beneath it,
// because an id is unique only within its own root. The document is asked
// first, and the roots are walked only when it said no and only once per
// scoring, so the ordinary replay -- the id still there -- costs one lookup.
//
// A document that cannot be asked -- a stand-in with no lookup methods, as unit
// tests hand the scorer -- answers `undefined`: not known to be absent, so the
// token keeps the meaning it always had.

import { composedRoots } from "../shadow-dom";

/** The page's answer for one token: carried, not carried, or not askable. */
export type PageTokens = {
  carries(attribute: string, value: string): boolean | undefined;
};

type Root = Document | ShadowRoot;

/** The tokens the page around `element` carries, asked lazily. */
export function pageTokens(element: Element | undefined): PageTokens {
  const document = askableDocument(element);
  let roots: Root[] | undefined;
  return {
    carries(attribute, value) {
      if (!document) return undefined;
      if (holds(document, attribute, value)) return true;
      roots ??= openRoots(document);
      return roots.some((root) => holds(root, attribute, value));
    }
  };
}

function askableDocument(element: Element | undefined): Document | undefined {
  const document = (element as { ownerDocument?: Partial<Document> | null } | undefined)?.ownerDocument;
  if (!document || typeof document.getElementById !== "function" || typeof document.querySelector !== "function") return undefined;
  return document as Document;
}

/** The open shadow roots beneath the document, without the document itself, which was already asked. */
function openRoots(document: Document): Root[] {
  return typeof document.querySelectorAll === "function" ? composedRoots(document).slice(1) : [];
}

function holds(root: Root, attribute: string, value: string): boolean {
  if (attribute === "id") return root.getElementById(value) !== null;
  try {
    return root.querySelector(`[${attribute}="${cssString(value)}"]`) !== null;
  } catch {
    // An attribute name the selector grammar refuses cannot be asked, so it is
    // not known to be absent.
    return true;
  }
}

/** A value made safe inside a double-quoted CSS string, without relying on `CSS.escape`. */
function cssString(value: string): string {
  return value.replace(/["\\]/gu, "\\$&").replace(/[\n\r\f]/gu, (character) => `\\${character.charCodeAt(0).toString(16)} `);
}

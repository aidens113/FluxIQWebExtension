// A control that is itself one row of a list: a gallery's tile, a grid's card
// link (photo newest-likes r1, `run-mvecxeci-1c2cc227`, Cause 3).
//
// `record.ts` finds a control's row by markup -- a `tr`, an `li`, an
// `article`, a keyed element -- and `control-row.ts` by a twin control of the
// same name in the neighbouring row. A gallery drawn as a `<div>` of `<a href>`
// tiles has neither: each tile is the link, with nothing around it but the
// grid, and each tile's name is its own counts, so no two tiles are alike by
// name. A loop pass over such a gallery was told the tile sat in no repeated
// row, took it for a page-level control and opened the first tile on every
// pass.
//
// **A control is its own row when it is one of a run of same-shaped siblings
// that carry content of their own and differ in it.** Same-shaped: the same
// tag, the same written role and the same class attribute, which is what one
// template stamped over and over looks like. Differing: some such sibling says
// something else -- other words, another link, another picture -- because a
// run whose members are copies tells no row from another.
//
// Carrying content is what keeps a toolbar out. A dialog's row of icon
// buttons (Like, Share, Save) and a menu of one-word links are same-shaped
// runs too, and a loop's body presses them on every pass as page-level
// controls: the open item's Like is the same control whichever row opened it.
// A row holds what the list read out of it, so a member counts only when it
// holds a picture or words in more than one place -- a tile's image and
// counts, a card's title and price -- and not a lone label or a glyph.
//
// Every walk is bounded, and an answer the bound cut short is no answer.

import { isSensitiveFormControl } from "../element-traits";

/** Members a run may have. A grid is long, but a run past this is not read: it is no run. */
const MAX_RUN_MEMBERS = 1_000;
/** Nodes walked inside one member, reading its content. A tile is a tile, not a page. */
const MAX_MEMBER_NODES = 200;

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/** The elements that draw a picture: a tile's thumbnail, a card's photo. */
const PICTURE_TAGS: ReadonlySet<string> = new Set(["img", "picture", "video", "canvas"]);
/** Attributes that say how a member is drawn or reached rather than what it holds. */
const PRESENTATION_ATTRIBUTES: ReadonlySet<string> = new Set(["class", "style", "tabindex", "draggable", "loading", "decoding"]);

/**
 * The run `control` is a row of, in document order and `control` among them,
 * when it is one by the rule in the header; otherwise `undefined`, and the
 * caller's other rules decide. A run longer than `MAX_RUN_MEMBERS` is no run.
 */
export function ownRun(control: Element): readonly Element[] | undefined {
  const parent = control.parentElement;
  if (!parent) return undefined;
  const own = memberContent(control);
  if (!own?.carries) return undefined;
  const run: Element[] = [];
  let differs = false;
  for (const sibling of parent.children) {
    if (sibling !== control && !sameShape(sibling, control)) continue;
    run.push(sibling);
    if (run.length > MAX_RUN_MEMBERS) return undefined;
    if (!differs && sibling !== control) {
      const theirs = memberContent(sibling);
      differs = theirs !== undefined && theirs.says !== own.says;
    }
  }
  return differs ? run : undefined;
}

/** Whether two elements are two stampings of one template: the same tag, written role and class attribute. */
function sameShape(element: Element, other: Element): boolean {
  return tagOf(element) === tagOf(other)
    && (element.getAttribute("role") ?? "") === (other.getAttribute("role") ?? "")
    && (element.getAttribute("class") ?? "") === (other.getAttribute("class") ?? "");
}

/**
 * What a member says -- its words and the values on it and inside it, in
 * document order -- and whether it carries content of its own: a picture, or
 * words in more than one place. `undefined` when the bounded walk did not
 * finish, so a member too large to read is never compared.
 */
function memberContent(member: Element): { says: string; carries: boolean } | undefined {
  const said: string[] = [];
  let pictures = 0;
  let wordRuns = 0;
  let budget = MAX_MEMBER_NODES;
  const pending: Node[] = [member as unknown as Node];
  for (let node = pending.pop(); node; node = pending.pop()) {
    if (budget <= 0) return undefined;
    budget -= 1;
    if (node.nodeType === TEXT_NODE) {
      const words = (node.nodeValue ?? "").replace(/\s+/gu, " ").trim();
      if (words) {
        wordRuns += 1;
        said.push(words);
      }
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) continue;
    const element = node as Element;
    if (isSensitiveFormControl(element)) continue;
    if (PICTURE_TAGS.has(tagOf(element))) pictures += 1;
    for (const name of attributeNames(element)) {
      if (!PRESENTATION_ATTRIBUTES.has(name)) said.push(`${name}=${element.getAttribute(name) ?? ""}`);
    }
    const children = element.childNodes;
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child) pending.push(child);
    }
  }
  return { says: said.join("\u0000"), carries: pictures > 0 || wordRuns > 1 };
}

/** The element's attribute names, or none when the host cannot list them. */
function attributeNames(element: Element): readonly string[] {
  return typeof element.getAttributeNames === "function" ? element.getAttributeNames() : [];
}

function tagOf(element: Element): string {
  return element.localName ?? element.tagName?.toLowerCase() ?? "";
}

// A part of a page that holds nothing but controls: a bar of actions (t778).
//
// A control alone of its kind is about the title of the nearest part around
// it that has one (`record.ts` `nearestTitle`), and a part's title may be its
// first link. A job board's pane draws the job's title as a heading and, below
// it, an actions bar: the employer's "Apply on company site" link beside the
// heart that saves the job. The bar was the nearest part with a "title", so
// every save was about "Apply on company site" and three saved jobs declared
// one subject (rerun round 6 slot 2, `run-mvrj7qg9-b6dc94f6`, t772 w11).
//
// A link in a part that says nothing but its controls is one of those
// controls, not the name of what they act on: the name is further up, in the
// part that says something -- the pane head's heading. A part that does say
// more -- a saved line's price beside its item link and Move to cart -- keeps
// its link as its title. Words count when they are a reader's: not inside a
// link, a button or another control whose words are its state, not a
// sensitive field's contents, and not inside a drawing, whose `<title>` is an
// icon's name.

import { isSensitiveFormControl } from "../element-traits";

/** Subtrees whose words are a control's, not the part's. */
const CONTROL_SUBTREE = 'button,select,textarea,input,svg,[role="button"],[role="link"],[role="switch"],[role="checkbox"],[role="menuitem"],[contenteditable]';

/** Nodes walked while reading a part. A bar is a few controls, not a document. */
const MAX_PART_NODES = 400;

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/** Whether `part` holds no words of its own beside its controls' within the walk's bound. */
export function holdsOnlyControls(part: Element): boolean {
  let budget = MAX_PART_NODES;
  const pending: Node[] = [...part.childNodes].reverse();
  for (let node = pending.pop(); node; node = pending.pop()) {
    // A part too large to read whole is no bar.
    if ((budget -= 1) < 0) return false;
    if (node.nodeType === TEXT_NODE) {
      if ((node.nodeValue ?? "").trim() !== "") return false;
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) continue;
    const child = node as Element;
    if (isSensitiveFormControl(child) || isLink(child) || matches(child, CONTROL_SUBTREE)) continue;
    for (const grandchild of [...child.childNodes].reverse()) pending.push(grandchild);
  }
  return true;
}

/** A link a person can follow, told by its tag and address rather than a compound selector a bare host may not read. */
function isLink(element: Element): boolean {
  return (element.localName ?? element.tagName?.toLowerCase()) === "a" && element.hasAttribute("href");
}

/** `matches`, which throws on a selector a host does not support and is absent on a bare stub. */
function matches(element: Element, selector: string): boolean {
  try {
    return typeof element.matches === "function" && element.matches(selector);
  } catch {
    return false;
  }
}

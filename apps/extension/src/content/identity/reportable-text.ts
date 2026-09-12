// Whether an element's own text may be quoted in a failure report.
//
// A resolution failure names the candidates it could not choose between, and
// the most useful thing it can say about a candidate is what it says on it:
// `button#save "Save changes"`. That text leaves the machine. It becomes the
// `actual` of a TARGET_AMBIGUOUS record, which travels to the gateway, and a
// resolution failure carries no element descriptor, so the domain's own
// sensitivity guard never sees it -- whatever is emitted here is what ships.
//
// For a button or a link the text is a label and is exactly the diagnostic
// wanted. For a container it is not a label at all: `textContent` on a wrapper
// returns everything rendered inside it, and wrappers reach the candidate pool
// routinely -- `a[href]` around a product card, `div[role="button"]` around a
// summary block, `li[tabindex]` in a list of orders. Forty characters of that
// is an address, an order total, or a rendered card number on a failure record.
//
// **Why the sensitivity rule alone is not the answer.** The obvious guard is
// `isSensitiveFormControl`, the one rule in `domain/src/sensitivity/`. It is
// used below, and it is not sufficient on its own: it reads a control's
// `type`, `autocomplete` and `data-sensitive`, and the leaks this module exists
// to prevent are *rendered page text*, not form-control values. A card number
// printed into a `<div role="button">` matches no autocomplete token and is not
// an input at all, so a signature test would pass it straight through. The
// structural question -- is this text a label, or is it a document? -- is the
// one that discriminates, and the signature rule is kept beside it because
// `data-sensitive` is the page author saying "not this", which must be honoured
// even on a plain control.
//
// The bias is deliberate: a withheld label costs a debugging session, and the
// tag and the identifier are kept in every case, so two candidates are still
// distinguishable in a report without any page content at all.

import { boundedText } from "./bounded-text";
import { isSensitiveFormControl } from "../element-traits";

/**
 * Elements whose own text content is their accessible name by the platform's
 * own rules, so quoting it quotes a label. Everything else -- a `div`, an `li`,
 * a `section`, anything interactive only by `tabindex` or `onclick` -- is a
 * container until proven otherwise, however it is dressed.
 */
const LABELLED_TAGS = new Set(["button", "a", "summary", "label", "option", "legend", "caption"]);

/** And the roles whose name comes from content, for a control the markup did not spell natively. */
const LABELLED_ROLES = new Set([
  "button", "link", "menuitem", "menuitemcheckbox", "menuitemradio",
  "tab", "option", "checkbox", "radio", "switch", "treeitem"
]);

/**
 * Descendants a label may contain: phrasing wrappers and decoration. A
 * component library writes `<button><span class="icon"></span><span>Save</span></button>`
 * and that is still one label; a card writes `<a><h3>…</h3><p>…</p></a>` and
 * that is a document. The line between them is block structure, so the
 * allowlist is the inline vocabulary and nothing else.
 */
const PHRASING_TAGS = new Set([
  "span", "b", "i", "em", "strong", "small", "u", "s", "code", "kbd", "samp",
  "sub", "sup", "mark", "abbr", "time", "bdi", "bdo", "br", "wbr", "q", "cite",
  "var", "data", "ruby", "rt", "rp", "img", "picture", "source", "svg"
]);

/** Descendants examined before the answer is "container". A failure path still runs on a live page. */
const MAX_DESCENDANTS = 120;

/**
 * The element's own text, bounded, when that text is a label rather than page
 * content -- and `undefined` when it is not, or when there is no text.
 *
 * Three things must all hold. The element is one the platform names from its
 * own content; it contains only phrasing descendants, so its content is a
 * label and not a rendered document; and neither it nor any descendant is
 * sensitive by the one rule in `domain/src/sensitivity/`. Failing any of them
 * withholds the text and keeps the rest of the candidate's name.
 */
export function reportableText(element: Element, maxLength: number): string | undefined {
  if (!isNamedFromContent(element)) return undefined;
  if (!holdsOnlyPhrasing(element)) return undefined;
  if (isSensitiveFormControl(element)) return undefined;
  return boundedText(element.textContent, maxLength);
}

/** A control the platform names from what is written on it, by tag or by declared role. */
function isNamedFromContent(element: Element): boolean {
  const role = element.getAttribute("role")?.trim().toLowerCase();
  if (role) return LABELLED_ROLES.has(role);
  return LABELLED_TAGS.has(element.tagName.toLowerCase());
}

/**
 * Whether everything inside the element is inline decoration.
 *
 * An `svg` is allowed and so is everything under it: its internals are a
 * drawing vocabulary, they contribute no rendered text, and enumerating them
 * would be a second allowlist to keep current. A descendant that is sensitive
 * by the shared rule fails here too, which is how a `<label>` wrapping a card
 * field is withheld without a second sensitivity rule being written.
 */
function holdsOnlyPhrasing(element: Element): boolean {
  let scanned = 0;
  for (const descendant of element.querySelectorAll("*")) {
    scanned += 1;
    if (scanned > MAX_DESCENDANTS) return false;
    if (descendant.closest("svg")) continue;
    if (!PHRASING_TAGS.has(descendant.tagName.toLowerCase())) return false;
    if (isSensitiveFormControl(descendant)) return false;
  }
  return true;
}

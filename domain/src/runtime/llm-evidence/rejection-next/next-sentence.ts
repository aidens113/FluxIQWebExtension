// The sentence a refusal's `next` carries: what to do now, read off the
// refusal's reason and the resolver's codes beside it (`instead`), and never off
// the page. Each sentence is this domain's own fixed words, so it may ride in a
// detail (`../tool-rejection.ts`, header). Read again from the same fields on a
// repeat (`../repeated-refusal.ts`), so a repeated refusal says the same.
//
// Split out of `../tool-rejection.ts` when it reached its line limit (t509),
// which kept the reasons and the detail's shape.

import { webPlanScriptedChoiceMove } from "../plan-resolution/control-fit";
import type { WebLlmToolRejectionReason } from "../tool-rejection";

/** The resolver's code for a handle a reload renumbered (`plan-resolution/resolve-plan-node.ts`). */
const RENUMBERED_BY_RELOAD = "web.handle.renumbered_by_reload";

/** What to do next after a refusal for `reason`, or nothing where the reason says the whole of it. */
export function webLlmRejectionNext(reason: WebLlmToolRejectionReason, instead: readonly string[] | undefined, closeWith: readonly string[] | undefined): string | undefined {
  return reason === "covered_by_layer" ? (closeWith?.length ? COVERED_NEXT_CLOSE : COVERED_NEXT)
    // Read off the codes, so a repeat that passes them back says it again.
    : reason === "handle_not_in_packet" && instead?.includes(RENUMBERED_BY_RELOAD) === true ? RENUMBERED_NEXT
    : reason === "outcome_uncertain" ? UNCERTAIN_NEXT
    : reason === "press_had_no_effect" ? "The press left the page unchanged after it settled. Automatic retries have finished. Read the current page for a missing prerequisite or choose another control; the requested effect has not been established."
    : reason === "option_not_offered" ? OPTION_NOT_OFFERED_NEXT
    // Read off the kind code in `instead`, so a repeat that passes it back says it again.
    : reason === "handle_not_a_field" ? notAFieldNext(instead) : reason === "handle_wrong_kind_of_control" ? webPlanScriptedChoiceMove(instead)
    // Read off `instead`, so a repeat that passes it back says it again; a resolver's codes there are no handle.
    : reason === "page_moved_since_packet" || reason === "handle_no_longer_on_page" ? (staleHandleNamed(instead) ? STALE_NEXT_INSTEAD : STALE_NEXT)
    : undefined;
}

/** The resolver's code naming what a type or clear step's element is (`plan-resolution/resolve-plan-node.ts`), and the words for each kind. */
const TARGET_KIND_PREFIX = "web.handle.target_kind.";
const TARGET_KIND_WORDS: Readonly<Record<string, string>> = Object.freeze({
  text: "plain text", heading: "a heading", img: "an image", option: "an option", file_input: "a file input", menuitem: "a menu item", treeitem: "a tree item"
});

/** What to do about a type or clear on an element that holds no typed text, naming what it is when the codes say. */
function notAFieldNext(instead: readonly string[] | undefined): string {
  const kind = instead?.find((code) => code.startsWith(TARGET_KIND_PREFIX))?.slice(TARGET_KIND_PREFIX.length);
  const named = kind === undefined || !/^[a-z_]{1,20}$/u.test(kind) ? "an element" : TARGET_KIND_WORDS[kind] ?? `a ${kind}`;
  return `Nothing was done. The handle in target names ${named}, which holds no typed text, so nothing can be typed into or cleared there. `
    + "Name the field itself -- a text box, a text area or an editable area -- by the handle the page view prints for it; where useNode is given, that node is the one that acts on this element.";
}

/**
 * What to do about a select asked for an option it does not offer (t509). The
 * options are the page's words, so they are pointed to rather than repeated:
 * the page view prints a select's options after its line, `[a|b|c]`.
 */
const OPTION_NOT_OFFERED_NEXT = "Nothing was chosen: no option of this select has the value or the visible words sent. "
  + "The page view lists its options by their visible words after the select's own line, in [ | ]; send one of those exactly as value, "
  + "or the option's value as describe_element shows it for the select. The same value sent again is answered the same way.";

/** What to do about a control a layer covers, when the layer's own close control is known (`closeWith`). */
const COVERED_NEXT_CLOSE = "Nothing was done. The layer in instead covers the target: press one of closeWith to close it, then make this same call again, unchanged.";
/** The same, when no control of the layer reads as closing it. */
const COVERED_NEXT = "Nothing was done. The layer in instead covers the target: close or answer it with one of its own controls on the page, then make this same call again, unchanged.";

/**
 * What to do about a handle the page renumbered by reloading. A rerun reloads
 * its page before it runs, so the model's correction -- the handle from the page
 * it was just shown -- missed again (`run-musq0b1m-0472cfa0`, steps 0063, 0067).
 */
const RENUMBERED_NEXT = "Nothing was done. The page was reloaded (put back) since the view this handle came from, and the reload renumbered its controls, so the handle names nothing now. Look at the page again and use the control's current handle from that view.";

/**
 * What to do about a lasting act whose outcome is uncertain (t359, t361): it
 * was sent, nothing showed whether it took effect, and it was not made again.
 */
const UNCERTAIN_NEXT = "Outcome uncertain: this step was sent to the page, but its answer does not show whether it took effect, so it was not made again automatically -- making it twice could do it twice. Look at the page to see whether it took effect before making the same call again.";

/**
 * What to do about a handle from a view of another page, or of a control that
 * has left the page (t477): the handle names nothing now.
 */
const STALE_NEXT = "Nothing was done. The handle in target came from a view of a page that is no longer the one loaded, or named a control that has since left it, so it names nothing now. Use a handle from the newest view of the page you are on -- the page with this answer, when it carries one -- or look at the page again; where the tool's target is optional, it can be called without one.";
/** The same, when the caller found the element at the same place on the page now: `instead` is its handle. */
const STALE_NEXT_INSTEAD = "Nothing was done. The handle in target came from a view of a page that is no longer the one loaded, or named a control that has since left it. The element at the same place on the page now has the handle in instead, shown in the page with this answer: if it is what you meant, make the call again with that handle.";

/** Whether `instead` is one target handle (`t12`), as a stale-handle refusal names the element's current one, and not a resolver's codes. */
function staleHandleNamed(instead: readonly string[] | undefined): boolean {
  return instead?.length === 1 && /^t[1-9][0-9]*$/u.test(instead[0]!);
}

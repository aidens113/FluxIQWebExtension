// The sentence a refusal's `next` carries: what to do now, read off the
// refusal's reason and the resolver's codes beside it (`instead`), and never off
// the page. Each sentence is this domain's own fixed words, and at most this
// domain's own handles (`t12`), so it may ride in a detail
// (`../tool-rejection.ts`, header). Read again from the same fields on a
// repeat (`../repeated-refusal.ts`), so a repeated refusal says the same.
//
// Split out of `../tool-rejection.ts` when it reached its line limit (t509),
// which kept the reasons and the detail's shape.

import { webPlanScriptedChoiceMove } from "../plan-resolution/control-fit";
import type { WebLlmToolRejectionReason } from "../tool-rejection";

/** The resolver's code for a handle a reload renumbered (`plan-resolution/resolve-plan-node.ts`). */
const RENUMBERED_BY_RELOAD = "web.handle.renumbered_by_reload";

/** What to do next after a refusal for `reason`, or nothing where the reason says the whole of it. */
export function webLlmRejectionNext(reason: WebLlmToolRejectionReason, instead: readonly string[] | undefined, closeWith: readonly string[] | undefined, target?: string): string | undefined {
  // Read off the cover, the target and the closers, so a repeat that passes them back says it again.
  return reason === "covered_by_layer" ? coveredNext(instead?.[0], target, closeWith)
    // Read off the codes, so a repeat that passes them back says it again.
    : reason === "handle_not_in_packet" && instead?.includes(RENUMBERED_BY_RELOAD) === true ? RENUMBERED_NEXT
    : reason === "outcome_uncertain" ? UNCERTAIN_NEXT
    : reason === "press_had_no_effect" ? "The press left the page unchanged after it settled. Automatic retries have finished. Read the current page for a missing prerequisite or choose another control; the requested effect has not been established."
    : reason === "option_not_offered" ? OPTION_NOT_OFFERED_NEXT
    : reason === "incomplete_text" ? "First read only nonempty stable row-context columns without the incomplete text field. Use those records in For Each with an optional explicit registered row-bound click on each row's own disclosure, then read full text. Exclude units with no row context from that helper; find another context for any requested row this would omit. Repeat this ordering after each Next page move."
    : reason === "next_leaves_filtered_list" ? FILTERED_LIST_NEXT
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

/**
 * What to do about a Next page step whose Next would leave the filtered list
 * (t626). Generic: it names no site, control or filter, only where to look.
 */
const FILTERED_LIST_NEXT = "Nothing was pressed. This page's Next leads to the list without filters the page shows applied (filtersDropped says how many), "
  + "and no page number beside it keeps them, so the same step is answered the same way here. Find another control on the page that reaches the next page of this same filtered list, "
  + "or read this page and end the list here, saying in the answer that the later pages could not be reached with the filters kept.";

/**
 * What to do about a press on a control a layer covers (`covered_by_layer`),
 * naming the cover, the target and the layer's closers inline, in the order
 * they are to be acted on.
 *
 * **Why the handles are inlined, and the call is never said to be made again
 * unchanged.** On `run-mvcwem7d-34689f55`, 2026-10-17, a press on a control
 * under a layer was refused with `closeWith` naming the layer's two closers
 * and a next that ended "then make this same call again, unchanged". The model
 * made the same call again, unchanged, on its very next decision, and the
 * repeat (which had then lost `closeWith`, `../repeated-refusal.ts`) fell back
 * to "one of its own controls on the page": the model kept reading the covered
 * control, marked `covered-by` the layer, as one of the layer's own. Five
 * refused presses a brief, twice, and no Flow. So the sentence says which
 * handle to press first, that the covered press is refused the same way while
 * the layer stands, and only then to press the target again.
 *
 * A handle is inlined only when it is this domain's own token (`t12`), never
 * page text; anything else falls back to the field's name.
 */
function coveredNext(cover: string | undefined, target: string | undefined, closeWith: readonly string[] | undefined): string {
  const layer = isHandle(cover) ? `layer ${cover}` : "the layer in instead";
  const covering = isHandle(cover) ? cover : "the layer";
  const pressed = isHandle(target) ? target : "the target";
  const opening = `Nothing was done: ${layer} covers ${pressed}. `;
  const refusedAgain = `Do not press ${pressed} again while ${covering} covers it: that press is refused the same way. `;
  const after = `Once the layer is gone, press ${pressed} again.`;
  if (closeWith !== undefined && closeWith.length > 0) {
    const closers = closeWith.every(isHandle) ? eitherOf(closeWith) : "one of closeWith";
    return `${opening}Press ${closers} first; it closes that layer. ${refusedAgain}${after}`;
  }
  return `${opening}Close or answer that layer first with a control inside it (the page view lists those after the layer's own line), `
    + `never a control marked covered-by ${covering}: those lie under the layer. ${refusedAgain}${after}`;
}

/** `a`, `a or b`, `a, b or c`. */
function eitherOf(handles: readonly string[]): string {
  return handles.length === 1 ? handles[0]! : `${handles.slice(0, -1).join(", ")} or ${handles[handles.length - 1]!}`;
}

/** Whether `value` is one of this domain's handles (`t12`), and so may be said in a sentence. */
function isHandle(value: string | undefined): value is string {
  return value !== undefined && /^t[1-9][0-9]*$/u.test(value);
}

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
  return instead?.length === 1 && isHandle(instead[0]);
}

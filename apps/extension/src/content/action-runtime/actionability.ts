// Whether an element can actually be acted on right now, and where to hit it.
//
// The gate is visible (a non-zero box, not hidden, not inert), enabled (no
// `disabled` and no `aria-disabled`), and reachable: after scrolling the
// element into view, the point at its centre must land on the element itself or
// one of its descendants rather than on an overlay. A refusal names which of
// the three failed, so the result can report a closed code instead of a
// generic failure: `hidden` is TARGET_NOT_SHOWN, Core's `target_not_found`, and
// `disabled` and `covered` are TARGET_NOT_ACTIONABLE (`results.ts`). A `covered` refusal also says what layer the
// hit landed in and which controls that layer offers, so whoever reads it
// knows what has to be answered first.
//
// The checks run in that order because it is the order in which a reason stops
// being knowable: an element with no box has no point to hit-test, and a
// disabled one is refused whether or not something covers it. Reporting the
// first reason found therefore always reports the most fundamental one.
//
// The scroll happens here rather than in the caller so that the hit test is
// taken against exactly the geometry the action will use. A caller that scrolls
// separately and then hit-tests is one layout change away from clicking a point
// it never tested.
//
// `hidden` covers three situations a caller cannot distinguish and does not
// need to: the element is not rendered, it has no box, or no part of it is
// inside the viewport even after scrolling. In all three there is no point on
// screen that belongs to it.

import { deepElementFromPoint } from "../selector";
import { composedClosest, composedContains } from "../shadow-dom";
import { coveringLayerSentence } from "./interference";
import { scrollElementIntoView } from "./scroll-element-into-view";

export type ActionabilityRejectionCode = "disabled" | "hidden" | "covered";

export type ActionabilityReport =
  | { actionable: true; point: { x: number; y: number }; detail: string }
  | { actionable: false; code: ActionabilityRejectionCode; detail: string; point?: { x: number; y: number } | undefined };

type Point = { x: number; y: number };

export function checkActionability(element: Element): ActionabilityReport {
  if (!element.isConnected) return reject("hidden", "the element is not in the document");
  const view = element.ownerDocument.defaultView;
  if (!view) return reject("hidden", "the element's document is not displayed");

  const hidden = hiddenReason(element, view);
  if (hidden) return reject("hidden", hidden);

  const disabled = disabledReason(element);
  if (disabled) return reject("disabled", disabled);

  scrollElementIntoView(element);

  const point = hitPoint(element, view);
  if (!point) return reject("hidden", "no part of the element is inside the viewport, even after scrolling");

  // The hit test descends through open shadow roots, so a control inside a
  // widget is tested against what is painted inside that widget rather than
  // against its host, and a covering layer in one is named by its own content.
  const hit = deepElementFromPoint(point.x, point.y, element.ownerDocument) ?? undefined;
  if (!hit) return reject("covered", `nothing is painted at ${describePoint(point)}`, point);
  if (hit === element) return { actionable: true, point, detail: `the point ${describePoint(point)} landed on the target` };
  if (composedContains(element, hit)) {
    return { actionable: true, point, detail: `the point ${describePoint(point)} landed on ${elementLabel(hit)}, inside the target` };
  }
  // What covers the target, said so the reader can deal with it: the layer the
  // hit landed in and the controls on it (`interference/covering-layer.ts`).
  const layer = coveringLayerSentence(element, point);
  const covered = `the point ${describePoint(point)} landed on ${elementLabel(hit)}, which covers the target`;
  return reject("covered", layer ? `${covered}; ${layer}` : covered, point);
}

function reject(code: ActionabilityRejectionCode, detail: string, point?: Point): ActionabilityReport {
  return { actionable: false, code, detail, ...(point ? { point } : {}) };
}

/**
 * Why the element cannot be seen, if it cannot. The specific reasons are tried
 * before `checkVisibility` so the refusal says which property hid it; the
 * browser's own check is the backstop, because it also accounts for ancestors
 * and for `content-visibility`, which no single computed style reveals.
 */
function hiddenReason(element: Element, view: Window): string | undefined {
  // Inertness reaches into a shadow root from its host, so it is asked across the boundary.
  if (composedClosest(element, "[inert]")) return "the element is inert";
  const style = view.getComputedStyle(element);
  if (style.display === "none") return "the element's display is none";
  if (style.visibility !== "visible") return `the element's visibility is ${style.visibility}`;
  if (style.opacity === "0") return "the element's opacity is 0";
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return "the element has a zero-size box";
  // Not every engine implements checkVisibility, so it is read defensively
  // rather than through the DOM lib's type.
  const checkable = element as unknown as { checkVisibility?: (options?: Record<string, boolean>) => boolean };
  if (typeof checkable.checkVisibility === "function") {
    const visible = checkable.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true });
    if (!visible) return "the element is not rendered";
  }
  return undefined;
}

/**
 * Why the element will not accept the action, if it will not. `:disabled`
 * carries the whole HTML rule, a disabled `<fieldset>`'s descendants included;
 * `aria-disabled` is checked on ancestors too, because a composite widget marks
 * itself disabled while the press lands on a child.
 */
function disabledReason(element: Element): string | undefined {
  if (element.matches(":disabled")) return "the element is disabled";
  const ariaDisabled = element.closest('[aria-disabled="true"]');
  if (ariaDisabled === element) return "the element is aria-disabled";
  if (ariaDisabled) return `${elementLabel(ariaDisabled)}, an ancestor of the element, is aria-disabled`;
  if (element.hasAttribute("disabled")) return "the element has a disabled attribute";
  return undefined;
}

/**
 * The centre of the part of the element that is inside the viewport. Clamping
 * matters for an element taller or wider than the screen: its true centre can
 * be off-screen, where `elementFromPoint` answers nothing at all.
 */
function hitPoint(element: Element, view: Window): Point | undefined {
  const rect = element.getBoundingClientRect();
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.right, view.innerWidth);
  const bottom = Math.min(rect.bottom, view.innerHeight);
  if (right <= left || bottom <= top) return undefined;
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

/** A short, stable name for an element in a refusal: enough to find it on the page, bounded in length. */
function elementLabel(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const testId = element.getAttribute("data-testid");
  if (testId) return `${tag}[data-testid="${testId}"]`;
  if (element.id) return `${tag}#${element.id}`;
  const className = typeof element.className === "string" ? element.className.trim().split(/\s+/u)[0] : undefined;
  return className ? `${tag}.${className}` : tag;
}

function describePoint(point: Point): string {
  return `${Math.round(point.x)},${Math.round(point.y)}`;
}

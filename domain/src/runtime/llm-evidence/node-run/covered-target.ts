// A press on a control something covers is not sent (t223, C4 and C9 of
// `run-mup2i28c-6c7fc209`).
//
// The look a node takes before it acts marks every control a layer paints over
// with `coveredBy` (`../layers.ts`). Sent anyway, the click lands on the layer:
// live, a store button under a timed email popup was "pressed", the click
// closed the popup through its backdrop, the result said `succeeded` and
// `pageChanged`, and the store chooser it was for never opened. Refused, the
// call carries the page with the layer in it, and says which handles cover the
// control, so the next call deals with the layer and then presses again.

import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmPageEvidence } from "../sanitize";
import { webInLayer, webIsLayer } from "./layer";

export type WebCoveredTarget = {
  /** A modal dialog covers it, or something that is not one -- a banner, an overlay. */
  code: "blocked_by_dialog" | "target_covered";
  /** The control's handle. */
  target: string;
  /** The handles of what covers it, as the page marks them. */
  covers: string[];
  /**
   * The controls inside the first cover that close it, by handle: a "×", a
   * "No thanks", a "Close" (`CLOSE_WORDS`). Empty when none reads as closing.
   */
  closers: string[];
};

/** The words a control that closes a layer is named with, at the start of its name. */
const CLOSE_WORDS = /^\s*(?:×|✕|✖|x|close|dismiss|no,? thanks|not now|maybe later|skip|cancel|continue shopping|got it)(?![a-z])/iu;

/** The most closers named, so a layer full of buttons does not fill the refusal. */
const MAX_CLOSERS = 3;

/** What covers the control `written` names on `page`, or `undefined` when nothing does or it names no control there. */
export function webCoveredTarget(page: WebLlmPageEvidence, written: string | undefined): WebCoveredTarget | undefined {
  const target = canonicalWebLlmTargetHandle(written);
  if (target === undefined) return undefined;
  // Only a layer refuses a press (`./layer/element.ts`): `coveredBy` also
  // marks ordinary overlap, and refusing that refused live presses that would
  // have worked.
  const layer = (handle: string): boolean => webIsLayer(page.elements.find((element) => element.target === handle));
  const covers = (page.elements.find((element) => element.target === target)?.coveredBy ?? []).filter(layer);
  if (covers.length === 0) return undefined;
  const modal = covers.some((cover) => page.elements.find((element) => element.target === cover)?.isDialog?.modal === true);
  return { code: modal ? "blocked_by_dialog" : "target_covered", target, covers: [...covers], closers: closersOf(page, covers[0]!) };
}

/**
 * The controls of `cover` that close it: those that belong to it
 * (`./layer/member.ts`) and read as closing.
 */
function closersOf(page: WebLlmPageEvidence, cover: string): string[] {
  const byHandle = new Map(page.elements.map((element) => [element.target, element] as const));
  return page.elements
    .filter((element) => element.target !== cover && pressable(element) && webInLayer(byHandle, element, cover))
    .filter((element) => CLOSE_WORDS.test(element.name ?? element.text ?? "") || CLOSE_WORDS.test(element.label ?? ""))
    .slice(0, MAX_CLOSERS)
    .map((element) => element.target);
}

/** Whether a person would press it: a button or link, or something the page listens to or points at. */
function pressable(element: WebLlmEvidenceElement): boolean {
  const role = element.role ?? element.implicitRole;
  return element.tag === "button" || element.tag === "a" || role === "button" || role === "link" || element.hasClickHandler === true || element.cursor === "pointer";
}

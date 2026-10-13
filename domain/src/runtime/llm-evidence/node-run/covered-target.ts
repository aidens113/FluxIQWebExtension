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
//
// A consent layer is closed by answering it, so its closers are the answers
// that consent to nothing -- "Reject non-essential", "Necessary only", a "×"
// -- named first, and never an accept-all (cause 9 of `run-musq0b1m-0472cfa0`:
// a cookie layer named no closer, and the model pressed "Accept all"). This
// is information only: the model may still press any control a person could.

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
   * "No thanks", a "Close" (`CLOSE_WORDS`); on a consent layer, its
   * least-consent answers first ("Reject non-essential", `LEAST_CONSENT_WORDS`)
   * and nothing that consents (`CONSENT_WORDS`). Empty when none reads as closing.
   */
  closers: string[];
};

/** The words a control that closes a layer is named with, at the start of its name. */
const CLOSE_WORDS = /^\s*(?:×|✕|✖|x|close|dismiss|no,? thanks|not now|maybe later|skip|cancel|continue shopping|got it)(?![a-z])/iu;

/** The words a consent layer's answer that consents to nothing starts with. */
const LEAST_CONSENT_WORDS = /^\s*(?:reject|decline|refuse|deny|disagree|(?:only |strictly )?(?:necessary|essential|required)(?: cookies)? only|(?:use |allow )?only (?:strictly )?(?:necessary|essential|required)|continue without (?:accepting|agreeing))(?![a-z])/iu;

/** The words of a consent layer's control that consents to something: never offered as its closer. */
const CONSENT_WORDS = /^\s*(?:accept|agree|allow|ok(?:ay)?|got it|i understand|continue|yes)(?![a-z])/iu;

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
 *
 * A mark that is only a closing word -- a "×", a "Close" -- inside a pressable
 * element of the same layer is one of them, though the capture marks no cursor
 * or listener on it: its cursor is its card's, and its press reaches the card's
 * own listener (`../elements.ts`, `cursor`). Where a closing element holds
 * another, the inner one is named: a card whose words start with its "×" opens
 * the widget when pressed, and only its "×" closes it (t507, company-website's
 * help greeting over the consent sheet, `run-mv6qrcln-2e194a12` step 0008,
 * which named no closer at all).
 */
function closersOf(page: WebLlmPageEvidence, cover: string): string[] {
  const byHandle = new Map(page.elements.map((element) => [element.target, element] as const));
  const layer = byHandle.get(cover);
  const own = page.elements.filter((element) => element.target !== cover && webInLayer(byHandle, element, cover)
    && (pressable(element) || (reads(element, CLOSE_MARK) && insidePressable(byHandle, element, cover))));
  const closing = (element: WebLlmEvidenceElement): boolean => reads(element, CLOSE_WORDS);
  if (layer?.kind !== "consent" && layer?.isDialog?.kind !== "consent") {
    // A control that keeps what was set in the layer is named first, beside the
    // ones that dismiss it: told only to close a settings panel, the model
    // pressed Cancel and threw away the change it had just made (classifieds
    // step 0046, w1-job-classifieds-debug fix 7). Never on a consent layer,
    // where an "OK" consents.
    const confirming = own.filter((element) => reads(element, CONFIRM_WORDS));
    const dismissing = own.filter((element) => closing(element) && !confirming.includes(element));
    return innermost(byHandle, [...confirming, ...dismissing]).slice(0, MAX_CLOSERS).map((element) => element.target);
  }
  const declining = own.filter((element) => reads(element, LEAST_CONSENT_WORDS));
  const plain = own.filter((element) => closing(element) && !reads(element, CONSENT_WORDS) && !declining.includes(element));
  return innermost(byHandle, [...declining, ...plain]).slice(0, MAX_CLOSERS).map((element) => element.target);
}

/**
 * The whole name of a control that closes a layer keeping what was set in it.
 * Whole, so a "Save 20% with a plan" offer is not read as one.
 */
const CONFIRM_WORDS = /^\s*(?:apply|done|save|ok|okay|confirm|apply filters?|save changes)\s*$/iu;

/** A mark that is nothing but a closing word: a "×", a "Close". */
const CLOSE_MARK = /^\s*(?:×|✕|✖|x|close|dismiss)\s*$/iu;

/** How far up the `parent` chain an ancestor is looked for. */
const MOST_DEPTH = 40;

function reads(element: WebLlmEvidenceElement, words: RegExp): boolean {
  return words.test(element.name ?? element.text ?? "") || words.test(element.label ?? "");
}

/** Whether a described ancestor of `element` below `cover` is pressable, so a press on it lands on that ancestor's listener. */
function insidePressable(byHandle: ReadonlyMap<string, WebLlmEvidenceElement>, element: WebLlmEvidenceElement, cover: string): boolean {
  let at = element.parent;
  for (let depth = 0; at !== undefined && at !== cover && depth < MOST_DEPTH; depth += 1) {
    const ancestor = byHandle.get(at);
    if (ancestor === undefined) return false;
    if (pressable(ancestor)) return true;
    at = ancestor.parent;
  }
  return false;
}

/** The closers that hold no other closer, in their order. */
function innermost(byHandle: ReadonlyMap<string, WebLlmEvidenceElement>, closers: readonly WebLlmEvidenceElement[]): WebLlmEvidenceElement[] {
  const holders = new Set<string>();
  for (const closer of closers) {
    let at = closer.parent;
    for (let depth = 0; at !== undefined && depth < MOST_DEPTH; depth += 1) {
      holders.add(at);
      at = byHandle.get(at)?.parent;
    }
  }
  return closers.filter((closer) => !holders.has(closer.target));
}

/** Whether a person would press it: a button or link, or something the page listens to or points at. */
function pressable(element: WebLlmEvidenceElement): boolean {
  const role = element.role ?? element.implicitRole;
  return element.tag === "button" || element.tag === "a" || role === "button" || role === "link" || element.hasClickHandler === true || element.cursor === "pointer";
}

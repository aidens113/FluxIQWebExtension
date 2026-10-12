// Whether pressing a control would act on the page rather than close the layer
// it sits on (t401).
//
// The anchored allow-lists in `../vocabulary.ts` decide which *label* may be
// pressed. A label is not the whole control, though: a press lands on an
// element and reaches the button or link around it, and that control has a
// role and a name of its own. Live, the provider-free recovery matrix (row 13a)
// recorded a confirm landing outside the Flow while the clearing was closing a
// rate-limit notice, and the notice's "Try again" is exactly the control that
// confirms. So the press question now asks two more things of every candidate
// before it may be pressed, and refuses on either:
//
// - **Its role.** A control whose press submits a form -- a submit button, or a
//   button with no type inside a form, which submits -- is an act, unless the
//   form is `method="dialog"`, whose submission only closes the dialog. So is a
//   control that toggles a state of its own: a checkbox, a radio, a switch, an
//   option. Closing a layer never needs either.
// - **Its wording.** Every name and text on the element pressed and on the
//   control around it that is not itself an admitted way out is read for a word
//   that retries, confirms, submits, accepts, signs up, sends or goes on
//   (`isActingWording`). So a close glyph inside a "Retry" button is refused,
//   though the glyph alone is a dismissal.
//
// It reads attributes, a bounded text and the form owner, and nothing else, so
// it holds in a Node test whose fake elements answer only those.

import { isConsentDeclineLabel, isDismissalLabel, isRateLimitAcknowledgeLabel } from "../vocabulary";
import { isActingWording } from "./acting-wording";

/** What a press on an element reaches: the nearest control around it, itself included. */
const PRESSABLE_HOST = 'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"]';

/** Roles whose press changes a state the control itself holds. */
const STATEFUL_ROLE = /^(?:checkbox|radio|switch|option|menuitemcheckbox|menuitemradio)$/iu;

/** Input types whose press changes a state or submits. */
const ACTING_INPUT_TYPE = /^(?:checkbox|radio|submit|image|file)$/iu;

/** Longer wording than this is read only up to it: what a control says of itself comes first. */
const WORDING_READ_MAX = 200;

/** Whether pressing this control would act -- submit, toggle, retry, confirm, accept, go on -- rather than close what it sits on. */
export function actsOnPress(control: Element): boolean {
  const host = pressableHost(control);
  const reached = host && host !== control ? [control, host] : [control];
  if (reached.some(togglesOrSubmits)) return true;
  return reached.some((element) => wordingOf(element).some((wording) => !isAdmittedWayOut(wording) && isActingWording(wording)));
}

function pressableHost(control: Element): Element | null {
  return typeof control.closest === "function" ? control.closest(PRESSABLE_HOST) : null;
}

function togglesOrSubmits(element: Element): boolean {
  const role = element.getAttribute("role");
  if (role && STATEFUL_ROLE.test(role)) return true;
  const tag = typeof element.tagName === "string" ? element.tagName.toLowerCase() : "";
  if (tag === "input") {
    const type = element.getAttribute("type") ?? "text";
    return ACTING_INPUT_TYPE.test(type) && !(/^(?:submit|image)$/iu.test(type) && submitsToDialog(element));
  }
  if (tag !== "button") return false;
  const type = (element.getAttribute("type") ?? "submit").toLowerCase();
  if (type !== "submit") return false;
  const form = formOwner(element);
  return form !== null && !isDialogForm(form);
}

function submitsToDialog(element: Element): boolean {
  const form = formOwner(element);
  return form !== null && isDialogForm(form);
}

function formOwner(element: Element): Element | null {
  const owned = (element as Element & { form?: unknown }).form;
  if (owned && typeof owned === "object") return owned as Element;
  return typeof element.closest === "function" ? element.closest("form") : null;
}

function isDialogForm(form: Element): boolean {
  return (form.getAttribute("method") ?? "").toLowerCase() === "dialog";
}

/** Every name and text the element carries, collapsed and bounded; empty strings left out. */
function wordingOf(element: Element): string[] {
  const value = (element as Element & { value?: unknown }).value;
  const raw = [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    typeof value === "string" ? value : null,
    element.textContent
  ];
  return raw
    .map((text) => (text ?? "").replace(/\s+/gu, " ").trim().slice(0, WORDING_READ_MAX))
    .filter((text) => text.length > 0);
}

/** Wording the allow-lists already admit as a way out, whose own deny-list has been read. */
function isAdmittedWayOut(wording: string): boolean {
  return isDismissalLabel(wording) || isConsentDeclineLabel(wording) || isRateLimitAcknowledgeLabel(wording);
}

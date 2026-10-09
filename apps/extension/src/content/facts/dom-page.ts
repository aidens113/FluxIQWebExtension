// The live document, answering the fact judge's questions (`fact-page.ts`).
//
// Nothing here is a new reading of the page. A selector is asked as
// `web.dom.assert` asks it (`firstMatchInScope`, in the recorded shadow scope);
// an element description is resolved as an action's target is
// (`resolveTarget`, with its veto, record check and ambiguity rule); shown,
// enabled and text are the assertion's own reads; a chosen state is the one
// `web.dom.check` reads; and a dialog is the one page evidence reports, with
// the kind the interference classifiers gave it.
//
// What may leave the page is decided here, by the one sensitivity rule
// (`isSensitiveFormControl`, `isWithinSensitiveControl`): a sensitive
// control's text, value or checked state is never read -- the judge answers
// its claim `unknown` -- and any other element's text leaves out every
// sensitive control inside it.

import { WEB_AUTOMATION_FAILURE_CODES, type WebAutomationFactElement, type WebAutomationFactTarget } from "@fluxiq-web-extension/domain/client";
import {
  firstMatchInScope,
  isEnabledControl,
  isInsideClosedContainer,
  isVisibleElement,
  readChosenState,
  readElementText,
  resolveTarget,
  TargetResolutionError
} from "../action-runtime";
import { isSensitiveFormControl } from "../element-traits";
import { dialogEvidence } from "../evidence";
import { accessibleNameFor, implicitRole } from "../identity";
import { resolveShadowScope, selectorFor } from "../selector";
import { isWithinSensitiveControl, textOutsideSensitiveControls } from "../sensitive-text";
import type { BrowserActionCommand } from "../types";
import type { FactElement, FactPage, FactReading } from "./fact-page";

/** The longest identifying string an element's description carries. */
const NAME_MAX = 120;

/** Controls whose text is their contents, so a sensitive one inside an element is left out of that element's text. */
const TEXT_BEARING_CONTROLS = "textarea, select, [contenteditable]";

export function domFactPage(): FactPage {
  return {
    document: () => ({
      url: location.href,
      readyState: document.readyState,
      ...(typeof performance !== "undefined" && Number.isFinite(performance.timeOrigin) ? { timeOrigin: performance.timeOrigin } : {})
    }),
    resolve: (target) => resolve(target),
    count: (target) => matchCount(target.selector, target.shadowHosts),
    visible: (handle) => {
      const element = elementOf(handle);
      return !isInsideClosedContainer(element) && isVisibleElement(element);
    },
    enabled: (handle) => isEnabledControl(elementOf(handle)),
    text: (handle) => shownText(handle === undefined ? document.body ?? undefined : elementOf(handle)),
    values: (handle) => fieldValues(elementOf(handle)),
    checked: (handle) => checkedState(elementOf(handle)),
    selected: (handle) => selectedState(elementOf(handle)),
    describe: (handle) => describe(elementOf(handle)),
    dialogs: () => (dialogEvidence()?.open ?? []).map((dialog) => ({ kind: dialog.kind, name: dialog.label }))
  };
}

/**
 * A selector alone is re-queried as the assertion re-queries it. With an
 * element description the action resolver decides, and its two refusals mean
 * different things: a tie is "something is there, but which", a miss is
 * "nothing is". A description with no selector never falls through to the
 * focused element: the resolver's last strategy is not a claim about it.
 */
function resolve(target: WebAutomationFactTarget): ReturnType<FactPage["resolve"]> {
  if (!target.element) {
    const found = target.selector ? firstMatchInScope(target.selector, target.shadowHosts) : undefined;
    return found ? { outcome: "found", element: { element: found } } : { outcome: "not_found" };
  }
  const element = target.shadowHosts?.length
    ? { ...target.element, context: { ...(target.element.context ?? {}), shadowHosts: target.shadowHosts } }
    : target.element;
  const command = { commandId: "fact", actionType: "web.dom.assert", element, ...(target.selector ? { selector: target.selector } : {}) } as unknown as BrowserActionCommand;
  try {
    return { outcome: "found", element: { element: resolveTarget(command).element } };
  } catch (error) {
    if (!(error instanceof TargetResolutionError)) throw error;
    return error.failure.code === WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS ? { outcome: "ambiguous" } : { outcome: "not_found" };
  }
}

function matchCount(selector: string, hosts: readonly string[] | undefined): number {
  if (!hosts?.length) return document.querySelectorAll(selector).length;
  const found = new Set<Element>();
  for (const root of resolveShadowScope(hosts).roots) for (const element of root.querySelectorAll(selector)) found.add(element);
  return found.size;
}

/**
 * Shown text by the assertion's read (`innerText`, a field's value), unless a
 * sensitive control holds text inside the element: then the text that may leave
 * the page, with that control left out.
 */
function shownText(element: Element | undefined): FactReading {
  if (!element) return { read: "" };
  if (isWithinSensitiveControl(element)) return { withheld: "sensitive" };
  const holdsSensitiveText = [...element.querySelectorAll(TEXT_BEARING_CONTROLS)].some((control) => isSensitiveFormControl(control));
  return { read: holdsSensitiveText ? textOutsideSensitiveControls(element, "readable") : readElementText(element) };
}

/** What a field holds -- and for a choice, the chosen option's label too, so a claim may name either. */
function fieldValues(element: Element): ReturnType<FactPage["values"]> {
  if (isSensitiveFormControl(element) || isWithinSensitiveControl(element)) return { withheld: "sensitive" };
  if (element instanceof HTMLSelectElement) {
    const labels = [...element.selectedOptions].map((option) => option.label);
    return { read: [element.value, ...labels] };
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return { read: [element.value] };
  if (element instanceof HTMLElement && element.isContentEditable) return { read: [textOutsideSensitiveControls(element)] };
  return { withheld: "no_state" };
}

function checkedState(element: Element): ReturnType<FactPage["checked"]> {
  const input = checkableInput(element);
  if (input) return isSensitiveFormControl(input) ? "sensitive" : input.checked;
  return readChosenState(element)?.chosen;
}

/** A checkbox or radio, or the one a `<label>` names. */
function checkableInput(element: Element): HTMLInputElement | undefined {
  const control = element instanceof HTMLLabelElement ? element.control : element;
  return control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio") ? control : undefined;
}

function selectedState(element: Element): boolean | undefined {
  if (element instanceof HTMLOptionElement) return element.selected;
  return readChosenState(element)?.chosen;
}

/** Who the element is, never what it holds. */
function describe(element: Element): WebAutomationFactElement {
  const role = element.getAttribute("role")?.trim().toLowerCase() || implicitRole(element);
  const testId = element.getAttribute("data-testid") ?? undefined;
  const name = element.getAttribute("name") ?? undefined;
  const accessibleName = accessibleNameFor(element);
  const selector = selectorFor(element);
  return {
    tagName: element.tagName.toLowerCase(),
    ...(role ? { role } : {}),
    ...(element.id ? { id: bounded(element.id) } : {}),
    ...(testId ? { testId: bounded(testId) } : {}),
    ...(name ? { name: bounded(name) } : {}),
    ...(accessibleName ? { accessibleName: bounded(accessibleName) } : {}),
    ...(selector ? { selector } : {})
  };
}

function bounded(text: string): string {
  const collapsed = text.replace(/\s+/gu, " ").trim();
  return collapsed.length <= NAME_MAX ? collapsed : `${collapsed.slice(0, NAME_MAX - 1)}…`;
}

function elementOf(handle: FactElement): Element {
  return handle.element as Element;
}

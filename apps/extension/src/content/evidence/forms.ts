// The forms model: controls grouped by the form that owns them.
//
// A snapshot lists controls in rank order, so the three fields of a login form
// and the two of a search box arrive interleaved with everything else, and
// nothing says which submit button belongs to which. Grouping them restores the
// only structure that matters for filling one in: what has to be answered, what
// is already answered, and what submits it.
//
// Ownership comes from `form.elements`, not from ancestry, so a control that
// claims its form through `form="id"` from elsewhere on the page is grouped
// where it belongs. Controls owned by no form are not reported: a group with no
// form has no identity to report it under, and the controls themselves are
// already in `interactiveElements`.
//
// No control's value appears here, ever -- only whether it holds one, which is
// what `hasEnteredValue` answers without reading anything. `sensitive` marks
// the controls the shared rule in `shared/sensitive-field.ts` protects, so a
// reader knows not to ask for a value that will never be given.

import { selectorFor } from "../describe-element";
import { hasEnteredValue, isSensitiveFormControl } from "../element-traits";
import { accessibleNameFor, boundedText } from "../identity";
import type { FormControlEvidence, FormEvidence } from "./types";

const MAX_FORMS = 8;
const MAX_CONTROLS_PER_FORM = 30;
const MAX_TEXT = 200;
const SUBMIT_SELECTOR = "button[type='submit'],button:not([type]),input[type='submit'],input[type='image']";

/** Every form on the page with its controls, or `undefined` when the page has none. */
export function formEvidence(): FormEvidence[] | undefined {
  const forms: FormEvidence[] = [];
  for (const form of document.forms) {
    forms.push(describeForm(form));
    if (forms.length >= MAX_FORMS) break;
  }
  return forms.length ? forms : undefined;
}

function describeForm(form: HTMLFormElement): FormEvidence {
  const owned = [...form.elements].filter(isReportableControl);
  const label = accessibleNameFor(form);
  const name = boundedText(form.getAttribute("name"), MAX_TEXT);
  const action = boundedText(form.getAttribute("action"), MAX_TEXT);
  const method = boundedText(form.getAttribute("method"), MAX_TEXT)?.toLowerCase();
  const submit = owned.find((control) => control.matches(SUBMIT_SELECTOR));
  return {
    selector: selectorFor(form),
    ...(name ? { name } : {}),
    ...(label ? { label } : {}),
    ...(action ? { action } : {}),
    ...(method ? { method } : {}),
    controlCount: owned.length,
    controls: owned.slice(0, MAX_CONTROLS_PER_FORM).map(describeControl),
    ...(submit ? { submit: selectorFor(submit) } : {})
  };
}

/** A hidden input is state the page keeps, not a control anyone fills in. */
function isReportableControl(element: Element): boolean {
  return !(element instanceof HTMLInputElement && element.type.toLowerCase() === "hidden");
}

function describeControl(element: Element): FormControlEvidence {
  const label = accessibleNameFor(element);
  const name = boundedText(element.getAttribute("name"), MAX_TEXT);
  const valuePresent = hasEnteredValue(element);
  return {
    selector: selectorFor(element),
    controlType: controlType(element),
    ...(name ? { name } : {}),
    ...(label ? { label } : {}),
    ...(isRequired(element) ? { required: true as const } : {}),
    ...(isDisabled(element) ? { disabled: true as const } : {}),
    ...(valuePresent === undefined ? {} : { hasValue: valuePresent }),
    ...(isSensitiveFormControl(element) ? { sensitive: true as const } : {})
  };
}

/** The kind a reader has to act on: an input's `type`, and otherwise the tag itself. */
function controlType(element: Element): string {
  if (element instanceof HTMLInputElement) return element.type.toLowerCase();
  if (element instanceof HTMLButtonElement) return element.type.toLowerCase();
  return element.tagName.toLowerCase();
}

function isRequired(element: Element): boolean {
  return element.hasAttribute("required") || element.getAttribute("aria-required") === "true";
}

function isDisabled(element: Element): boolean {
  return element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
}

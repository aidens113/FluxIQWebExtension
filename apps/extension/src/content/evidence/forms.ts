// The forms model: controls grouped by the form that owns them.
//
// A snapshot lists every element in document order, so the three fields of a
// login form and the two of a search box arrive among everything else around
// them, and nothing says which submit button belongs to which. Grouping them restores the
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
//
// The `autocomplete` tokens travel beside that verdict, and the two are not
// redundant. `sensitive` is this producer's conclusion; the tokens are the
// evidence it drew it from, so the domain can reach the same conclusion on its
// own. Until they did, a field marked `billing cc-number` was protected by this
// one flag and nothing else -- and that exact token list has slipped past a
// copy of the rule twice in this plan.
//
// Every form and every control it owns is reported (t200): there was a cap of
// eight forms and thirty controls a form, and text cut to 200 characters.

import { selectorFor } from "../selector";
import { hasEnteredValue, isSensitiveFormControl } from "../element-traits";
import { accessibleNameFor, normalizedText } from "../identity";
import { queryComposedInOrder } from "../shadow-dom";
import { present } from "../../shared/present";
import type { FormControlEvidence, FormEvidence } from "./types";

const SUBMIT_SELECTOR = "button[type='submit'],button:not([type]),input[type='submit'],input[type='image']";

/**
 * Every form on the page with every control it owns, in composed document
 * order, or `undefined` when the page has none. A form inside an open shadow
 * root is one of the page's forms: `document.forms` never lists it, and a
 * consent or sign-in widget is often exactly that.
 */
export function formEvidence(): FormEvidence[] | undefined {
  const forms = queryComposedInOrder("form")
    .filter((form): form is HTMLFormElement => form instanceof HTMLFormElement)
    .map(describeForm);
  return forms.length ? forms : undefined;
}

function describeForm(form: HTMLFormElement): FormEvidence {
  const owned = [...form.elements].filter(isReportableControl);
  const label = accessibleNameFor(form);
  const name = normalizedText(form.getAttribute("name"));
  const action = normalizedText(form.getAttribute("action"));
  const method = normalizedText(form.getAttribute("method"))?.toLowerCase();
  const submit = owned.find((control) => control.matches(SUBMIT_SELECTOR));
  return present<FormEvidence>({
    selector: selectorFor(form),
    name: name || undefined,
    label: label || undefined,
    action: action || undefined,
    method: method || undefined,
    controlCount: owned.length,
    controls: owned.map(describeControl),
    submit: submit ? selectorFor(submit) : undefined
  });
}

/** A hidden input is state the page keeps, not a control anyone fills in. */
function isReportableControl(element: Element): boolean {
  return !(element instanceof HTMLInputElement && element.type.toLowerCase() === "hidden");
}

function describeControl(element: Element): FormControlEvidence {
  const label = accessibleNameFor(element);
  const name = normalizedText(element.getAttribute("name"));
  const valuePresent = hasEnteredValue(element);
  const autocomplete = autocompleteTokens(element);
  return present<FormControlEvidence>({
    selector: selectorFor(element),
    controlType: controlType(element),
    name: name || undefined,
    label: label || undefined,
    required: isRequired(element) ? true : undefined,
    disabled: isDisabled(element) ? true : undefined,
    hasValue: valuePresent,
    autocomplete: autocomplete || undefined,
    sensitive: isSensitiveFormControl(element) ? true : undefined
  });
}

/**
 * The `autocomplete` attribute as whole tokens, for the consumer's own copy of
 * the sensitivity decision.
 *
 * Every token, each whole: a slice through the middle of a token destroys the
 * very signal the consumer is being given -- `billing cc-number` cut to
 * `billing cc-nu` matches nothing -- so a value the rule would call sensitive
 * here is a value it will call sensitive at the other end. There is no token
 * count or token length bound either (t200).
 */
function autocompleteTokens(element: Element): string | undefined {
  const tokens = (element.getAttribute("autocomplete") ?? "").split(/\s+/u).filter(Boolean);
  return tokens.length ? tokens.join(" ") : undefined;
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

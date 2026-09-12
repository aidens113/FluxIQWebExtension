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
//
// The `autocomplete` tokens travel beside that verdict, and the two are not
// redundant. `sensitive` is this producer's conclusion; the tokens are the
// evidence it drew it from, so the domain can reach the same conclusion on its
// own. Until they did, a field marked `billing cc-number` was protected by this
// one flag and nothing else -- and that exact token list has slipped past a
// copy of the rule twice in this plan.

import { selectorFor } from "../describe-element";
import { hasEnteredValue, isSensitiveFormControl } from "../element-traits";
import { accessibleNameFor, boundedText } from "../identity";
import { present } from "../../shared/present";
import type { FormControlEvidence, FormEvidence } from "./types";

const MAX_FORMS = 8;
const MAX_CONTROLS_PER_FORM = 30;
const MAX_TEXT = 200;
// `autocomplete` is bounded by whole tokens rather than by characters. A
// character slice can cut `billing cc-number` into `billing cc-nu`, which
// matches nothing -- truncating the input to a security predicate is a way past
// it, and that is how one copy of the rule missed a card field already. A
// legitimate value is at most a `section-*` name, a shipping/billing
// qualifier, a contact kind, a field name and `webauthn`, so these bounds
// cannot touch one; they exist only because a page controls this string and it
// travels on a wire.
const MAX_AUTOCOMPLETE_TOKENS = 16;
const MAX_AUTOCOMPLETE_TOKEN_LENGTH = 64;
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
  return present<FormEvidence>({
    selector: selectorFor(form),
    name: name || undefined,
    label: label || undefined,
    action: action || undefined,
    method: method || undefined,
    controlCount: owned.length,
    controls: owned.slice(0, MAX_CONTROLS_PER_FORM).map(describeControl),
    submit: submit ? selectorFor(submit) : undefined
  });
}

/** A hidden input is state the page keeps, not a control anyone fills in. */
function isReportableControl(element: Element): boolean {
  return !(element instanceof HTMLInputElement && element.type.toLowerCase() === "hidden");
}

function describeControl(element: Element): FormControlEvidence {
  const label = accessibleNameFor(element);
  const name = boundedText(element.getAttribute("name"), MAX_TEXT);
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
 * Deliberately not `boundedText`: that collapses and slices to 200 characters,
 * and a slice through the middle of a token destroys the very signal the
 * consumer is being given. Every token is kept whole, so a value the rule would
 * call sensitive here is a value it will call sensitive at the other end.
 */
function autocompleteTokens(element: Element): string | undefined {
  const tokens = (element.getAttribute("autocomplete") ?? "")
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, MAX_AUTOCOMPLETE_TOKENS)
    // A token longer than this is not an autocomplete token; its leading
    // characters are kept rather than dropped, so a prefix the rule matches on
    // still arrives.
    .map((token) => token.slice(0, MAX_AUTOCOMPLETE_TOKEN_LENGTH));
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

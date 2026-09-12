// Enter in a text field submits its form. That is implicit submission, a
// default action of the trusted key, so a synthetic Enter never performs it
// and the emulation has to.
//
// `form.requestSubmit(button)` is used rather than `form.submit()` for two
// reasons: `submit()` skips both the `submit` event and constraint validation,
// so a page that saves in its own handler would never save and an invalid form
// would go through; and a real Enter activates the form's default button, which
// `requestSubmit` reports as `event.submitter`. A page that branches on the
// submitter -- which one of several buttons was pressed -- sees what it would
// have seen from the keyboard.
//
// HTML only submits implicitly when the form has a submit button, or when it
// has exactly one field that blocks implicit submission. Both conditions are
// checked here, so Enter in a multi-field form with no submit button correctly
// does nothing.

import { isTextField } from "./editable-target";

export type FormSubmissionOutcome = {
  kind: "submitted" | "blocked" | "no-default-button" | "not-a-form-field";
  /** What happened, in the words the action result reports. */
  detail: string;
  /** How the form is named in a validation, when there is one. */
  form?: string;
};

export function submitOwningForm(element: Element): FormSubmissionOutcome {
  if (!(element instanceof HTMLInputElement) || !isTextField(element)) {
    return { kind: "not-a-form-field", detail: `Enter has no default action on <${element.tagName.toLowerCase()}>` };
  }
  const form = element.form;
  if (!form) return { kind: "not-a-form-field", detail: "the field belongs to no form, so Enter submits nothing" };

  const label = formLabel(form);
  const submitter = defaultSubmitButton(form);
  if (!submitter && implicitSubmissionBlockers(form) !== 1) {
    return { kind: "no-default-button", form: label, detail: `${label} has no submit button and more than one field, so Enter does not submit it` };
  }
  return requestSubmit(form, label, submitter);
}

/** Submits, and reports what the form did rather than assuming it submitted. */
function requestSubmit(form: HTMLFormElement, label: string, submitter: HTMLElement | undefined): FormSubmissionOutcome {
  let submitted = false;
  const observe = (): void => { submitted = true; };
  form.addEventListener("submit", observe, { capture: true, once: true });
  try {
    if (submitter) form.requestSubmit(submitter);
    else form.requestSubmit();
  } catch (error) {
    return { kind: "blocked", form: label, detail: `${label} refused to submit: ${error instanceof Error ? error.message : "the browser rejected the request"}` };
  } finally {
    form.removeEventListener("submit", observe, { capture: true });
  }
  if (!submitted) {
    return { kind: "blocked", form: label, detail: `${label} did not fire a submit event; its own constraint validation refused the submission` };
  }
  return {
    kind: "submitted",
    form: label,
    detail: `${label} fired a submit event${submitter ? ` with ${buttonLabel(submitter)} as the submitter` : " with no submitter"}`
  };
}

/** The button a trusted Enter would activate: the form's first enabled submit button. */
function defaultSubmitButton(form: HTMLFormElement): HTMLElement | undefined {
  for (const candidate of form.elements) {
    if (candidate instanceof HTMLButtonElement && candidate.type === "submit" && !candidate.disabled) return candidate;
    if (candidate instanceof HTMLInputElement && candidate.type === "submit" && !candidate.disabled) return candidate;
  }
  return undefined;
}

/** How many fields block implicit submission: with exactly one, a form submits without a button. */
function implicitSubmissionBlockers(form: HTMLFormElement): number {
  let count = 0;
  for (const candidate of form.elements) {
    if (candidate instanceof HTMLInputElement && isTextField(candidate)) count += 1;
  }
  return count;
}

function formLabel(form: HTMLFormElement): string {
  const testId = form.dataset.testid;
  if (testId) return `the form [data-testid="${testId}"]`;
  if (form.id) return `the form #${form.id}`;
  if (form.name) return `the form named "${form.name}"`;
  return "the form";
}

function buttonLabel(button: HTMLElement): string {
  const testId = button.dataset.testid;
  if (testId) return `[data-testid="${testId}"]`;
  if (button.id) return `#${button.id}`;
  const text = button.textContent?.replace(/\s+/gu, " ").trim();
  return text ? `the "${text}" button` : "the form's default button";
}

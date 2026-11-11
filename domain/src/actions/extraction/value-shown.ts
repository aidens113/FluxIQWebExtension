/**
 * What a `value` field reads of an element beyond a form control's live value:
 * the things the page view prints after an element's words, so what a person is
 * shown can be read back as a column from the same source (invariant I7).
 * `label` is a select's chosen option's label (its live value is the option's
 * value, not the words the page shows); `options` its option labels joined by
 * `|`; `checked` is `checked` or `unchecked` for a checkbox or radio's live state
 * (or an `aria-checked` the page states); `disabled` is `disabled` where the
 * element is disabled, by attribute, `aria-disabled` or a refusing cursor, and
 * nothing otherwise; `marked` is `marked` where the page draws the element apart
 * from the like options beside it, and nothing otherwise.
 */
export type WebAutomationExtractValueShown = "label" | "options" | "checked" | "disabled" | "marked";

export const WEB_AUTOMATION_EXTRACT_VALUE_SHOWN = ["label", "options", "checked", "disabled", "marked"] as const satisfies readonly WebAutomationExtractValueShown[];

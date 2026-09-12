// The select verb: choose one option in the resolved `<select>`, by value,
// label, or index, and prove the select ended up holding it.
//
// The option has to exist before anything changes. A request naming an option
// the select does not have leaves the page exactly as it was and reports a
// failed validation, which `success()` turns into a `failed` result carrying
// Core's `output_not_observed`. Before Wave 2 the same request assigned the
// unmatched value, which blanked the select, and still reported success: that
// is the "unreliable" row the action audit recorded for this verb.
//
// Selection goes through `selectedIndex` rather than `value`, so a request by
// label or index is never translated into a value two options could share, and
// the value is read back from the element afterwards rather than assumed --
// the validation compares what the select holds with what was asked for, so a
// page that reverts the choice in its own `change` handler reports `failed`
// instead of a silent no-op.
//
// Two gates run before any of that. The select itself goes through the
// actionability capability, as `web.dom.click`'s target does, so a disabled,
// hidden, or covered select is ACTION_REJECTED with the capability's code
// rather than reported as a selection nobody could observe. The chosen option
// is then checked for `:disabled` here rather than through that capability,
// because an option in a closed select has no box and no point to hit-test:
// the capability would refuse it as `hidden`, which is not why it cannot be
// chosen. `:disabled` rather than the `disabled` property, so an option inside
// a disabled `<optgroup>` is caught too. The code reported is the same
// `disabled` the capability would report, so a caller reads one vocabulary.
//
// A select marked sensitive is the case that makes this verb redact. Its value
// space is the option list, so a failed match that named the option the request
// asked for, the value the select still held, and every option it offers would
// publish the secret three ways in one string -- and narrow it to a twenty-item
// list even where no single string held it. Whether the select ended up holding
// the chosen option is still reported; nothing about the option is quoted. The
// sensitivity test is the one shared rule, reached through
// `isSensitiveFormControl`.
//
// Every validation this verb builds declares that redaction with
// `redacted: withheld`, because the domain cannot tell an already-redacted
// string from a leaked one and withholds the whole comparison without the
// declaration. This verb has the most to lose from that: "no option matched;
// the select still holds a withheld value of 4 characters and offers 12
// withheld options" says why the selection failed while naming nothing, and
// the marker that would replace it says only that something was withheld.
//
// The declaration is on the four `success()` validations. The `:disabled`
// rejection below carries none, and cannot: `actionRejected` builds its own
// validation from two strings and takes no such parameter. That is a live gap
// rather than a decision made here -- see reports/v-redaction-producer.md.

import { isSensitiveFormControl } from "../element-traits";
import type { BrowserActionCommand, BrowserActionResult, WebAutomationOptionSelector } from "../types";
import type { ContentActionDependencies } from "./types";
import { describeFieldValue } from "./value-redaction";

/** How many options a failed validation lists, so a select with thousands cannot build a huge string. */
const OPTIONS_LISTED_ON_FAILURE = 20;

export function selectAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action);
  const withheld = isSensitiveFormControl(element);
  const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot() });
  const request = requestedOption(action);

  const report = deps.checkActionability(element);
  if (!report.actionable) {
    return deps.rejected(action, startedAt, report.code, "a target that can be selected in", report.detail, evidence());
  }

  if (!request) {
    return deps.success(action, startedAt, "No option was named.", {
      status: "failed",
      expected: "an option named by value, label, or index",
      actual: "the command named none",
      redacted: withheld
    }, evidence());
  }
  if (!(element instanceof HTMLSelectElement)) {
    return deps.success(action, startedAt, "The target is not a select element.", {
      status: "failed",
      expected: `a select element to choose ${describeRequest(request, withheld)} in`,
      actual: `the target is a <${element.tagName.toLowerCase()}>`,
      redacted: withheld
    }, evidence());
  }

  const option = findOption(element, request);
  if (!option) {
    return deps.success(action, startedAt, `No option matched ${describeRequest(request, withheld)}.`, {
      status: "failed",
      expected: `an option matching ${describeRequest(request, withheld)} is selected`,
      actual: `no option matched; the select still holds ${describeFieldValue(element.value, withheld)} and offers ${listOptions(element, withheld)}`,
      redacted: withheld
    }, evidence());
  }

  if (option.matches(":disabled")) {
    return deps.rejected(
      action,
      startedAt,
      "disabled",
      `a selectable option matching ${describeRequest(request, withheld)}`,
      `${describeOption(option, withheld)} is disabled`,
      evidence()
    );
  }

  element.focus();
  element.selectedIndex = option.index;
  deps.dispatchInputEvents(element);

  const selected = element.value;
  const held = selected === option.value;
  return deps.success(action, startedAt, held ? "Option selected." : "The select did not keep the chosen option.", {
    status: held ? "passed" : "failed",
    expected: `selected value ${describeFieldValue(option.value, withheld)} (${describeRequest(request, withheld)})`,
    actual: selectedValueText(selected, option.value, withheld),
    redacted: withheld
  }, evidence());
}

/**
 * What the select ended up holding. A withheld value cannot be quoted, so the
 * mismatch that makes the read-back worth doing is stated in words instead; a
 * match needs no words, because `expected` names the same withheld value.
 */
function selectedValueText(selected: string, chosen: string, withheld: boolean): string {
  if (withheld && selected !== chosen) {
    return `selected ${describeFieldValue(selected, true)}, which is not the option that was chosen`;
  }
  return `selected value ${describeFieldValue(selected, withheld)}`;
}

/** The option a rejection names. A sensitive select's option is its value, so it is named by position, not content. */
function describeOption(option: HTMLOptionElement, withheld: boolean): string {
  if (withheld) return `the matched option at index ${option.index}`;
  return `the option "${option.value}" (${normalizeLabel(optionLabel(option))})`;
}

/** The option the command names: the explicit selector, or the legacy `value` field a recorded change still sends. */
function requestedOption(action: BrowserActionCommand): WebAutomationOptionSelector | undefined {
  if (action.option) return action.option;
  if (action.value !== undefined) return { by: "value", value: action.value };
  return undefined;
}

/** The one option matching the request, or nothing: an index outside the list matches no option. */
function findOption(element: HTMLSelectElement, request: WebAutomationOptionSelector): HTMLOptionElement | undefined {
  const options = [...element.options];
  if (request.by === "value") return options.find((option) => option.value === request.value);
  if (request.by === "label") {
    const wanted = normalizeLabel(request.label);
    return options.find((option) => normalizeLabel(optionLabel(option)) === wanted);
  }
  return Number.isInteger(request.index) ? options[request.index] : undefined;
}

/**
 * How the request reads in a message or a validation, with the value or label
 * it named -- or, for a sensitive select, without it: what a request asks a
 * sensitive select to hold is as much a secret as what it holds. An index names
 * a position rather than content, so it travels either way.
 */
function describeRequest(request: WebAutomationOptionSelector, withheld: boolean): string {
  if (request.by === "value") return `value ${describeFieldValue(request.value, withheld)}`;
  if (request.by === "label") return `label ${describeFieldValue(request.label, withheld)}`;
  return `index ${request.index}`;
}

/**
 * What the select does offer, so a failed match says why rather than only that
 * it failed. A sensitive select's options are its value space, so listing them
 * narrows the secret to twenty candidates: only how many there are travels.
 */
function listOptions(element: HTMLSelectElement, withheld: boolean): string {
  const options = [...element.options];
  if (!options.length) return "no options";
  if (withheld) return `${options.length} withheld option${options.length === 1 ? "" : "s"}`;
  const listed = options
    .slice(0, OPTIONS_LISTED_ON_FAILURE)
    .map((option) => `"${option.value}" (${normalizeLabel(optionLabel(option))})`)
    .join(", ");
  return options.length > OPTIONS_LISTED_ON_FAILURE ? `${listed}, and ${options.length - OPTIONS_LISTED_ON_FAILURE} more` : listed;
}

/** An option's label attribute, or the text the user reads when it has none. */
function optionLabel(option: HTMLOptionElement): string {
  return option.label || option.textContent || "";
}

/** Labels are matched on their visible form: page markup wraps and indents option text freely. */
function normalizeLabel(label: string): string {
  return label.replace(/\s+/gu, " ").trim();
}

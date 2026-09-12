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

import type { BrowserActionCommand, BrowserActionResult, WebAutomationOptionSelector } from "../types";
import type { ContentActionDependencies } from "./types";

/** How many options a failed validation lists, so a select with thousands cannot build a huge string. */
const OPTIONS_LISTED_ON_FAILURE = 20;

export function selectAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action);
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
      actual: "the command named none"
    }, evidence());
  }
  if (!(element instanceof HTMLSelectElement)) {
    return deps.success(action, startedAt, "The target is not a select element.", {
      status: "failed",
      expected: `a select element to choose ${describeRequest(request)} in`,
      actual: `the target is a <${element.tagName.toLowerCase()}>`
    }, evidence());
  }

  const option = findOption(element, request);
  if (!option) {
    return deps.success(action, startedAt, `No option matched ${describeRequest(request)}.`, {
      status: "failed",
      expected: `an option matching ${describeRequest(request)} is selected`,
      actual: `no option matched; the select still holds "${element.value}" and offers ${listOptions(element)}`
    }, evidence());
  }

  if (option.matches(":disabled")) {
    return deps.rejected(
      action,
      startedAt,
      "disabled",
      `a selectable option matching ${describeRequest(request)}`,
      `the option "${option.value}" (${normalizeLabel(optionLabel(option))}) is disabled`,
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
    expected: `selected value "${option.value}" (${describeRequest(request)})`,
    actual: `selected value "${selected}"`
  }, evidence());
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

/** How the request reads in a message or a validation, with the value or label it named. */
function describeRequest(request: WebAutomationOptionSelector): string {
  if (request.by === "value") return `value "${request.value}"`;
  if (request.by === "label") return `label "${request.label}"`;
  return `index ${request.index}`;
}

/** What the select does offer, so a failed match says why rather than only that it failed. */
function listOptions(element: HTMLSelectElement): string {
  const options = [...element.options];
  const listed = options
    .slice(0, OPTIONS_LISTED_ON_FAILURE)
    .map((option) => `"${option.value}" (${normalizeLabel(optionLabel(option))})`)
    .join(", ");
  if (!listed) return "no options";
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

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
// sensitivity test is the one shared rule, asked of the select and of every
// element it sits in (`isWithinSensitiveControl`).
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
//
// An option the select does not offer is its own failure, OPTION_NOT_OFFERED,
// which is not retryable (t464): asking the same select for the same value
// again is answered the same way. Lane B round 8 (`run-mv5jnc62-01c3609a`)
// sent a quantity select `"2"` with its quote marks; the failure was marked
// retryable, so it was tried four times in each of four trials and the build
// spent a trial testing the same revision again. Two things keep that honest.
// A page that fills a select in late (a second select whose options load once
// the first is chosen) is waited for here, up to `OPTION_WAIT_MS`, before the
// option is called missing, so what a retry would have bought is bought once,
// inside the verb. And the failure names the value sent -- in JSON quotes, so
// its own quote marks show -- and the options closest to it, saying when the
// closest differs only by quote marks, spaces or letter case
// (`./closest-options.ts`), from the select's own options and only for a
// select that is not sensitive.
//
// A request by value that names no option's value is matched against the
// options' visible words, when exactly one option carries them (t509,
// `findOption`): the words are what the page view shows of a select.

import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import { isWithinSensitiveControl } from "../sensitive-text";
import type { BrowserActionCommand, BrowserActionResult, WebAutomationOptionSelector } from "../types";
import type { ContentActionDependencies } from "./types";
import { closestOfferedOptions } from "./closest-options";
import { describeFieldValue } from "./value-redaction";

/** How many options a failed validation lists, so a select with thousands cannot build a huge string. */
const OPTIONS_LISTED_ON_FAILURE = 20;
/** How many of the closest options a failed match names before the full list. */
const CLOSEST_LISTED_ON_FAILURE = 5;
/** How long a select is watched for an option it does not offer yet, for a page that fills its options in late (header). */
const OPTION_WAIT_MS = 2_000;
/** How often the watched select is read again within that wait. */
const OPTION_POLL_MS = 100;

export async function selectAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  const { element, resolution } = deps.resolveTarget(action);
  const withheld = isWithinSensitiveControl(element);
  const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot(), resolution });
  const request = requestedOption(action);

  const report = deps.checkActionability(element);
  if (!report.actionable) {
    return deps.rejected(action, startedAt, report.code, "a target that can be selected in", report.detail, { ...evidence(), blockedAt: report.point, target: element, refusedBeforeDispatch: true });
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

  const option = findOption(element, request) ?? await optionFilledInLate(element, request);
  if (!option) {
    return deps.success(action, startedAt, `No option matched ${describeRequest(request, withheld)}.`, {
      status: "failed",
      expected: `an option matching ${describeRequest(request, withheld)} is selected`,
      actual: `no option matched${sentAndClosest(element, request, withheld)}; the select still holds ${describeFieldValue(element.value, withheld)} and offers ${listOptions(element, withheld)}`,
      redacted: withheld
    }, evidence(), WEB_AUTOMATION_FAILURE_CODES.OPTION_NOT_OFFERED);
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
 * The option asked for, once the select has been read again every
 * `OPTION_POLL_MS` for up to `OPTION_WAIT_MS`; nothing if it never appeared or
 * the select left the page. An index request waits too: a list filled in late
 * is short until it is filled.
 */
async function optionFilledInLate(element: HTMLSelectElement, request: WebAutomationOptionSelector): Promise<HTMLOptionElement | undefined> {
  const deadline = Date.now() + OPTION_WAIT_MS;
  while (Date.now() < deadline && element.isConnected) {
    await new Promise((resolve) => setTimeout(resolve, OPTION_POLL_MS));
    const found = findOption(element, request);
    if (found) return found;
  }
  return undefined;
}

/**
 * The value sent and the options closest to it, after "no option matched"
 * (header). The value is written as JSON, so quote marks it carries show as
 * themselves. Nothing for a sensitive select, whose options and request are
 * its secret, nor for an index, which names a position the list states.
 */
function sentAndClosest(element: HTMLSelectElement, request: WebAutomationOptionSelector, withheld: boolean): string {
  if (withheld || request.by === "index") return "";
  const sent = request.by === "value" ? request.value : request.label;
  const options = [...element.options].map((option) => ({ value: option.value, label: normalizeLabel(optionLabel(option)) }));
  const { closest, sameButQuoting } = closestOfferedOptions(sent, options, CLOSEST_LISTED_ON_FAILURE);
  const named = `the ${request.by} sent was ${JSON.stringify(sent)} (${sent.length} character${sent.length === 1 ? "" : "s"})`;
  if (!closest.length) return `: ${named}`;
  const listed = closest.map((option) => `"${option.value}" (${option.label})`).join(", ");
  const same = sameButQuoting ? `; "${sameButQuoting.value}" differs from it only by quote marks, spaces or letter case, so send exactly ${JSON.stringify(request.by === "value" ? sameButQuoting.value : sameButQuoting.label)}` : "";
  return `: ${named}; the closest options offered are ${listed}${same}`;
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

/**
 * The one option matching the request, or nothing: an index outside the list
 * matches no option. A value that is no option's value is matched against the
 * options' visible words, spacing and letter case aside, when exactly one
 * option carries them (t509): the page view shows a select's options by their
 * words alone, so a model sends those, and a distance select's "10 miles"
 * (value "10") failed three times in `run-mv6qrcdu-a31b44b8`. Two options with
 * the same words match neither, so the choice is never a guess.
 */
function findOption(element: HTMLSelectElement, request: WebAutomationOptionSelector): HTMLOptionElement | undefined {
  const options = [...element.options];
  if (request.by === "value") return options.find((option) => option.value === request.value) ?? onlyOptionReading(options, request.value);
  if (request.by === "label") {
    const wanted = normalizeLabel(request.label);
    return options.find((option) => normalizeLabel(optionLabel(option)) === wanted);
  }
  return Number.isInteger(request.index) ? options[request.index] : undefined;
}

/** The one option whose visible words are `words`, spacing and letter case aside; nothing when none or several are. */
function onlyOptionReading(options: readonly HTMLOptionElement[], words: string): HTMLOptionElement | undefined {
  const wanted = normalizeLabel(words).toLowerCase();
  if (!wanted) return undefined;
  const reading = options.filter((option) => normalizeLabel(optionLabel(option)).toLowerCase() === wanted);
  return reading.length === 1 ? reading[0] : undefined;
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

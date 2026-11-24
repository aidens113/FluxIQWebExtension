// The options a saved act requires chosen, checked before the act runs (t1030).
//
// **The defect this closes.** A Flow saved while the site already had the
// person's option chosen (t1023: Core counts the option done by the act's own
// step) has no step that chooses it, so played back on a page that arrives
// with another option chosen it did the lasting act with that option, and
// nothing refused. Core now writes the option onto the act's node as
// `requiresChosen` (`domain/src/actions/requires-chosen/`), and this is where
// the page answers it, before the verb touches anything.
//
// **How each option is read.** Found again by its address and identity, as
// any target is (`../resolve-target.ts`), hidden or not -- a closed chooser
// still holds what it shows -- and read by the page's own typed state, the
// same states the page view prints as chosen (`checked`, `selected`,
// `pressed`, `current`, `marked`; domain `runtime/llm-evidence/node-run/standing-choices/page-choices.ts`):
// a checkbox or radio's `checked`, `aria-checked`, `aria-selected`,
// `aria-pressed`, `aria-current`, or being the one member of its like options
// drawn apart (`../../evidence/set-apart.ts`). Never its words: the words only
// name the option in what is said.
//
// **What it answers.** An option not found, or found and not chosen, refuses
// the act unrun with OPTION_NOT_CHOSEN: Core's `target_not_found`, stated
// unacted, so a Flow run routes by page state as for any step that cannot run,
// and a repair may add the step that chooses it. Never pressed on silently.

import {
  WEB_AUTOMATION_FAILURE_CODES,
  webAutomationFailureRecord,
  type WebAutomationFailureCarrier,
  type WebAutomationFailureRecord,
  type WebAutomationRequiredChoice
} from "@fluxiq-web-extension/domain/client";
import { setApartFromLikeSiblings } from "../../evidence";
import type { BrowserActionCommand } from "../../types";
import { TargetResolutionError, type ResolvedTarget } from "../resolve-target";

/**
 * An act refused because an option it requires does not stand chosen; carries
 * its record for `../results.ts`. Its words say which of the act's options it
 * was, by position, and never the option's own words: a record carries no page
 * text (`WebAutomationFailureComparison`).
 */
export class OptionNotChosenError extends Error implements WebAutomationFailureCarrier {
  readonly failure: WebAutomationFailureRecord;

  constructor(position: number, found: boolean) {
    const actual = found ? `required option ${position} is not chosen on the page` : `required option ${position} is not on the page`;
    super(`The step was not run: ${actual}, so it would have acted with another option.`);
    this.name = "OptionNotChosenError";
    this.failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OPTION_NOT_CHOSEN, { expected: "every option the step requires chosen before it", actual });
  }
}

/**
 * The first option `action` requires chosen that does not stand chosen, as the
 * error that refuses the act, or nothing when every one stands (or it requires
 * none). `resolve` finds a target as the verbs do; it is given a command naming
 * only the option, so no row or pass scoping of the act's own target applies.
 */
export function requiredChoiceUnmet(action: BrowserActionCommand, resolve: (command: BrowserActionCommand) => ResolvedTarget): OptionNotChosenError | undefined {
  for (const [index, choice] of (action.requiresChosen ?? []).entries()) {
    let element: Element;
    try {
      element = resolve(commandFor(action, choice)).element;
    } catch (error) {
      // Not found, or not one: the option cannot be read, so it is not known to stand chosen.
      if (error instanceof TargetResolutionError) return new OptionNotChosenError(index + 1, false);
      throw error;
    }
    if (!standsChosen(element)) return new OptionNotChosenError(index + 1, true);
  }
  return undefined;
}

/** A command naming only the option, under the act's own id and type: what the resolver reads a target from. */
function commandFor(action: BrowserActionCommand, choice: WebAutomationRequiredChoice): BrowserActionCommand {
  return { commandId: action.commandId, actionType: action.actionType, selector: choice.at.selector, ...(choice.at.element ? { element: choice.at.element } : {}) } as BrowserActionCommand;
}

/** Whether the page shows `element` chosen by its own typed state (header). */
export function standsChosen(element: Element): boolean {
  const input = element as Partial<HTMLInputElement>;
  if (element.tagName?.toLowerCase() === "input" && (input.type === "checkbox" || input.type === "radio") && input.checked === true) return true;
  if (["aria-checked", "aria-selected", "aria-pressed"].some((name) => element.getAttribute?.(name)?.trim().toLowerCase() === "true")) return true;
  const current = element.getAttribute?.("aria-current")?.trim().toLowerCase();
  if (current !== undefined && current !== "" && current !== "false") return true;
  return typeof element.classList === "object" && element.classList.length > 0 && setApartFromLikeSiblings(element);
}

// The options a saved act requires chosen before it runs (t1030), read off an
// untrusted parameter (a Flow node's `requiresChosen`). Nothing is coerced: an
// entry of an unknown shape makes the whole list unreadable, and the command
// that carries it is refused rather than run without its check
// (`../../client/gateway-mapping.ts`), because an act that would press on with
// the wrong option is the defect the check exists for.
//
// Core writes the list (`AS/runtime/flow-authoring/bootstrap/instructed-acts/chosen-precondition.ts`):
// each entry is `{ at, words }`, `at` being what the build's look resolved the
// option to (`../../runtime/llm-evidence/node-run/standing-choices/at.ts`), the
// address and identity a press step keeps for its own control. The content
// script finds each option again by it and reads its chosen state from the page's
// typed state before the act (`apps/extension/src/content/action-runtime/required-choices/`).

import { elementFingerprint } from "../../output-nodes/targets";
import type { WebAutomationElementFingerprint } from "../types";

/** The most options one act may require chosen, as Core's statement bounds the options that stood. */
export const WEB_AUTOMATION_REQUIRES_CHOSEN_MOST = 16;

/** One option an act requires chosen: where it is found again, and its words, which only name it. */
export type WebAutomationRequiredChoice = { at: { selector: string; element?: WebAutomationElementFingerprint | undefined }; words: string };

/** The options, or nothing when the value is no such list: empty, too long, or with any entry of another shape. */
export function webAutomationRequiresChosenValue(value: unknown): WebAutomationRequiredChoice[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > WEB_AUTOMATION_REQUIRES_CHOSEN_MOST) return undefined;
  const choices: WebAutomationRequiredChoice[] = [];
  for (const entry of value) {
    const choice = requiredChoice(entry);
    if (!choice) return undefined;
    choices.push(choice);
  }
  return choices;
}

function requiredChoice(value: unknown): WebAutomationRequiredChoice | undefined {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "at" && key !== "words")) return undefined;
  const words = typeof value.words === "string" ? value.words.trim() : "";
  const at = value.at;
  if (!words || !isRecord(at) || Object.keys(at).some((key) => key !== "selector" && key !== "element")) return undefined;
  const selector = typeof at.selector === "string" ? at.selector.trim() : "";
  if (!selector) return undefined;
  const element = at.element === undefined ? undefined : elementFingerprint(at.element);
  if (at.element !== undefined && element === undefined) return undefined;
  return { at: { selector, ...(element ? { element } : {}) }, words };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

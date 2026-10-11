// A control the site renamed, recognised by what the rename left alone (t446).
//
// Paid run R4b (`run-mv4dgmki-2b13db91`) is the case: a redesign renamed the
// recorded "Add to cart" to "Add to basket", and the in-run repair naming the
// new control was refused `target_unanchored`, because the check recognised a
// rename only through a name kept whole or shortened, or through the recorded
// form -- and that page had no form. The recorded control was a `<div>` in
// `main` with a test id and a hashed class; the new one was a `<div>` in `main`
// with another hashed class, no test id, and "Buy now" beside it. A rename like
// that is what in-run repair is for.
//
// Nothing here knows any site's words. What a rename keeps is read from the
// control and the recording alone:
//
// - **Its kind.** The same tag, the same authored role, the same input type.
//   Kinds that conflict were already refused (`./equivalence.ts`); here an
//   unstated difference is not given the benefit of the doubt.
// - **Its place.** Every landmark and form the recording stated, and neither in
//   a repeated list or table (`./control-place.ts`).
// - **Its action.** The name keeps every word of the recorded name but the
//   last, and only that last word is another: "Add to cart" to "Add to
//   basket", "Save to cookbook" to "Save to collection". The action and how it
//   attaches survive; only the thing it acts on was renamed. A control of
//   another purpose in the same place -- "Buy now", "Place order", "Print
//   recipe" -- keeps none of that, and is refused. A one-word name has nothing
//   left to keep, so it never qualifies.
// - **Its authored identity, where both have one.** A test id that differs from
//   the recorded one says it is another control, whatever its words.
//
// And it has to single the control out. Where the recorded name is still on a
// control in the recorded place, that control is the candidate, not a renamed
// one. Where two controls of the kind in the place keep the recorded action --
// "Save to collection" and "Save to planner" -- the rename does not say which,
// and both are refused. What remains is a page whose recorded control is gone
// and whose one same-kind control in its place keeps its action words: a
// different-purpose control that happens to share the action words and is
// alone there would pass (open question in the t446 report). Whether the act
// may then be taken is not this check's question: a lasting act still goes to
// Core's permission gate and the domain's act-landing record after this.

import type { WebAutomationElementFingerprint } from "../../../actions/types";
import { type WebLlmEvidenceElement } from "../elements";
import { webPacketElementFingerprint } from "../packet-fingerprint";
import { elementFillsRepairableParameter, type WebRepairableParameterRole } from "../repairable-parameters";
import { evidenceNames, NAME_CONJUNCTIONS, nameWords, namesAgree } from "./control-names";
import { webControlPlace, type WebRecordedPlace } from "./control-place";

/** The renamed control as the recording knew it: its identity and where it sat. */
export type WebRenameRecorded = WebRecordedPlace & { fingerprint: WebAutomationElementFingerprint; names: readonly string[] };

/**
 * `same` where the proposal is the recorded control renamed, `different` where
 * its authored identity says it is another control, `unrelated` where nothing
 * here ties it to the recording.
 */
export function webRenamedControlVerdict(input: {
  elements: readonly WebLlmEvidenceElement[];
  named: WebLlmEvidenceElement;
  role: WebRepairableParameterRole;
  recorded: WebRenameRecorded;
}): "same" | "different" | "unrelated" {
  const { elements, named, role, recorded } = input;
  if (!webControlPlace(recorded, named).kept || !sameKindAsRecorded(recorded.fingerprint, named)) return "unrelated";
  if (!keepsRecordedAction(evidenceNames(named), recorded.names)) return "unrelated";
  const recordedTestId = text(recorded.fingerprint.testId);
  const namedTestId = text(webPacketElementFingerprint(named).testId);
  if (recordedTestId !== undefined && namedTestId !== undefined && recordedTestId !== namedTestId) return "different";
  const inPlace = elements.filter((element) => element !== named && elementFillsRepairableParameter(element, role) && webControlPlace(recorded, element).kept);
  if (inPlace.some((element) => namesAgree(evidenceNames(element), recorded.names))) return "unrelated";
  const rivals = inPlace.filter((element) => sameKind(element, named) && keepsRecordedAction(evidenceNames(element), recorded.names));
  return rivals.length === 0 ? "same" : "unrelated";
}

/**
 * Whether one of the proposed names is a recorded name with only its last word
 * replaced: the same number of words, every earlier one kept in order, the last
 * another word and not a conjunction.
 */
function keepsRecordedAction(named: readonly string[], recorded: readonly string[]): boolean {
  return named.some((candidate) => {
    const proposed = nameWords(candidate);
    return recorded.some((value) => {
      const known = nameWords(value);
      const last = known.length - 1;
      return known.length >= 2
        && proposed.length === known.length
        && proposed[last] !== known[last]
        && !NAME_CONJUNCTIONS.has(proposed[last]!)
        && known.slice(0, last).every((word, index) => word === proposed[index]);
    });
  });
}

/** The same tag, authored role and input type as the recording stated them; an unstated tag is not the same. */
function sameKindAsRecorded(recorded: WebAutomationElementFingerprint, named: WebLlmEvidenceElement): boolean {
  const tag = lower(recorded.tagName);
  return tag !== undefined
    && tag === lower(named.tag)
    && lower(recorded.role) === lower(named.role)
    && lower(recorded.inputType) === lower(named.inputType);
}

function sameKind(element: WebLlmEvidenceElement, other: WebLlmEvidenceElement): boolean {
  return lower(element.tag) === lower(other.tag) && lower(element.role) === lower(other.role) && lower(element.inputType) === lower(other.inputType);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function lower(value: unknown): string | undefined {
  return text(value)?.toLowerCase();
}

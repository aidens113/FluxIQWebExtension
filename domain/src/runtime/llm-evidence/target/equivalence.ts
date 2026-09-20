// Whether the control a model named is the one the failed action acted on.
//
// The handle check next door proves the model was shown a control and that the
// failed verb could use it. That is not the same question. In the live repair
// campaign of 2026-09-17 every refusal task ended in a proposed target
// override, and each proposal passed that check: "Save changes and exit" in the
// slot a recorded "Save changes" had left, one of two identical "Continue"
// buttons, whichever button remained on a page whose item had been deleted, the
// customer search when the revenue editor was gone, and each page's own way
// back after a guard or a retirement. Pressing any of them does something the
// person never recorded.
//
// What can be checked deterministically is narrow, and this module keeps to it.
// Core hands the domain what the failed node addressed -- the recorded element,
// or the repair that superseded it -- and the packet says what is on the page
// now. Four things then disqualify a proposal:
//
// - **A twin.** The resolution Core carries is a fingerprint: a tag, a role, a
//   name, a form, a control type. Where another control the same verb could use
//   answers to all of those, the repair does not single one out, and a page
//   that renumbers its DOM would be free to pick the other. A place in a list
//   is deliberately not a distinguishing signal: row 2 is a position, not an
//   identity, and "the other Continue" is exactly what a guess looks like.
// - **A different kind of control.** A reset is not a submit, a link is not a
//   button, a search field is not the revenue field. Where the recording did
//   not keep a button's type -- a created node carries no attributes -- the
//   type is unknown rather than wrong, and is not held against the proposal.
// - **A name that joins another action to the recorded one.** "Save changes and
//   exit" is "Save changes" and then something else, and the something else is
//   what the person did not ask for. Counting conjunctions rather than matching
//   a phrase list keeps "Save and close" repairable by another "Save and close".
// - **Nothing that ties it to the recording.** A rename is only recognisable
//   through something that survived it: the name itself, whole or shortened, or
//   the recorded form with exactly one control of that kind left in it. Where
//   neither survives -- a different button on a page with no form -- the
//   proposal is a guess, and this refuses it rather than let the person find
//   out by watching it run.
//
// Each refusal is one of Core's closed words, so a refused live repair says
// which of the four it was. English conjunctions are the one piece of language
// knowledge here; a page in another language loses that rule and keeps the
// other three.

import type { JsonObject } from "fluxiq/core";
import type { WebAutomationElementFingerprint } from "../../../actions/types";
import { adaptedTargetSupersedesRecording, elementFingerprint, objectValue } from "../../../output-nodes/targets";
import { type WebLlmEvidenceElement } from "../elements";
import { WEB_LLM_EVIDENCE_BOUNDS } from "../limits";
import { elementFillsRepairableParameter, type WebRepairableParameterRole } from "../repairable-parameters";
import type { AutomationStudioRuntimeTargetOverrideFailedAction } from "fluxiq/automation-studio";

/** What the failed node addressed, as Core carries it: the recorded element, the target, or both. */
export type WebRecordedActionTarget = AutomationStudioRuntimeTargetOverrideFailedAction["recordedTarget"];

/** The refusals this check gives, each one of Core's own words. */
export type WebRepairEquivalenceRefusal = "target_indistinguishable" | "target_not_equivalent" | "target_unanchored" | "recorded_target_unknown";

/**
 * Why the element a handle named is not the failed action's own control, or
 * `undefined` when nothing says it is not.
 */
export function webRepairEquivalenceRefusal(input: {
  elements: readonly WebLlmEvidenceElement[];
  named: WebLlmEvidenceElement;
  role: WebRepairableParameterRole;
  recordedTarget: WebRecordedActionTarget;
}): WebRepairEquivalenceRefusal | undefined {
  const recorded = recordedControl(input.recordedTarget);
  if (!recorded) return "recorded_target_unknown";
  const namedKind = evidenceControlKind(input.named);
  const usable = input.elements.filter((element) => element !== input.named && elementFillsRepairableParameter(element, input.role));
  if (usable.some((rival) => indistinguishable(rival, input.named))) return "target_indistinguishable";
  if (conflictingKinds(recordedControlKind(recorded), namedKind)) return "target_not_equivalent";
  const namedLabels = evidenceNames(input.named);
  const recordedLabels = recordedNames(recorded.fingerprint);
  if (joinsMoreActions(namedLabels.all, recordedLabels)) return "target_not_equivalent";
  if (namesAgree(namedLabels.whole, recordedLabels)) return undefined;
  if (soleControlOfItsKindInRecordedForm(input.elements, input.named, namedKind, recorded.formId)) return undefined;
  return "target_unanchored";
}

/** What a control is, in the distinctions a repair must not cross. A variant nobody stated is unknown, not wrong. */
type WebControlKind = { family: string; variant?: string };

/** The recorded control: its identity, and the two signals a fingerprint does not carry as fields of its own. */
type WebRecordedControl = {
  fingerprint: WebAutomationElementFingerprint;
  formId?: string | undefined;
  controlType?: string | undefined;
  /** Whether anything said what type of control it is, so an absent type reads as unknown rather than as a default. */
  controlTypeKnown: boolean;
};

/**
 * The identity the failed node would dispatch: its repair where one superseded
 * the recording, the recording otherwise, which is the same precedence
 * `output-nodes/targets` applies when the action is dispatched. A source that
 * only says where the control was -- a selector, an xpath -- identifies
 * nothing, so it is passed over.
 */
function recordedControl(recordedTarget: WebRecordedActionTarget): WebRecordedControl | undefined {
  if (!recordedTarget) return undefined;
  // The two keys Core carries, written only where it carried them: the
  // precedence below is the one the dispatch itself applies, and it reads them
  // from the node's parameters.
  const parameters: JsonObject = {};
  if (recordedTarget.element) parameters.element = recordedTarget.element;
  if (recordedTarget.target) parameters.target = recordedTarget.target;
  const target = objectValue(recordedTarget.target);
  const adapted = [target?.element, target?.fingerprint, recordedTarget.target];
  const sources = adaptedTargetSupersedesRecording(parameters) ? [...adapted, recordedTarget.element] : [recordedTarget.element, ...adapted];
  for (const source of sources) {
    const fingerprint = elementFingerprint(source);
    if (!fingerprint || !identifiesAControl(fingerprint)) continue;
    const metadata = objectValue(objectValue(source)?.metadata);
    const controlType = text(fingerprint.attributes?.type) ?? text(metadata?.controlType);
    return {
      fingerprint,
      formId: text(fingerprint.context?.formId) ?? text(fingerprint.context?.formName) ?? text(metadata?.formId),
      controlType,
      controlTypeKnown: controlType !== undefined || fingerprint.attributes !== undefined
    };
  }
  return undefined;
}

/** A description says which control it is only where it says what the control is or what it is called. */
function identifiesAControl(fingerprint: WebAutomationElementFingerprint): boolean {
  return text(fingerprint.tagName) !== undefined || text(fingerprint.role) !== undefined || recordedNames(fingerprint).length > 0;
}

/**
 * Whether two described controls answer to the same fingerprint. Only the
 * signals a resolved repair carries are compared, because they are the whole of
 * what the page is later asked to find. Where the element sits -- its list
 * position, its landmark, the heading above it -- is not among them.
 */
function indistinguishable(rival: WebLlmEvidenceElement, named: WebLlmEvidenceElement): boolean {
  return rival.tag === named.tag
    && rival.role === named.role
    && rival.name === named.name
    && rival.text === named.text
    && rival.inputType === named.inputType
    && rival.controlType === named.controlType
    && rival.form === named.form
    && rival.frameId === named.frameId;
}

/** Two kinds disagree only where both were stated. */
function conflictingKinds(recorded: WebControlKind | undefined, named: WebControlKind | undefined): boolean {
  if (!recorded || !named) return false;
  if (recorded.family !== named.family) return true;
  return recorded.variant !== undefined && named.variant !== undefined && recorded.variant !== named.variant;
}

/** Widget roles a page may author, in the same distinctions the tags below make. */
const ROLE_KINDS: Readonly<Record<string, WebControlKind>> = Object.freeze({
  button: { family: "button" },
  link: { family: "link" },
  checkbox: { family: "checkbox" },
  menuitemcheckbox: { family: "checkbox" },
  switch: { family: "checkbox" },
  radio: { family: "radio" },
  menuitemradio: { family: "radio" },
  combobox: { family: "select" },
  listbox: { family: "select" },
  textbox: { family: "text" },
  searchbox: { family: "text", variant: "search" },
  tab: { family: "tab" },
  menuitem: { family: "menuitem" },
  option: { family: "option" }
});

/** Input types that press something rather than hold a value. */
const PRESSING_INPUT_TYPES: ReadonlySet<string> = new Set(["submit", "button", "image"]);

function recordedControlKind(recorded: WebRecordedControl): WebControlKind | undefined {
  const authored = ROLE_KINDS[lower(recorded.fingerprint.role) ?? ""];
  if (authored) return authored;
  const tagged = tagControlKind({
    tag: lower(recorded.fingerprint.tagName),
    inputType: lower(recorded.fingerprint.inputType) ?? lower(recorded.controlType),
    controlType: lower(recorded.controlType),
    controlTypeKnown: recorded.controlTypeKnown
  });
  return tagged ?? ROLE_KINDS[lower(recorded.fingerprint.implicitRole) ?? ""];
}

function evidenceControlKind(element: WebLlmEvidenceElement): WebControlKind | undefined {
  const authored = ROLE_KINDS[lower(element.role) ?? ""];
  if (authored) return authored;
  // A packet is described from a full capture, so a button with no control
  // type carries none: the type attribute was not there, and a button without
  // one submits.
  return tagControlKind({
    tag: lower(element.tag),
    inputType: lower(element.inputType) ?? lower(element.controlType),
    controlType: lower(element.controlType),
    controlTypeKnown: true
  });
}

function tagControlKind(input: { tag?: string | undefined; inputType?: string | undefined; controlType?: string | undefined; controlTypeKnown: boolean }): WebControlKind | undefined {
  if (input.tag === "a") return { family: "link" };
  if (input.tag === "select") return { family: "select" };
  if (input.tag === "textarea") return { family: "text", variant: "text" };
  if (input.tag === "button") return buttonKind(input.controlType, input.controlTypeKnown);
  if (input.tag !== "input") return undefined;
  const type = input.inputType ?? (input.controlTypeKnown ? "text" : undefined);
  if (type === undefined) return { family: "text" };
  if (type === "reset" || PRESSING_INPUT_TYPES.has(type)) return buttonKind(type, true);
  if (type === "checkbox" || type === "radio") return { family: type };
  return { family: "text", variant: type };
}

/** A reset discards; everything else a button does, it does on purpose. An unstated type is unknown. */
function buttonKind(controlType: string | undefined, controlTypeKnown: boolean): WebControlKind {
  if (controlType === "reset") return { family: "button", variant: "reset" };
  return controlTypeKnown ? { family: "button", variant: "activate" } : { family: "button" };
}

/** Every name the recording knew the control by. The authored `name` attribute is a form key, not a label. */
function recordedNames(fingerprint: WebAutomationElementFingerprint): string[] {
  const attributes = fingerprint.attributes;
  return [fingerprint.accessibleName, fingerprint.visibleText, fingerprint.text, fingerprint.label, attributes?.["aria-label"], attributes?.title]
    .flatMap((value) => text(value) === undefined ? [] : [value as string]);
}

/**
 * The names the packet gives an element. A string the packet cut at its bound
 * is not the element's whole name, so it is compared for the conjunctions it
 * does contain and never for agreement.
 */
function evidenceNames(element: WebLlmEvidenceElement): { all: string[]; whole: string[] } {
  const all = [element.name, element.text].flatMap((value) => text(value) === undefined ? [] : [value as string]);
  return { all, whole: all.filter((value) => value.length < WEB_LLM_EVIDENCE_BOUNDS.text) };
}

/** Words that join a second action to the first. */
const CONJUNCTIONS: ReadonlySet<string> = new Set(["and", "then", "plus", "&", "+"]);

/** Whether the proposed control's name joins more actions than the recorded one's did. */
function joinsMoreActions(named: readonly string[], recorded: readonly string[]): boolean {
  return conjunctionCount(named) > conjunctionCount(recorded);
}

function conjunctionCount(names: readonly string[]): number {
  return names.reduce((most, name) => Math.max(most, words(name).filter((word) => CONJUNCTIONS.has(word)).length), 0);
}

/**
 * Whether a name survived the change: the same name, or the recorded name
 * shortened from the front, which is how a label is cut down ("Save changes"
 * to "Save"). A name that keeps only a later word ("Changes") is not the
 * recorded control answering to less of its name.
 */
function namesAgree(named: readonly string[], recorded: readonly string[]): boolean {
  return named.some((candidate) => {
    const proposed = words(candidate);
    return proposed.length > 0 && recorded.some((value) => {
      const known = words(value);
      return known.length > 0 && proposed.every((word, index) => word === known[index]);
    });
  });
}

/**
 * Whether the recorded form is left with exactly one control of the proposed
 * one's kind, and the proposal is it. The form is a semantic container -- its
 * controls act on one record -- so the one submit left in the form the
 * recording submitted is the renamed submit. A landmark or a heading is not:
 * they hold every control on the page.
 */
function soleControlOfItsKindInRecordedForm(
  elements: readonly WebLlmEvidenceElement[],
  named: WebLlmEvidenceElement,
  namedKind: WebControlKind | undefined,
  recordedForm: string | undefined
): boolean {
  if (!recordedForm || !namedKind || named.form !== recordedForm) return false;
  const sameKind = elements.filter((element) => element.form === recordedForm && sameControlKind(evidenceControlKind(element), namedKind));
  return sameKind.length === 1;
}

function sameControlKind(kind: WebControlKind | undefined, other: WebControlKind): boolean {
  return kind !== undefined && kind.family === other.family && kind.variant === other.variant;
}

/** A name as it is compared: case, spacing and punctuation are not identity; a conjunction sign is a word. */
function words(value: string): string[] {
  return value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+|[&+]/gu) ?? [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function lower(value: unknown): string | undefined {
  const found = text(value);
  return found === undefined ? undefined : found.toLowerCase();
}

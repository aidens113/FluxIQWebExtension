// Whether a step's node fits the control its handle names, and which node does
// when it does not: the resolver's `web.handle.wrong_control`, beside
// `web.handle.expected.node.*` (`resolve-plan-node.ts`).
//
// A select step handed anything but a `<select>`, and a text-entry step handed
// a control that is never editable, are refused here rather than on the page,
// where they arrived as `output_not_observed` long after the evidence that
// would have corrected them (`run-mu6cedna-3dd46e49`). The node that does fit
// is said where the control's kind says which (`fits`), and the resolver says
// it beside `web.handle.not_a_field` too (t486), since a checkbox typed into is
// one pressed.
//
// A choice step handed a scripted list or combobox -- an element the page gave
// the role `listbox` or `combobox` that is not a native `<select>` -- is also
// told what it is (`kind`, `web.handle.target_kind.<kind>`). The page view
// printed a scripted listbox as `select` until t509, and the model chose in it
// the way it would in one. Live, that refusal said only `wrong_control`, the same
// call was repeated, and the repeat guard ended the build
// (`run-mv6qrcdu-a31b44b8`, step 0060). Nothing chooses in a scripted list but
// pressing its option, which has its own handle, so a listbox names no node to
// repeat on the same handle; a scripted combobox is pressed open first.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../output-nodes";
import type { WebPlanHandleIssueCode } from "./resolve-plan-node";

/** The kinds of scripted choice control a choice step is refused on by name: `web.handle.target_kind.<kind>` (`listbox` is also a page-view kind, `./typing-targets.ts`). */
type WebPlanScriptedChoiceKind = "listbox" | "combobox";

/**
 * The node that fits the control (`fits`, where its kind says), whether this
 * node is one its output refuses outright (`wrong`), and, for a choice step on
 * a scripted list or combobox, which of those it is (`kind`).
 */
export function webPlanControlMisfit(nodeDefinitionId: string, identity: JsonObject | undefined): {
  wrong: boolean;
  fits: WebPlanHandleIssueCode | undefined;
  kind: `web.handle.target_kind.${WebPlanScriptedChoiceKind}` | undefined;
} {
  const wrong = actsOnTheWrongControl(nodeDefinitionId, identity);
  const scripted = wrong && nodeDefinitionId === SELECT_NODE_ID ? scriptedChoiceKind(identity) : undefined;
  return {
    wrong,
    // A scripted list is chosen from by pressing its option, a different handle, so it names no node for this one.
    fits: scripted === "listbox" ? undefined : scripted === "combobox" ? "web.handle.expected.node.web.output.dom-click" : fittingNodeCode(identity),
    kind: scripted === undefined ? undefined : `web.handle.target_kind.${scripted}`
  };
}

/** Choosing an option is `HTMLSelectElement` behaviour, and the output refuses anything else outright. */
const SELECT_NODE_ID = webAutomationOutputNodeId("web.dom.select");
/** Entering and clearing text need an editable control. */
const TEXT_ENTRY_NODE_IDS: ReadonlySet<string> = new Set([webAutomationOutputNodeId("web.dom.type"), webAutomationOutputNodeId("web.dom.clear")]);
/** Tags that are positively not editable. Anything unrecognised is left alone: this refuses what is known wrong, never what is merely unfamiliar. */
const NEVER_EDITABLE_TAGS: ReadonlySet<string> = new Set(["select", "button", "a", "option", "img"]);

/**
 * Whether the element the handle names is one this step's output would refuse.
 *
 * The evidence packet names each element's tag, so a step that chooses an
 * option and names a button is a mistake the model made with the answer in
 * front of it -- and one that used to reach a built Flow and fail on the page,
 * long after the packet that would have corrected it was gone. Only a
 * contradiction the registered output itself enforces counts, so this can
 * refuse nothing the run would have accepted.
 */
function actsOnTheWrongControl(nodeDefinitionId: string, identity: JsonObject | undefined): boolean {
  const tagName = typeof identity?.tagName === "string" ? identity.tagName.toLowerCase() : undefined;
  if (tagName === undefined) return false;
  if (nodeDefinitionId === SELECT_NODE_ID) return tagName !== "select";
  return TEXT_ENTRY_NODE_IDS.has(nodeDefinitionId) && NEVER_EDITABLE_TAGS.has(tagName);
}

/** Controls a press acts on by what they are. */
const PRESSABLE_TAGS: ReadonlySet<string> = new Set(["button", "a", "summary"]);
/** Roles a page gives a control that is pressed, whatever element carries them. */
const PRESSABLE_ROLES: ReadonlySet<string> = new Set(["button", "option", "menuitem", "tab", "radio", "checkbox", "link"]);
/** Input types that are pressed rather than typed into. */
const PRESSABLE_INPUT_TYPES: ReadonlySet<string> = new Set(["button", "submit", "reset", "image", "checkbox", "radio"]);

/**
 * The node that acts on the element a refused handle names, as the code a
 * refusal carries it in, or nothing when the identity does not say.
 *
 * Read only from the identity the handle already resolved to -- its tag, its
 * role and its input type, each a closed word for a kind of control rather
 * than anything the page wrote in it -- so what goes back is a node id and
 * never page text. A native `<option>` is chosen through its `<select>`, whose
 * handle is a different one, so it names nothing rather than a press; an
 * element nothing here recognises names nothing either, because naming a node
 * the model would then be refused by again is worse than naming none.
 */
function fittingNodeCode(identity: JsonObject | undefined): WebPlanHandleIssueCode | undefined {
  const tagName = lowerCase(identity?.tagName);
  if (tagName === undefined || tagName === "option") return undefined;
  if (tagName === "select") return "web.handle.expected.node.web.output.dom-select";
  const role = lowerCase(identity?.role);
  const inputType = lowerCase(identity?.inputType);
  const pressable = PRESSABLE_TAGS.has(tagName)
    || (role !== undefined && PRESSABLE_ROLES.has(role))
    || (tagName === "input" && inputType !== undefined && PRESSABLE_INPUT_TYPES.has(inputType));
  return pressable ? "web.handle.expected.node.web.output.dom-click" : undefined;
}

/**
 * What to do about a choice step on a scripted list or combobox, read off the
 * kind code beside its refusal (`web.handle.target_kind.<kind>`), or nothing
 * for any other control: the refusal's `next` (`../tool-rejection.ts`).
 *
 * Words of this domain only, never the page's: what the element is and the
 * press that does choose, which takes one step where the options are showing.
 * A repeat of the refusal passes the same codes back and is told the same.
 */
export function webPlanScriptedChoiceMove(issueCodes: readonly string[] | undefined): string | undefined {
  for (const code of issueCodes ?? []) {
    const move = SCRIPTED_CHOICE_MOVES.get(code);
    if (move !== undefined) return move;
  }
  return undefined;
}

const SCRIPTED_CHOICE_MOVES: ReadonlyMap<string, string> = new Map<`web.handle.target_kind.${WebPlanScriptedChoiceKind}`, string>([
  ["web.handle.target_kind.listbox", "Nothing was done. The handle in target names a custom listbox, not a native select, so web.output.dom-select cannot choose in it. "
    + "Choose by pressing the option you want: call web.output.dom-click with that option's own handle, which the page view prints under the listbox. "
    + "If its options are not showing, press the control that opens the list first."],
  ["web.handle.target_kind.combobox", "Nothing was done. The handle in target names a custom combobox, not a native select, so web.output.dom-select cannot choose in it. "
    + "Press it to open its list (useNode, with this same handle), then press the option you want by its own handle."]
]);

/** Tags a person types into: a combobox on one of these is a text box with suggestions, not a scripted list. */
const TYPED_TAGS: ReadonlySet<string> = new Set(["input", "textarea"]);

/**
 * Whether the element is a scripted choice control, read from its role and tag
 * alone: a `listbox` role on anything but a `<select>`, or a `combobox` role on
 * anything but a `<select>` or a box typed into. A native select keeps its own
 * kind whatever role it carries, and a typed combobox is left to the rules
 * above, since typing into it is how it is used.
 */
function scriptedChoiceKind(identity: JsonObject | undefined): WebPlanScriptedChoiceKind | undefined {
  const tagName = lowerCase(identity?.tagName);
  if (tagName === undefined || tagName === "select") return undefined;
  const role = firstRole(identity?.role) ?? firstRole(identity?.implicitRole);
  if (role === "listbox") return "listbox";
  if (role === "combobox" && !TYPED_TAGS.has(tagName)) return "combobox";
  return undefined;
}

/** The first token of a role attribute, which is the one a browser honours. */
function firstRole(value: JsonValue | undefined): string | undefined {
  return lowerCase(value)?.trim().split(/\s+/u)[0] || undefined;
}

function lowerCase(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value.toLowerCase() : undefined;
}

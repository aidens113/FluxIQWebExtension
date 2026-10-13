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

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../output-nodes";
import type { WebPlanHandleIssueCode } from "./resolve-plan-node";

/** The node that fits the control (`fits`, where its kind says), and whether this node is one its output refuses outright (`wrong`). */
export function webPlanControlMisfit(nodeDefinitionId: string, identity: JsonObject | undefined): { wrong: boolean; fits: WebPlanHandleIssueCode | undefined } {
  return { wrong: actsOnTheWrongControl(nodeDefinitionId, identity), fits: fittingNodeCode(identity) };
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

function lowerCase(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value.toLowerCase() : undefined;
}

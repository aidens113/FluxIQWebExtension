// Which parameters of a web action a repair may re-point, named in the web
// domain's own vocabulary.
//
// Core's repair target is a map from a repairable parameter to an opaque
// handle, and Core never learns what either side means. This module is the web
// half of that map. A click has exactly one thing to re-point, so it declares
// `element`. A list extraction has more than one -- the row the list repeats
// over, and each field read out of a row -- so it declares `item` and
// `field.<key>`. That is why the door is already open: an `extract_list`
// repair needs no new contract, only the field keys the failed node declared.
//
// What a parameter accepts is a role rather than a tag list, so the check
// reads as the question it is really asking -- could this control carry out
// the verb that failed? -- and so a second action with the same shape does not
// copy a tag list. The roles are exactly the distinctions the DOM outputs
// make: typing needs a fillable control, a dropdown needs a real `select`, a
// click needs something clickable, and a read needs nothing at all beyond
// being described.

import { actionableEvidenceElement, safeFillTag, type WebLlmEvidenceElement } from "./elements";

/** The verb a repairable parameter has to be able to carry out. */
export type WebRepairableParameterRole = "fillable" | "selectable" | "clickable" | "keyable" | "observable" | "list_item";

export type WebRepairableParameter = {
  /** The key Core carries in `target.handles`. Bounded to Core's handle vocabulary: letters, digits, `_`, `.`, `:`, `-`. */
  name: string;
  role: WebRepairableParameterRole;
  /** A repair that leaves a required parameter unnamed is refused rather than guessed at wholesale. */
  required: boolean;
};

/** The single control every one-target DOM output re-points. */
export const WEB_REPAIRABLE_ELEMENT_PARAMETER = "element";

/** The row a list extraction repeats over. */
export const WEB_REPAIRABLE_ITEM_PARAMETER = "item";

/** Prefix of a per-field extraction parameter: `field.price`, `field.title`. */
export const WEB_REPAIRABLE_FIELD_PARAMETER_PREFIX = "field.";

const ELEMENT_ROLE_BY_DEFINITION_ID: Record<string, WebRepairableParameterRole> = {
  "web.output.dom-type": "fillable",
  "web.output.dom-clear": "fillable",
  "web.output.dom-select": "selectable",
  "web.output.dom-click": "clickable",
  "web.output.dom-keypress": "keyable",
  "web.output.dom-wait_for_selector": "observable",
  "web.output.dom-extract": "observable"
};

const LIST_EXTRACTION_DEFINITION_ID = "web.output.dom-extract_list";

/**
 * Every parameter of this action that a repair may re-point, or an empty list
 * when the action has none. An empty list is a refusal, not an oversight: an
 * action the domain has not declared repairable does not get its targets
 * rewritten by a model.
 *
 * For a list extraction only `item` is listed, because the field keys live in
 * the failed node's own parameters and Core's failed-action identity carries
 * just a node id and a definition id. `webRepairableParameterFor` still
 * accepts any `field.<key>` the model names, and the resolution is checked the
 * same way, so a field repair works today and becomes exact once the field
 * keys are passed through.
 */
export function webRepairableParameters(definitionId: string): WebRepairableParameter[] {
  const elementRole = ELEMENT_ROLE_BY_DEFINITION_ID[definitionId];
  if (elementRole) return [{ name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role: elementRole, required: true }];
  if (definitionId === LIST_EXTRACTION_DEFINITION_ID) return [{ name: WEB_REPAIRABLE_ITEM_PARAMETER, role: "list_item", required: true }];
  return [];
}

/**
 * The parameter this name refers to, or `undefined` when the action never
 * offered it. A name the domain did not declare is how an invented parameter
 * is caught, so this is deliberately a lookup and never a default.
 */
export function webRepairableParameterFor(definitionId: string, name: string): WebRepairableParameter | undefined {
  const declared = webRepairableParameters(definitionId).find((parameter) => parameter.name === name);
  if (declared) return declared;
  if (definitionId !== LIST_EXTRACTION_DEFINITION_ID || !isFieldParameterName(name)) return undefined;
  return { name, role: "observable", required: false };
}

/** Whether this element could carry out the verb the parameter stands for. */
export function elementFillsRepairableParameter(element: WebLlmEvidenceElement, role: WebRepairableParameterRole): boolean {
  if (role === "fillable") return safeFillTag(element.tag, element.inputType);
  if (role === "selectable") return element.tag === "select";
  if (role === "clickable") return actionableEvidenceElement(element);
  if (role === "keyable") return safeFillTag(element.tag, element.inputType) || element.tag === "select" || actionableEvidenceElement(element);
  // A list row is the element the capture already reported a list position
  // for, which is the one page fact that says "this repeats".
  if (role === "list_item") return element.item !== undefined;
  return true;
}

/**
 * A field parameter name, bounded to what Core will carry as a handle key:
 * `field.` followed by letters, digits, `_`, `.`, `:` or `-`, ending on a
 * letter or digit. A key the page or a model made up that needs anything wider
 * is simply not a field parameter.
 */
function isFieldParameterName(name: string): boolean {
  if (!name.startsWith(WEB_REPAIRABLE_FIELD_PARAMETER_PREFIX)) return false;
  const key = name.slice(WEB_REPAIRABLE_FIELD_PARAMETER_PREFIX.length);
  return key.length > 0 && key.length <= 40 && /^[A-Za-z0-9](?:[A-Za-z0-9_.:-]*[A-Za-z0-9])?$/u.test(key);
}

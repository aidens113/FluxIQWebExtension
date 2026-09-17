// Which parameters of a web action a repair may re-point, named in the web
// domain's own vocabulary -- and which web action a failed node is, since that
// is what the answer depends on.
//
// Core's repair target is a map from a repairable parameter to an opaque
// handle, and Core never learns what either side means. This module is the web
// half of that map. Every action it declares has exactly one thing to re-point,
// the control it acts on, so each declares `element`, and Core writes the
// resolved fingerprint where that action reads its control: the node's
// `target`. The failure packet names the same parameters to the model, because
// Core tells the model to fill one handle per parameter the evidence offers,
// and a packet that offered none left it to guess the key.
//
// A list extraction is deliberately not declared. Its row and its fields were
// once offered here as `item` and `field.<key>`, and a repair of them was saved
// into `target` -- which the extract node never reads, because it reads its
// `extractList` request. The repair was "applied" and the run went exactly as
// before. An extraction is repaired, when it is, by re-issuing that request as
// a parameter override, never through this map; until then it is refused as
// an action with nothing to re-point, which is what the model and the run
// record are told.
//
// Which action failed is read from the output it dispatches wherever Core
// names one. A recorded action is Core's generic `builtin.policy.action` node
// whether it clicks, types or scrapes, so its definition id says nothing about
// the verb; read from that alone, every recorded Flow's repair was refused.
//
// What a parameter accepts is a role rather than a tag list, so the check
// reads as the question it is really asking -- could this control carry out
// the verb that failed? -- and so a second action with the same shape does not
// copy a tag list. The roles are exactly the distinctions the DOM outputs
// make: typing needs a fillable control, a dropdown needs a real `select`, a
// click needs something clickable, and a read needs nothing at all beyond
// being described.

import { WEB_AUTOMATION_ACTION_TYPES } from "../../actions/types";
import { webAutomationOutputNodeId } from "../../output-nodes";
import { actionableEvidenceElement, safeFillTag, type WebLlmEvidenceElement } from "./elements";

/** The verb a repairable parameter has to be able to carry out. */
export type WebRepairableParameterRole = "fillable" | "selectable" | "clickable" | "keyable" | "observable";

export type WebRepairableParameter = {
  /** The key Core carries in `target.handles`. Bounded to Core's handle vocabulary: letters, digits, `_`, `.`, `:`, `-`. */
  name: string;
  role: WebRepairableParameterRole;
  /** A repair that leaves a required parameter unnamed is refused rather than guessed at wholesale. */
  required: boolean;
  /** What the handle under this key must be, in words a model reads on the failure packet. */
  description: string;
};

/** A failed action as Core identifies it: the node's definition, and the output it dispatches where Core names one. */
export type WebFailedActionIdentity = Readonly<{ definitionId: string; outputId?: string }>;

/** The single control every one-target DOM output re-points. */
export const WEB_REPAIRABLE_ELEMENT_PARAMETER = "element";

/** Worded for a model that has only the packet: the value is a handle it was shown, and it names one element. */
const ELEMENT_PARAMETER_DESCRIPTION = "the target handle of the one element the failed action should act on instead";

/** Core's node definition for a recorded action. Core exports no constant for it. */
const POLICY_ACTION_DEFINITION_ID = "builtin.policy.action";

const ELEMENT_ROLE_BY_DEFINITION_ID: Record<string, WebRepairableParameterRole> = {
  "web.output.dom-type": "fillable",
  "web.output.dom-clear": "fillable",
  "web.output.dom-select": "selectable",
  "web.output.dom-click": "clickable",
  "web.output.dom-keypress": "keyable",
  "web.output.dom-wait_for_selector": "observable",
  "web.output.dom-extract": "observable"
};

/**
 * The web output node each registered output runs as, keyed by output id.
 * Derived from the action vocabulary, so a new action is covered the day it
 * is registered and a node id never has to be spelled twice.
 */
const OUTPUT_NODE_ID_BY_OUTPUT_ID: ReadonlyMap<string, string> = new Map(
  WEB_AUTOMATION_ACTION_TYPES.map((outputId) => [outputId, webAutomationOutputNodeId(outputId)])
);

/**
 * Every parameter of this action that a repair may re-point, or an empty list
 * when the action has none. An empty list is a refusal, not an oversight: an
 * action the domain has not declared repairable -- a list extraction among
 * them -- does not get its targets rewritten by a model.
 */
export function webRepairableParameters(definitionId: string): WebRepairableParameter[] {
  const elementRole = Object.hasOwn(ELEMENT_ROLE_BY_DEFINITION_ID, definitionId) ? ELEMENT_ROLE_BY_DEFINITION_ID[definitionId] : undefined;
  return elementRole ? [elementParameter(elementRole)] : [];
}

/**
 * The parameter this name refers to, or `undefined` when the action never
 * offered it. A name the domain did not declare is how an invented parameter
 * is caught, so this is deliberately a lookup and never a default.
 */
export function webRepairableParameterFor(definitionId: string, name: string): WebRepairableParameter | undefined {
  return webRepairableParameters(definitionId).find((parameter) => parameter.name === name);
}

/**
 * The node definition whose verb failed, in the terms the parameters above are
 * declared in, or `undefined` when the failed action names no web verb this
 * domain can trust.
 *
 * Where Core names no output, the definition id is all there is, and it is how
 * a web output node has always been read. Where Core names one, the output
 * decides -- but only for the node that can carry it: a recorded action, or
 * that output's own node. An output id this domain never registered names no
 * web verb. A node of any other kind that claims an output, such as an
 * extraction node claiming a click, is a contradiction rather than a choice,
 * and trusting either half could write a repair where nothing reads it.
 */
export function webFailedActionDefinitionId(failedAction: WebFailedActionIdentity): string | undefined {
  const outputId = failedAction.outputId;
  if (outputId === undefined) return failedAction.definitionId;
  const dispatched = OUTPUT_NODE_ID_BY_OUTPUT_ID.get(outputId);
  if (dispatched === undefined) return undefined;
  if (failedAction.definitionId !== POLICY_ACTION_DEFINITION_ID && failedAction.definitionId !== dispatched) return undefined;
  return dispatched;
}

/**
 * What a failure packet tells the model a target override fills: each
 * parameter's name and what its handle must be. An empty map is a statement,
 * not a gap: the failed action offers nothing to re-point, so no target
 * override is worth proposing.
 *
 * Core's capture request names the failed node but not the output it
 * dispatches, so a recorded action's verb is unknown when its packet is
 * written. It is offered `element`, the one parameter every repairable action
 * has; the check, which Core does tell the output, refuses a recorded action
 * that offers nothing. Without that offer a correct live repair of a recorded
 * click was refused, because the model had to guess the key.
 */
export function webFailureRepairParameters(failedAction: WebFailedActionIdentity): Record<string, string> {
  if (failedAction.definitionId === POLICY_ACTION_DEFINITION_ID && failedAction.outputId === undefined) {
    return { [WEB_REPAIRABLE_ELEMENT_PARAMETER]: ELEMENT_PARAMETER_DESCRIPTION };
  }
  const definitionId = webFailedActionDefinitionId(failedAction);
  const offered = definitionId === undefined ? [] : webRepairableParameters(definitionId);
  return Object.fromEntries(offered.map((parameter) => [parameter.name, parameter.description]));
}

/** Whether this element could carry out the verb the parameter stands for. */
export function elementFillsRepairableParameter(element: WebLlmEvidenceElement, role: WebRepairableParameterRole): boolean {
  if (role === "fillable") return safeFillTag(element.tag, element.inputType);
  if (role === "selectable") return element.tag === "select";
  if (role === "clickable") return actionableEvidenceElement(element);
  if (role === "keyable") return safeFillTag(element.tag, element.inputType) || element.tag === "select" || actionableEvidenceElement(element);
  return true;
}

function elementParameter(role: WebRepairableParameterRole): WebRepairableParameter {
  return { name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role, required: true, description: ELEMENT_PARAMETER_DESCRIPTION };
}

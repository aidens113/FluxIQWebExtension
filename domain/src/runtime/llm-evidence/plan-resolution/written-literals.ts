// What a model wrote about an element other than a handle, refused (t432).
//
// The user's rule (2026-10-10): every saved element carries the full
// multi-signal fingerprint, and "the LLM model shouldnt have to worry about any
// of that, that's all handled by extension". The model names an element by the
// handle the page view printed and by nothing else; the domain turns that
// handle into the address and the identity the step runs with
// (`./resolve-plan-node.ts`). Until now a node the model wrote with a literal
// `selector` -- no handle anywhere -- was answered `unchanged` and ran exactly
// as written, with no identity behind it; a literal written beside a handle was
// silently replaced; and an `element` the model described was kept as its own.
//
// So what the model wrote is refused at its position as
// `web.handle.not_a_handle` when it is:
//
// - `selector`, `target` or `element` holding anything but a handle reference
//   (`{ "handle": ... }`, or a `target` bound to state whose fallback is one) --
//   a reference of the wrong shape is the resolver's to refuse as malformed;
// - `visualTarget`, which only the recorder writes;
// - a `selector` inside an expected-state condition, the locator form a
//   hand-authored Flow may write (a model writes `done when:` facts, which name
//   their element by handle).
//
// And a node the model wrote whole, which cannot run without an element and
// names none at all, is refused as `web.handle.required`, where it used to
// reach validation as a missing `selector` -- a parameter the model is never
// shown.
//
// **Who wrote what (`WebPlanAuthorship`).** Core says a node is the model's
// own writing (`writtenByModel`: a candidate script, a reply's plan, an in-run
// repair's steps), or that only some of its parameters are
// (`modelWrittenParameters`: the settings an amendment wrote over a draft step
// the domain resolved), and exploration says which of a call's parameters are
// the model's (`../node-run/held-literals/`: a rerun of a step the Flow
// already held keeps what the Flow saved). Only what the model wrote is judged,
// and `required` only of a node it wrote whole. A hand-authored Flow, a
// recorded one and a step the build's own draft ran are never asked this, so
// their literal selectors still run.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationActionDefinitions } from "../../../actions/schemas";
import { webAutomationOutputNodeId } from "../../../output-nodes";
import { isJsonRecord } from "../untrusted-json";
import type { WebPlanValuePath } from "./handle-tokens";

/** One element the model named some way other than a handle, or one it did not name, and where. */
export type WebPlanWrittenLiteral = { code: "web.handle.not_a_handle" | "web.handle.required"; path: WebPlanValuePath };

/**
 * Who wrote a node's parameters (header): `model` when the model wrote all of
 * them; otherwise `modelKeys`, the top-level parameters it wrote, the rest the
 * host's; neither when the host wrote the node.
 */
export type WebPlanAuthorship = { model: boolean; modelKeys: readonly string[] | undefined };

/** The parameters an element node names its element in, which a handle may fill. */
const HANDLE_SLOTS = ["selector", "target", "element"] as const;
/** A parameter only the recorder writes: never a handle, never the model's. */
const RECORDED_SLOT = "visualTarget";
/** The expected-state conditions written in the locator form (`output-nodes/definitions.ts`). */
const EXPECTED_STATE = "expectedState";
const CONDITIONS = "conditions";
const CONDITION_LOCATOR = "selector";

/** The web nodes that cannot run without an element: their schema requires a `selector`. */
const ELEMENT_REQUIRED_NODE_IDS: ReadonlySet<string> = new Set(
  webAutomationActionDefinitions
    .filter((definition) => Array.isArray(definition.parameterSchema.required) && definition.parameterSchema.required.includes("selector"))
    .map((definition) => webAutomationOutputNodeId(definition.actionType))
);

/** Whether the model wrote this top-level parameter (`WebPlanAuthorship`). */
export function webPlanModelWrote(authorship: WebPlanAuthorship, key: string): boolean {
  return authorship.model || authorship.modelKeys?.includes(key) === true;
}

/** Whether the model wrote any of the node. */
export function webPlanModelWroteAny(authorship: WebPlanAuthorship): boolean {
  return authorship.model || (authorship.modelKeys?.length ?? 0) > 0;
}

/**
 * Every element a model-written node names other than by handle, and, for a
 * node it wrote whole, the one it should have named and did not (header).
 * `elementNode` is whether the node takes an element at all (its schema has a
 * `selector`), which the resolver already knows.
 */
export function webPlanWrittenLiterals(nodeDefinitionId: string, parameters: JsonObject, elementNode: boolean, authorship: WebPlanAuthorship = { model: true, modelKeys: undefined }): WebPlanWrittenLiteral[] {
  const found: WebPlanWrittenLiteral[] = [];
  const wrote = (key: string): boolean => webPlanModelWrote(authorship, key);
  let named = false;
  if (elementNode) {
    for (const slot of HANDLE_SLOTS) {
      if (!Object.hasOwn(parameters, slot)) continue;
      if (namesHandle(slot, parameters[slot])) named = true;
      else if (wrote(slot)) found.push({ code: "web.handle.not_a_handle", path: [slot] });
    }
    if (Object.hasOwn(parameters, RECORDED_SLOT) && wrote(RECORDED_SLOT)) found.push({ code: "web.handle.not_a_handle", path: [RECORDED_SLOT] });
  }
  const expected = parameters[EXPECTED_STATE];
  const conditions = isJsonRecord(expected) && wrote(EXPECTED_STATE) ? expected[CONDITIONS] : undefined;
  if (Array.isArray(conditions)) {
    conditions.forEach((condition, index) => {
      if (isJsonRecord(condition) && Object.hasOwn(condition, CONDITION_LOCATOR)) {
        found.push({ code: "web.handle.not_a_handle", path: [EXPECTED_STATE, CONDITIONS, index, CONDITION_LOCATOR] });
      }
    });
  }
  if (authorship.model && !named && found.length === 0 && ELEMENT_REQUIRED_NODE_IDS.has(nodeDefinitionId)) found.push({ code: "web.handle.required", path: ["target"] });
  return found;
}

/** A handle reference in this slot: `{ handle }`, or for `target` a state binding whose fallback is one. */
function namesHandle(slot: (typeof HANDLE_SLOTS)[number], value: JsonValue | undefined): boolean {
  if (isReference(value)) return true;
  if (slot !== "target" || !isJsonRecord(value) || !isJsonRecord(value.$state)) return false;
  return isReference(value.$state.fallback as JsonValue | undefined);
}

/** Any object carrying `handle`; its shape is judged by the resolver, which refuses a wrong one as malformed. */
function isReference(value: JsonValue | undefined): boolean {
  return isJsonRecord(value) && Object.hasOwn(value, "handle");
}

// A call's declaration of consequences, read where the model wrote it.
//
// The library verb takes `{node, parameters, consequences}`, and a model
// sometimes writes the declaration one level in, as a key of `parameters`. Live
// run `run-murzln6g-11debe1d` had three of about fifteen presses refused
// `invalid_input` / `missing_input_keys` that way, and each resend that moved
// the key out one level cost a paid decision for nothing it did not already say.
//
// This forgives *where* a declaration is written, never *whether* it is: a call
// that says nothing anywhere is still refused, a declaration beside the
// parameters wins over one inside them, and a node whose own parameter schema
// takes a parameter of that name keeps it as its parameter. Applied once, at
// the start of the node run, so the permission check, the stored call and the
// record all read the same call.

import type { JsonObject } from "fluxiq/core";
import { isJsonRecord } from "../untrusted-json";
import type { WebRunnableNode } from "./catalog";

const KEY = "consequences";

/** The call with a declaration written inside `parameters` moved beside them; otherwise the call as written. */
export function webNodeCallWithDeclarationBeside(value: JsonObject, node: WebRunnableNode): JsonObject {
  if (value[KEY] !== undefined && value[KEY] !== null) return value;
  const parameters = value.parameters;
  if (!isJsonRecord(parameters) || !Object.hasOwn(parameters, KEY)) return value;
  if (node.definition.parameters.some((parameter) => parameter.id === KEY)) return value;
  const { [KEY]: declared, ...rest } = parameters;
  return { ...value, parameters: rest, [KEY]: declared ?? null };
}

// What Core is told of a press that flipped its own control (t775, t787): the
// signature, and, for a control that states its state, the node of this
// library that sets that state itself. One rule for both presses Core learns a
// toggle from: a press the build made while exploring
// (`runtime/llm-evidence/node-run/press-effect/toggle-signature.ts`) and a
// Flow's own press in a trial, which the click verb reports and the output
// dispatcher lifts to Core (`io/gateway-output-dispatcher.ts`).

import type { WebToggleSignature } from "./signature";

/** A press's `toggle`, as Core records it whole and never reads inside. */
export type WebToggleOutput = { signature: WebToggleSignature; idempotentWith?: "web.output.dom-check" };

export function webToggleOutput(signature: WebToggleSignature): WebToggleOutput {
  return signature.via === "attribute" ? { signature, idempotentWith: "web.output.dom-check" } : { signature };
}

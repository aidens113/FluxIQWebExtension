// The ways out a client pressed, kept on this domain's server half under an
// opaque reference (t470).
//
// The clearing reports each layer it closed with the control it pressed
// (`../actions/cleared-layers.ts` `wayOut`): a page address and an element
// descriptor. Core keeps a run's trace and must never hold page structure it
// did not ask for, so the dispatcher keeps the descriptor here and hands Core a
// reference (`../io/gateway-output-dispatcher.ts`). A candidate trial gives the
// reference back, and the evidence runtime looks the way out up to name it by a
// handle the model may write (`../runtime/llm-evidence/way-out-handles/`).
//
// Bounded: the newest `RETAINED_WAY_OUTS` are kept and the oldest let go; a
// reference let go, or never kept, names nothing. A reference is random, so it
// says nothing of the page and cannot be guessed.

import { randomUUID } from "node:crypto";
import type { WebAutomationClearedWayOut } from "../actions/cleared-layers";

/** Ways out kept at once: far above what one trial presses, and a trial asks right after its run. */
const RETAINED_WAY_OUTS = 256;

export type WebAutomationClearedWayOuts = {
  /** Keeps `wayOut` and answers the reference Core may carry for it. */
  keep(wayOut: WebAutomationClearedWayOut): string;
  /** The way out kept under `reference`, or undefined when it was let go or never kept. */
  get(reference: string): WebAutomationClearedWayOut | undefined;
};

export function createWebAutomationClearedWayOuts(): WebAutomationClearedWayOuts {
  const kept = new Map<string, WebAutomationClearedWayOut>();
  return {
    keep(wayOut) {
      const reference = `way-out.${randomUUID().replace(/-/gu, "")}`;
      kept.set(reference, structuredClone(wayOut));
      for (const oldest of kept.keys()) {
        if (kept.size <= RETAINED_WAY_OUTS) break;
        kept.delete(oldest);
      }
      return reference;
    },
    get(reference) {
      const wayOut = kept.get(reference);
      return wayOut === undefined ? undefined : structuredClone(wayOut);
    }
  };
}

// The conditions a wait can wait for.
//
// `waits.ts` waits for presence in the DOM and for text. This is the full set
// the plan's dynamic-interface work needs: `present`, `visible`, `enabled`,
// `absent`, `url`, and `stable` (the page stopped changing for `stableForMs`).
// Running out of time is not the same as failing: the outcome reports it, and
// the verb turns it into a `timed_out` result with Core's `timeout` category
// rather than a flattened `failed`.
//
// Owned by `w2-waits`, which replaces this stub.

import type { WebAutomationWaitCondition } from "../types";

export type WaitConditionRequest = {
  condition: WebAutomationWaitCondition;
  selector?: string | undefined;
  text?: string | undefined;
  /** The URL the `url` condition waits to land on. */
  url?: string | undefined;
  timeoutMs?: number | undefined;
  /** How long the page must stop changing for, under the `stable` condition. */
  stableForMs?: number | undefined;
};

export type WaitConditionOutcome =
  | { ok: true; condition: WebAutomationWaitCondition; element?: Element | undefined; actual: string; waitedMs: number }
  | { ok: false; condition: WebAutomationWaitCondition; actual: string; waitedMs: number };

export function waitForCondition(_request: WaitConditionRequest): Promise<WaitConditionOutcome> {
  throw new Error("The wait-conditions capability is not implemented yet.");
}
